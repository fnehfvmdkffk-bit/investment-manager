const CODES={
 'TIGER 미국배당다우존스타겟데일리커버드콜':'0008S0',
 'TIGER 미국배당다우존스타켓커버드콜2호':'458760',
 'TIGER 미국배당다우존스타겟커버드콜2호':'458760',
 'TIGER 미국S&P500타켓데일리커버드콜':'482730',
 'TIGER 미국S&P500타겟데일리커버드콜':'482730',
 'TIGER 미국나스닥100타켓데일리커버드콜':'486290',
 'TIGER 미국나스닥100타겟데일리커버드콜':'486290',
 'TIGER 미국테크TOP10타켓커버드콜':'474220',
 'TIGER 미국테크TOP10타겟커버드콜':'474220',
 'TIGER 미국AI빅테크10타겟데일리커버드콜':'493810',
 'TIGER 리츠부동산인프라TOP10액티브':'0086B0',
 'TIGER 리츠부동산인프라10채권혼합액티브':'0086C0',
 'KODEX 미국AI테크TOP10타켓커버드콜':'483280',
 'KODEX 미국AI테크TOP10타겟커버드콜':'483280',
 'KODEX 미국배당다우존스타켓커버드콜':'483290',
 'KODEX 미국배당다우존스타겟커버드콜':'483290',
 'PLUS 미국배당증가성장주데일리커버드콜':'494420',
 'ACE 미국30년국채액티브(H)':'453850'
};
const clean=n=>String(n||'').replace(/타켓/g,'타겟').replace(/otm/ig,'OTM').replace(/top/ig,'TOP').trim();
async function lookupCode(name){
 if(CODES[name])return {code:CODES[name],matchedName:name};
 const fixed=clean(name); if(CODES[fixed])return {code:CODES[fixed],matchedName:fixed};
 for(const q of [fixed,name]){
  const s=await fetch('https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(q)+'&target=stock,index,marketindicator,coin,ipo',{headers:{'User-Agent':'Mozilla/5.0'}});
  const j=await s.json(),items=j?.result?.items||j?.items||[],norm=x=>String(x||'').replace(/\s+/g,'').replace(/타켓/g,'타겟').toUpperCase();
  const item=items.find(x=>norm(x.name)===norm(fixed))||items.find(x=>norm(x.name).includes(norm(fixed))||norm(fixed).includes(norm(x.name)));
  if(item?.code)return {code:item.code,matchedName:item.name};
 }
 return null;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');const name=String(req.query?.name||'').trim();if(!name)return res.status(400).json({error:'name_required'});
 try{const found=await lookupCode(name);if(!found)return res.status(404).json({error:'ticker_not_found',name});
  const q=await fetch('https://polling.finance.naver.com/api/realtime/domestic/stock/'+encodeURIComponent(found.code),{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://finance.naver.com/'}});
  const d=await q.json(),row=d?.datas?.[0],price=Number(String(row?.closePrice||'').replace(/,/g,''));
  if(!(price>0))return res.status(502).json({error:'price_not_found',code:found.code});
  return res.status(200).json({name,matchedName:found.matchedName,code:found.code,price,tradedAt:row.localTradedAt||null,marketStatus:row.marketStatus||null});
 }catch(e){return res.status(502).json({error:'quote_failed'});}
}