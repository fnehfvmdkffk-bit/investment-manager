const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').replace(/\s+/g,'').replace(/타켓/g,'타겟').toUpperCase();
async function lookupCode(name){
 const s=await fetch('https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(name)+'&target=stock,index,marketindicator,coin,ipo',{headers:{'User-Agent':'Mozilla/5.0'}});
 const j=await s.json(),items=j?.result?.items||j?.items||[];const x=items.find(v=>norm(v.name)===norm(name))||items.find(v=>norm(v.name).includes(norm(name))||norm(name).includes(norm(v.name)));return x?.code||null;
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