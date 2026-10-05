export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const name=String(req.query?.name||'').trim();
 if(!name)return res.status(400).json({error:'name_required'});
 try{
  const s=await fetch('https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(name)+'&target=stock,index,marketindicator,coin,ipo',{headers:{'User-Agent':'Mozilla/5.0'}});
  const j=await s.json(); const items=j?.result?.items||j?.items||[];
  const norm=x=>String(x||'').replace(/\s+/g,'').toUpperCase();
  const item=items.find(x=>norm(x.name)===norm(name))||items.find(x=>norm(x.name).includes(norm(name))||norm(name).includes(norm(x.name)))||items[0];
  const code=item?.code;
  if(!code)return res.status(404).json({error:'ticker_not_found',name});
  const q=await fetch('https://polling.finance.naver.com/api/realtime/domestic/stock/'+encodeURIComponent(code),{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://finance.naver.com/'}});
  const d=await q.json(); const row=d?.datas?.[0];
  const price=Number(String(row?.closePrice||'').replace(/,/g,''));
  if(!(price>0))return res.status(502).json({error:'price_not_found',code});
  return res.status(200).json({name,matchedName:item.name,code,price,tradedAt:row.localTradedAt||null,marketStatus:row.marketStatus||null});
 }catch(e){return res.status(502).json({error:'quote_failed'});}
}