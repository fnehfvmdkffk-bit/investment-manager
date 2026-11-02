import {load} from '../lib/dividend-sources.js';
// Diagnostic only: fetches one public TIGER ETF notice; never changes portfolio data.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const inspect=String(req.query?.inspect||'');
 const urls={
  tigerAjax:'https://investments.miraeasset.com/tigeretf/ko/customer/notice/list.ajax?firstIndex=0&listCnt=30&pageIndex=1&q=',
  tigerCommon:'https://investments.miraeasset.com/tigeretf/common/js/controller/co/COCmmCtrl.js',
  tigerController:'https://investments.miraeasset.com/tigeretf/common/js/controller/bm/bma/BMANoticeCtrl.js',
  tigerDistribution:'https://investments.miraeasset.com/tigeretf/ko/distribution/annual/list.do',
  tigerList:'https://investments.miraeasset.com/tigeretf/ko/customer/notice/list.do?listCnt=30&pageIndex=1',
  tiger767:'https://investments.miraeasset.com/tigeretf/ko/customer/notice/view.do?listCnt=10&pageIndex=1&detailsKey=767&q=',
  tiger773:'https://investments.miraeasset.com/tigeretf/ko/customer/notice/view.do?listCnt=10&pageIndex=1&detailsKey=773&q=',
  riseProducts:'https://kbam.co.kr/api/products/etfs',
  riseSearch:'https://kbam.co.kr/api/products/etfs/search?keyword=490590',
  riseAutocomplete:'https://kbam.co.kr/api/products/etfs/autocomplete?keyword=490590',
  riseDividend:'https://kbam.co.kr/api/products/etfs/44F8/dividend',
  riseList:'https://kbam.co.kr/support/notice',
  rise842:'https://kbam.co.kr/support/notice/842',
  rise846:'https://kbam.co.kr/support/notice/846'
 };
 if(inspect==='asset'||inspect==='publicApi'){
  const target=new URL(String(req.query?.path||''),'https://kbam.co.kr');
  const allowed=target.origin==='https://kbam.co.kr'&&(inspect==='asset'?(/^\/_next\/static\/chunks\/[a-zA-Z0-9_.-]+\.js$/.test(target.pathname)||/^\/media\/tinymce\/[a-zA-Z0-9_./-]+\.png$/.test(target.pathname)):/^\/api\/products\/etfs(?:\/|$)/.test(target.pathname));
  if(!allowed)return res.status(400).json({error:'unsupported_asset'});
  try{
   await load(urls.riseList);
   if(target.pathname.endsWith('.png')){const r=await fetch(target,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('upstream_'+r.status);return res.status(200).json({base64:Buffer.from(await r.arrayBuffer()).toString('base64')});}
   return res.status(200).json({html:await load(target.href)});
  }catch(e){return res.status(502).json({error:String(e.message)})}
 }
 if(inspect==='tigerAjaxSession'){
  try{
   const base='https://investments.miraeasset.com';
   const landing=await fetch(urls.tigerList,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html','Accept-Language':'ko-KR,ko;q=0.9'},signal:AbortSignal.timeout(12000)});
   await landing.text();const cookie=landing.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   const r=await fetch(base+'/tigeretf/ko/customer/notice/list.ajax',{method:'POST',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html, */*; q=0.01','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','Origin':base,'Referer':urls.tigerList,...(cookie?{Cookie:cookie}:{})},body:'firstIndex=0&listCnt=10&pageIndex=1&detailsKey=&q=',signal:AbortSignal.timeout(18000)});
   return res.status(200).json({httpStatus:r.status,html:await r.text()});
  }catch(e){return res.status(502).json({error:String(e.message)})}
 }
 if(inspect==='riseScripts'){
  try{
   const home=await load(urls.riseList);
   const paths=[...new Set([...home.matchAll(/<script[^>]*src=["'](\/_next\/static\/chunks\/[^"']+\.js)["']/g)].map(x=>x[1]))];
   const results=await Promise.all(paths.map(async path=>{try{const js=await load('https://kbam.co.kr'+path);return {path,bytes:js.length,apiClient:js.includes('getEtfDividendDownloadUrl')?js.slice(0,8500):undefined,endpoints:[...new Set([...js.matchAll(/[^\s"'`]{0,50}\/api\/[^\s"'`]{1,180}/g)].map(x=>x[0]))].slice(0,50),matches:[...js.matchAll(/.{0,130}(?:dividend|distribution|dividends|notices\/|\/funds\/|\/products\/).{0,250}/gi)].slice(0,25).map(x=>x[0])}}catch(e){return {path,error:String(e.message)}}}));
   return res.status(200).json({results});
  }catch(e){return res.status(502).json({error:String(e.message)})}
 }
 if(inspect){
  if(!urls[inspect])return res.status(400).json({error:'unsupported_source'});
  try{return res.status(200).json({source:urls[inspect],httpStatus:200,html:(await load(urls[inspect],inspect==='tigerAjax'?{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'firstIndex=0&listCnt=30&pageIndex=1&detailsKey=&q='+encodeURIComponent('분배금')}:{})).slice(0,500000)});}catch(e){return res.status(502).json({error:String(e.message)})}
 }
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
