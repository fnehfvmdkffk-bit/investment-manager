function clean(s=''){return String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const name=String(req.query?.name||'').trim(); if(!name)return res.status(400).json({error:'name'});
 try{
  const r=await fetch('https://etfcal.com/etfs',{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error('source');
  const html=await r.text(),plain=clean(html),norm=x=>String(x).replace(/\s+/g,'').toLowerCase();
  const pos=plain.indexOf(name); if(pos<0)return res.status(404).json({error:'not_found'});
  const raw=plain.slice(Math.max(0,pos-100),pos+name.length+300);
  const dates=[...raw.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map(x=>x[0]).filter((x,i,a)=>a.indexOf(x)===i), wm=raw.match(/([\d,]+(?:\.\d+)?)\s*원/);
  if(!dates.length||!wm)return res.status(404).json({error:'no_dividend'});
  const baseDate=dates[0],payDate=dates.length>1?dates[1]:'';
  return res.status(200).json({name,baseDate,payDate,unit:Number(wm[1].replace(/,/g,'')),source:'ETFcal',tax:'pre-tax'});
 }catch(e){return res.status(502).json({error:'source_unavailable'})}
}