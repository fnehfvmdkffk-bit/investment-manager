const norm=s=>String(s||'').normalize('NFKC').replace(/타켓/g,'타겟').replace(/[^0-9a-zA-Z가-힣]/g,'').toUpperCase();
const KNOWN={
 'TIGER미국배당다우존스타겟커버드콜2호':'458760',
 'TIGER미국S&P500타겟데일리커버드콜':'482730',
 'KODEX미국배당다우존스타겟커버드콜':'483290',
 'TIGER미국나스닥100타겟데일리커버드콜':'486290',
 'TIGER미국테크TOP10타겟커버드콜':'474220',
 'KODEX미국AI테크TOP10타겟커버드콜':'483280'
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
 const name=String(req.query?.name||'').trim();
 if(!name)return res.status(400).json({error:'name_required'});
 const key=norm(name);
 if(KNOWN[key])return res.status(200).json({code:KNOWN[key]});
 try{
  const url='https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(name.replace(/타켓/g,'타겟'))+'&target=stock,index,marketindicator,coin,ipo';
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)throw Error('search_failed');
  const json=await response.json();
  const items=json?.result?.items||json?.items||[];
  const exact=items.find(x=>norm(x.name)===key&&/^\d{6}$/.test(String(x.code||'')));
  if(!exact)return res.status(404).json({error:'code_not_found'});
  return res.status(200).json({code:String(exact.code)});
 }catch(e){return res.status(502).json({error:'lookup_unavailable'})}
}
