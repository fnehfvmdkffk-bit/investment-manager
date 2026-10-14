const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').replace(/\s+/g,'').replace(/타켓/g,'타겟').toUpperCase();
const KNOWN_CODES={
 'TIGER미국배당다우존스타겟커버드콜2호':'458760',
 'TIGER미국S&P500타겟데일리커버드콜':'482730',
 'KODEX미국배당다우존스타겟커버드콜':'483290',
 'TIGER미국나스닥100타겟데일리커버드콜':'486290',
 'TIGER미국테크TOP10타겟커버드콜':'474220',
 'KODEX미국AI테크TOP10타겟커버드콜':'483280'
};
async function lookupCode(name){
 const key=norm(name);
 if(KNOWN_CODES[key])return KNOWN_CODES[key];
 const queries=[String(name).replace(/타켓/g,'타겟'),String(name)];
 for(const query of [...new Set(queries)]){
  try{
   const s=await fetch('https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(query)+'&target=stock,index,marketindicator,coin,ipo',{headers:{'User-Agent':'Mozilla/5.0'}});
   if(!s.ok)continue;
   const j=await s.json(),items=j?.result?.items||j?.items||[];
   const x=items.find(v=>norm(v.name)===key)||items.find(v=>norm(v.name).includes(key)||key.includes(norm(v.name)));
   if(x&&/^[0-9A-Z]{6}$/.test(String(x.code||'')))return x.code;
  }catch(e){}
 }
 return null;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');const name=String(req.query?.name||'').trim();if(!name)return res.status(400).json({error:'name'});
 try{
  const code=await lookupCode(name);if(!code)return res.status(404).json({error:'ticker_not_found'});
  const r=await fetch('https://etfcal.com/etfs/kr/'+encodeURIComponent(code),{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw 0;
  const text=clean(await r.text()),records=[];const re=/(20\d{2}-\d{2}-\d{2})\s+(20\d{2}-\d{2}-\d{2})\s+([\d,]+(?:\.\d+)?)원/g;let m;
  while((m=re.exec(text))){const payDate=m[1],recordDate=m[2],unit=Number(m[3].replace(/,/g,''));if(payDate>='2026-09-01')records.push({payDate,recordDate,unit})}
  return res.status(200).json({name,code,records,source:'ETFcal/KRX',tax:'pre-tax'});
 }catch(e){return res.status(502).json({error:'source_unavailable'})}
}