import {resolveCode} from '../lib/etf-codes.js';
import {providers,calendar} from '../lib/dividend-sources.js';
import {readOfficialCache,writeOfficialCache} from '../lib/source-cache.js';
// Leave enough time to return verified history before the browser aborts.
async function lookupRiseWithDeadline(lookup, timeoutMs){
 let timer;
 try{
  return await Promise.race([
   lookup(),
   new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('official_source_timeout')),timeoutMs);
   })
  ]);
 }finally{clearTimeout(timer)}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const name=String(req.query?.name||'').trim();if(!name)return res.status(400).json({error:'name_required'});
 try{
  const code=await resolveCode(name,String(req.query?.code||'').trim());
  if(!code)return res.status(404).json({error:'ticker_not_found',message:'종목코드 확인 필요'});
  const brand=name.match(/^(TIGER|KODEX|ACE|RISE|SOL|PLUS)\b/i)?.[1]?.toUpperCase();
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const respond=result=>{
   const records=result.records||[];
   const estimates=result.estimates||[];
   const upcoming=records.filter(row=>row.officialVerified&&row.payDate>today);
   const scheduled=upcoming.filter(row=>!estimates.some(estimate=>estimate.recordDate===row.recordDate));
   return res.status(200).json({
    name,code,...result,tax:'pre-tax',
    records:records.filter(row=>!upcoming.includes(row)),
    estimates:[...estimates,...scheduled.map(row=>({...row,status:'scheduled'}))]
   });
  };
  const cached=await readOfficialCache(brand,code);
  if(cached&&cached.cacheAgeMs<15*60000&&!['TIGER','RISE'].includes(brand))return respond({...cached,checkedAt:cached.verifiedAt,cacheReason:'recently_verified'});
  let officialError='';
  if(brand&&providers[brand]){
   try{
    const lookup=()=>providers[brand](code);
    const result=await (brand==='RISE'
     ? lookupRiseWithDeadline(lookup,cached?18000:40000)
     : lookup());
    if(result.records.length||result.estimates?.length){
     const checkedAt=new Date().toISOString();
     if(result.records.length)await writeOfficialCache(brand,code,result,checkedAt);
     return respond({...result,records:result.records.length?result.records:cached?.records||[],checkedAt});
    }
    officialError='official_records_empty';
   }catch(e){officialError=String(e.message||'official_source_unavailable')}
  }
  if(cached)return respond({...cached,checkedAt:cached.verifiedAt,cacheReason:'official_source_temporarily_unavailable',officialError,message:'원본 재조회 지연 · 검증된 공식 공지 자료 사용'});
  // Preserve the existing third-party fallback and identify its provenance explicitly.
  try{
   const result=await calendar(code);
   return res.status(200).json({name,code,...result,officialError,tax:'pre-tax',outcome:result.records.length?'fallback':'unavailable',message:officialError?'공식 조회 미확인 ('+officialError+')':'확인된 분배금 없음'});
  }catch{
   return res.status(502).json({error:'source_unavailable',code,officialError,message:'운용사 조회 연결 실패'});
  }
 }catch(e){return res.status(502).json({error:'lookup_unavailable',message:'종목코드 조회 연결 실패'})}
}
