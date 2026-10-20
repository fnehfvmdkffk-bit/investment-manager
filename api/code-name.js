export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const code=String(req.query?.code||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(code))return res.status(400).json({error:'invalid_code'});
 try{
  const url='https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(code)+'&target=stock,index,marketindicator,coin,ipo';
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw Error('search_failed');
  const j=await r.json(),items=j?.result?.items||j?.items||[];
  const found=items.find(x=>String(x.code||'').toUpperCase()===code&&String(x.name||'').trim());
  if(!found)return res.status(404).json({error:'not_found'});
  return res.status(200).json({code,name:String(found.name).trim()});
 }catch(e){return res.status(502).json({error:'lookup_unavailable'})}
}
