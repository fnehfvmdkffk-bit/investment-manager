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
