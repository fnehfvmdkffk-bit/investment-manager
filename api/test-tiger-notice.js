// Diagnostic only: fetches one public TIGER ETF notice; never changes portfolio data.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const url='https://investments.miraeasset.com/tigeretf/ko/customer/notice/view.do?listCnt=10&pageIndex=1&detailsKey=767&q=';
 const started=Date.now();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const upstream=await fetch(url,{signal:controller.signal,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; ETFNoticeCheck/1.0)','Accept':'text/html,application/xhtml+xml','Accept-Language':'ko-KR,ko;q=0.9'}});
  const html=await upstream.text();
  const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  const codes=['474220','493810','0008S0','0086B0','0086C0','482730'];
  const matchedCodes=codes.filter(code=>plain.includes(code));
  const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const rows=[];
  for(const table of html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi)||[]){
   for(const tr of table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]){
    const cells=[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>decode(m[1]));
    const idx=cells.findIndex(x=>/^[0-9A-Z]{6}$/.test(x));
    if(idx<0)continue;
    const unit=Number(String(cells[idx+2]||'').replace(/[,원\s]/g,''));
    if(!Number.isFinite(unit)||unit<=0)continue;
    rows.push({code:cells[idx],name:cells[idx+1]||'',unit,rate:cells[idx+3]||''});
   }
  }
  const unique=[...new Map(rows.map(x=>[x.code,x])).values()];
  return res.status(200).json({checkedAt:new Date().toISOString(),source:url,httpStatus:upstream.status,ok:upstream.ok,finalUrl:upstream.url,elapsedMs:Date.now()-started,htmlBytes:Buffer.byteLength(html),noticeTitleFound:plain.includes('2026년 10월 중순 분배금 지급 안내'),matchedCodes,tableCount:(html.match(/<table\b/gi)||[]).length,extractedCount:unique.length,extracted:unique,expectedCodesFound:codes.filter(code=>unique.some(x=>x.code===code)),excerpt:plain.slice(0,350)});
 }catch(e){return res.status(200).json({checkedAt:new Date().toISOString(),source:url,ok:false,elapsedMs:Date.now()-started,error:e?.name||'fetch_error',message:String(e?.message||e).slice(0,200)})}
 finally{clearTimeout(timer)}
}
