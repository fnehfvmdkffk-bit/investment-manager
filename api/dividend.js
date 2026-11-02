import {resolveCode} from '../lib/etf-codes.js';
import {providers,calendar} from '../lib/dividend-sources.js';
import {readOfficialCache,writeOfficialCache} from '../lib/source-cache.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const name=String(req.query?.name||'').trim();if(!name)return res.status(400).json({error:'name_required'});
 try{
  const code=await resolveCode(name,String(req.query?.code||'').trim());
  if(!code)return res.status(404).json({error:'ticker_not_found',message:'종목코드 확인 필요'});
  const brand=name.match(/^(TIGER|KODEX|ACE|RISE|SOL|PLUS)\b/i)?.[1]?.toUpperCase();
  const cached=await readOfficialCache(brand,code);
  if(cached&&cached.cacheAgeMs<15*60000)return res.status(200).json({name,code,...cached,tax:'pre-tax',checkedAt:cached.verifiedAt,cacheReason:'recently_verified'});
  let officialError='';
  if(brand&&providers[brand]){
   try{
    const result=await providers[brand](code);
    if(result.records.length){const checkedAt=new Date().toISOString();await writeOfficialCache(brand,code,result,checkedAt);return res.status(200).json({name,code,...result,tax:'pre-tax',checkedAt})}
    officialError='official_records_empty';
   }catch(e){officialError=String(e.message||'official_source_unavailable')}
  }
  if(cached)return res.status(200).json({name,code,...cached,tax:'pre-tax',checkedAt:cached.verifiedAt,cacheReason:'official_source_temporarily_unavailable',officialError,message:'원본 재조회 지연 · 검증된 공식 공지 자료 사용'});
  // Preserve the existing third-party fallback and identify its provenance explicitly.
  try{
   const result=await calendar(code);
   return res.status(200).json({name,code,...result,officialError,tax:'pre-tax',outcome:result.records.length?'fallback':'unavailable',message:officialError?'공식 조회 미확인 ('+officialError+')':'확인된 분배금 없음'});
  }catch{
   return res.status(502).json({error:'source_unavailable',code,officialError,message:'운용사 조회 연결 실패'});
  }
 }catch(e){return res.status(502).json({error:'lookup_unavailable',message:'종목코드 조회 연결 실패'})}
}
