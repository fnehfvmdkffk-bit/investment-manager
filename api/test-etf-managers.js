// Read-only connectivity and data-format diagnostics for ETF managers.
// No holdings, dividends, or server state are modified.
const sources={
 ACE:'https://www.aceetf.co.kr/',
 SOL:'https://www.soletf.co.kr/ko/fund/etf/211097?tabIndex=2',
 KODEX:'https://www.samsungfund.com/etf/main.do',
 RISE:'https://kbam.co.kr/support/notice/842',
 PLUS:'https://www.plusetf.co.kr/'
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const brand=String(req.query?.brand||'').toUpperCase();
 if(brand&&!sources[brand])return res.status(400).json({error:'unsupported_brand'});
 if(brand==='RISE'&&req.query?.kind==='1'){
  const urls=['https://kind.krx.co.kr/external/2026/08/12/000283/20260812000768/68659.htm','https://kind.krx.co.kr/external/2026/09/28/000183/20260928000552/68659.htm'];
  const results=await Promise.all(urls.map(async url=>{
   const started=Date.now();
   try{const response=await fetch(url,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
    const html=await response.text();
    const rows=[];
    for(const tr of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]){
     const cells=[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
     if(cells.some(v=>/RISE/.test(v)))rows.push(cells);
    }
    return {url,status:response.status,ok:response.ok,elapsedMs:Date.now()-started,bytes:html.length,rows:rows.slice(0,12)};
   }catch(e){return {url,ok:false,elapsedMs:Date.now()-started,error:String(e?.name||e)}}
  }));
  return res.status(200).json({mode:'read-only',source:'KRX KIND official disclosures',results});
 }
 if(brand==='RISE'&&req.query?.seibro==='1'){
  const urls=['https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179','https://m.seibro.or.kr/cmmn/allView.do','https://api.seibro.or.kr/pubc/pubr/cmm/CMPubrHome/viewCMPubrHome.do'];
  const results=await Promise.all(urls.map(async url=>{
   const started=Date.now();
   try{const response=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml','Accept-Language':'ko-KR,ko;q=0.9'}});
    const body=await response.text();return {url,status:response.status,ok:response.ok,elapsedMs:Date.now()-started,bytes:body.length,hasEtf:/ETF|분배금|etf/i.test(body)};
   }catch(e){return {url,ok:false,elapsedMs:Date.now()-started,error:String(e?.name||e)}}
  }));
  return res.status(200).json({mode:'read-only',source:'KSD SEIBro official',results});
 }
 if(brand==='RISE'&&req.query?.inspect==='1'){
  const urls=['https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179','https://m.seibro.or.kr/cmmn/allView.do','https://api.seibro.or.kr/pubc/pubr/cmm/CMPubrHome/viewCMPubrHome.do'];
  const results=await Promise.all(urls.map(async url=>{
   try{const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
    const html=await response.text();return {url,status:response.status,excerpt:html.slice(0,1700),scripts:[...html.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>m[1]).slice(0,12)};
   }catch(e){return {url,error:String(e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 if(brand==='RISE'&&req.query?.xml==='1'){
  const urls=['https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml','https://seibro.or.kr/websquare/IPORTAL/user/etf/BIP_CNTS06030V.xml','https://seibro.or.kr/websquare/javascript.wq?q=/bootloader'];
  const results=await Promise.all(urls.map(async url=>{
   try{const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Mozilla/5.0','Accept':'application/xml,text/xml,text/javascript,*/*'}});
    const body=await response.text();const hits=[...body.matchAll(/(?:action|url|submission|service|etf|분배금)[^\r\n<>]{0,180}/gi)].slice(0,30).map(x=>x[0]);
    return {url,status:response.status,bytes:body.length,excerpt:body.slice(0,900),hits};
   }catch(e){return {url,error:String(e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 if(brand==='RISE'&&req.query?.service==='1'){
  const url='https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml';
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'Mozilla/5.0','Accept':'application/xml,text/xml,*/*'}});
   const xml=await response.text();
   const terms=['submission_exerInfoDtramtPayStatPlist','EtfExerInfoPTask','callServletService.jsp','exerInfoDtramtPayStat'];
   const matches=terms.map(term=>{const p=xml.indexOf(term);return {term,found:p>=0,context:p<0?'':xml.slice(Math.max(0,p-1100),Math.min(xml.length,p+2600))}});
   const submissions=[...xml.matchAll(/<[^>]*submission\b[^>]*>/gi)].map(m=>m[0]).filter(v=>/exer|dtramt|pay|etf/i.test(v)).slice(0,15);
   const datasets=[...xml.matchAll(/<[^>]*(?:dataList|dataMap|column)\b[^>]*>/gi)].map(m=>m[0]).filter(v=>/exer|dtramt|pay|etf|isin|shot/i.test(v)).slice(0,45);
   return res.status(200).json({mode:'read-only',url,status:response.status,bytes:xml.length,matches,submissions,datasets});
  }catch(e){return res.status(200).json({mode:'read-only',error:String(e)})}
 }
 if(brand==='RISE'&&req.query?.post==='1'){
  const url='https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml';
  try{
   const xml=await (await fetch(url,{signal:AbortSignal.timeout(8000)})).text();
   const blocks=[...xml.matchAll(/<[^>]*(?:reqParam|request|service|task|START_PAGE|fromRGT_STD_DT|isin)[^>]*>/gi)].map(m=>({at:m.index,tag:m[0]})).slice(0,65);
   const task=xml.indexOf("function callTask(");
   const taskContext=task>=0?xml.slice(task,task+1600):'';
   const ids=[...xml.matchAll(/(?:setInstanceValue|setValue)\s*\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]).filter(v=>/reqParam|service|task/.test(v)).slice(0,35);
   return res.status(200).json({mode:'read-only',blocks,taskContext,ids});
  }catch(e){return res.status(200).json({error:String(e)})}
 }
 if(brand==='RISE'&&req.query?.execute==='1'){
  const endpoint='https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp';
  const payload='<?xml version="1.0" encoding="UTF-8"?><reqParam><task>ksd.safe.bip.cnts.etf.process.EtfExerInfoPTask</task><action>exerInfoDtramtPayStatPlist</action><isin>490600</isin><fromRGT_STD_DT>20260101</fromRGT_STD_DT><toRGT_STD_DT>20261021</toRGT_STD_DT><START_PAGE>1</START_PAGE><END_PAGE>20</END_PAGE></reqParam>';
  const started=Date.now();
  try{
   const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/xml; charset=UTF-8','Accept':'application/xml,text/xml,*/*','Origin':'https://seibro.or.kr','Referer':'https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml','User-Agent':'Mozilla/5.0'},body:payload});
   const body=await response.text();
   return res.status(200).json({mode:'read-only',code:'490600',requestMethod:'POST',httpStatus:response.status,elapsedMs:Date.now()-started,responseBytes:body.length,responseExcerpt:body.slice(0,2400),note:'Diagnostic only. No dividend data written.'});
  }catch(e){return res.status(200).json({mode:'read-only',code:'490600',elapsedMs:Date.now()-started,error:String(e?.message||e),note:'No dividend data written.'})}
 }
 if(brand==='RISE'&&req.query?.schema==='1'){
  const xml=await (await fetch('https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml',{signal:AbortSignal.timeout(8000)})).text();
  const terms=['<request','<reqParam','<service','function callTask','function callTask(','<xf:instance','<task','<action'];
  const found=terms.map(term=>{const at=xml.indexOf(term);return {term,at,context:at<0?'':xml.slice(Math.max(0,at-350),at+2000)}});
  return res.status(200).json({mode:'read-only',found});
 }
 if(brand==='RISE'&&req.query?.tasksource==='1'){
  const base='https://seibro.or.kr';
  const urls=['/IPORTAL/user/etf/BIP_CNTS06030V.xml','/IPORTAL/js/common.js','/IPORTAL/js/commonUtil.js','/websquare/engine/proworks/callServletService.jsp'];
  const results=await Promise.all(urls.map(async path=>{
   try{
    const response=await fetch(base+path,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Mozilla/5.0'}});
    const body=await response.text();
    const matches=[...body.matchAll(/(?:callTask|EtfExerInfoPTask|reqParam|serviceName|serviceId|taskName|processName|proworks)/gi)].slice(0,12).map(m=>body.slice(Math.max(0,m.index-170),m.index+430));
    return {path,status:response.status,bytes:body.length,scriptPaths:path.endsWith('.xml')?[...body.matchAll(/(?:src|href)=["']([^"']+\.js[^"']*)/gi)].map(m=>m[1]).slice(0,30):[],matches};
   }catch(e){return {path,error:String(e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 if(brand==='RISE'&&req.query?.bootstrap==='1'){
  const urls=['https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179','https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml'];
  const results=await Promise.all(urls.map(async url=>{
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Mozilla/5.0'}});
    const body=await response.text();
    const scripts=[...body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,70);
    const includes=[...body.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.(?:js|wq)(?:\?[^"']*)?)["']/gi)].map(m=>m[1]).slice(0,70);
    const taskMatches=[...body.matchAll(/\bcallTask\s*\(/g)].slice(0,8).map(m=>body.slice(Math.max(0,m.index-400),m.index+650));
    return {url,status:response.status,bytes:body.length,scripts,includes,taskMatches};
   }catch(e){return {url,error:String(e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 if(brand==='RISE'&&req.query?.bootloader==='1'){
  const urls=['https://seibro.or.kr/websquare/javascript.wq?q=/bootloader','https://seibro.or.kr/javascript.wq?q=/bootloader','https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml'];
  const results=await Promise.all(urls.map(async url=>{
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(8500),headers:{'User-Agent':'Mozilla/5.0','Referer':'https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml'}});
    const body=await response.text();
    const terms=['callTask','javascript.wq','WebSquare','proworks','src=','bootloader'];
    const matches=terms.map(term=>{const at=body.indexOf(term);return {term,at,excerpt:at<0?'':body.slice(Math.max(0,at-150),at+550)}});
    return {url,status:response.status,bytes:body.length,contentType:response.headers.get('content-type'),matches,head:body.slice(0,1100)};
   }catch(e){return {url,error:String(e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 const entries=brand?[[brand,sources[brand]]]:Object.entries(sources);
 // Probe alternate official RISE hostnames in parallel; diagnostics only.
 if(brand==='RISE'&&req.query?.probe==='1'){
  const urls=['https://kbam.co.kr/support/notice/842','https://www.kbam.co.kr/support/notice/842','https://www.riseetf.co.kr/','https://riseetf.co.kr/'];
  const results=await Promise.all(urls.map(async url=>{
   const started=Date.now();
   try{const response=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html','Accept-Language':'ko-KR,ko;q=0.9'}});
    const html=await response.text();
    return {url,status:response.status,ok:response.ok,elapsedMs:Date.now()-started,bytes:html.length,hasDividendKeyword:/분배금|배당금/.test(html),tableCount:(html.match(/<table\\b/gi)||[]).length};
   }catch(e){return {url,ok:false,elapsedMs:Date.now()-started,error:String(e?.name||e)}}
  }));
  return res.status(200).json({mode:'read-only',results});
 }
 const results=await Promise.all(entries.map(async ([name,url])=>{
  const started=Date.now();
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(name==='RISE'?25000:9000),redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml','Accept-Language':'ko-KR,ko;q=0.9'}});
   const html=await response.text();
   const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
   return {brand:name,url,status:response.status,ok:response.ok,elapsedMs:Date.now()-started,htmlBytes:Buffer.byteLength(html),hasDividendKeyword:/분배금|배당금/.test(plain),tableCount:(html.match(/<table\b/gi)||[]).length,verifiedDividendRecords:0,dividendExcerpt:(()=>{const p=plain.indexOf('분배금 지급현황');return p<0?'':plain.slice(p,p+650)})(),note:'접속 및 본문 검사. 분배금 추출 미검증'};
  }catch(e){return {brand:name,url,ok:false,elapsedMs:Date.now()-started,error:e?.name||'fetch_error',message:String(e?.message||e).slice(0,120)}}
 }));
 return res.status(200).json({checkedAt:new Date().toISOString(),mode:'read-only',results});
}
