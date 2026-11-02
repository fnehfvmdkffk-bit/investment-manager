const cache=new Map();
export async function load(url,options={}){
 const key=(options.method||'GET')+' '+url+' '+(options.body||'');
 const old=cache.get(key);if(old&&old.until>Date.now())return old.promise;
 const promise=(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   try{
    const r=await fetch(url,{...options,headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json,text/html,*/*',...options.headers},signal:AbortSignal.timeout(attempt?9000:18000)});
    if(!r.ok){const error=Error('upstream_'+r.status);error.retryable=r.status>=500;throw error}
    return await r.text();
   }catch(e){if(attempt||!(e.retryable||e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError))throw e}
  }
 })();
 const entry={until:Date.now()+300000,promise};cache.set(key,entry);
 try{return await promise}catch(e){if(cache.get(key)===entry)cache.delete(key);throw e}
}
const json=async(u,o)=>JSON.parse(await load(u,o));
export const plain=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export function isoDate(v){
 const m=String(v||'').match(/^(20\d{2})[.\-/]?(\d{2})[.\-/]?(\d{2})$/);if(!m)return '';
 const date=m[1]+'-'+m[2]+'-'+m[3],d=new Date(date+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date?date:'';
}
export function validRecords(rows){
 const result=new Map();
 for(const row of rows){
  const recordDate=isoDate(row.recordDate),payDate=isoDate(row.payDate),unit=Number(String(row.unit).replace(/,/g,''));
  if(!recordDate||!payDate||payDate<recordDate||!Number.isFinite(unit)||unit<=0||payDate<'2026-09-01')continue;
  const key=recordDate;
  // Keep the first (newest source) record; do not duplicate a corrected event.
  if(!result.has(key))result.set(key,{...row,recordDate,payDate,unit});
 }
 return [...result.values()].sort((a,b)=>b.recordDate.localeCompare(a.recordDate));
}
export function parseAce(data,url){return validRecords((data.dividendList||[]).map(x=>({recordDate:x.std_DT,payDate:x.dividend_DT,unit:x.dividend_PRI,sourceUrl:url,officialVerified:true})))}
export async function ace(code){
 const root='https://papi.aceetf.co.kr/api/funds';
 const funds=await json(root+'?page=1&size=300');
 const fund=(funds.data||[]).find(x=>(x.badge?.stockCode||String(x.stockCd||'').slice(3,9))===code);
 if(!fund)throw Error('official_product_not_found');
 const url=root+'/'+encodeURIComponent(fund.fundCd)+'/dividend?page=1&size=100';
 return {records:parseAce(await json(url),url),source:'ACE official distribution history',officialVerified:true};
}
export function parseSol(data,url){return validRecords((data.items||[]).map(x=>({recordDate:x.WORK_DT,payDate:x.DIVIDEND_DT,unit:x.DIVIDEND_PRI,sourceUrl:url,officialVerified:true})))}
// Stable product IDs verified on the official product cards; no financial values are fixed.
const SOL_PRODUCTS={'494210':'211064','473330':'211044'};
export async function sol(code){
 const root='https://www.soletf.co.kr';let id=SOL_PRODUCTS[code];
 if(!id){
  const home=await load(root+'/');
  const tags=[...home.matchAll(/<a\b[^>]*\bdata-etf-cd6=["']([^"']+)["'][^>]*>/gi)];
  const tag=tags.find(x=>x[1]===code)?.[0];id=tag?.match(/href=["'](?:\/ko)?\/fund\/etf\/(\d+)/)?.[1];
 }
 if(!id)throw Error('official_product_not_found');
 let url=root+'/api/etf/pds/dividend/'+id,data;
 try{data=await json(url)}catch{url='https://www.soletf.com/api/etf/pds/dividend/'+id;data=await json(url)}
 return {records:parseSol(data,url),source:'SOL official distribution history',officialVerified:true};
}
export function parsePlus(data,url){return validRecords((data.content||[]).map(x=>({recordDate:x.wkdate,payDate:x.dkdate,unit:x.dividend,sourceUrl:url,officialVerified:true})))}
export async function plus(code){
 const root='https://www.plusetf.co.kr';
 const data=await json(root+'/api/v1/product/find/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:0,searchSortTy:'fn1m',searchSort:'DESC',fundType:'DIVID',productOption:'FOREIGN'})});
 const fund=(data.content||[]).find(x=>x.nameCode===code);if(!fund)throw Error('official_product_not_found');
 const url=root+'/api/v1/product/dividend/list?n='+encodeURIComponent(fund.id)+'&page=0';
 return {records:parsePlus(await json(url),url),source:'PLUS official distribution history',officialVerified:true};
}
export async function kodex(code){
 const root='https://m.samsungfund.com';
 const products=await json(root+'/api/v1/kodex/product.do?ordrColm=NAV&ordrSort=DESC&pageNo=1&srchTerm=w&srchVal='+encodeURIComponent(code));
 const fund=(Array.isArray(products)?products:[]).find(x=>x.stkTicker===code);if(!fund)throw Error('official_product_not_found');
 const url=root+'/api/v1/kodex/divid-info.do?id='+encodeURIComponent(fund.fId);
 const history=await json(url);
 return {records:parseKodex(history,url),source:'KODEX official distribution history',officialVerified:true};
}
export function parseKodex(data,url){return validRecords((data.dividList||[]).map(x=>({recordDate:x.basicD,payDate:x.payD,unit:x.dividA,sourceUrl:url,officialVerified:true})))}
function tableRows(html){return (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]).map(tr=>[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>plain(x[1])))}
function noticeDate(text,label,year){
 const m=text.match(new RegExp(label+'\\s*[:：]?\\s*(?:(20\\d{2})[.\\-/년 ]+)?(\\d{1,2})[.\\-/월 ]+(\\d{1,2})'));
 return m?isoDate((m[1]||year)+String(m[2]).padStart(2,'0')+String(m[3]).padStart(2,'0')):'';
}
export function parseNotice(html,code,brand,url){
 const text=plain(html),year=text.match(/(20\d{2})년\s*\d{1,2}월[^.]{0,50}분배금/)?.[1];
 if(!year)return [];
 const recordDate=noticeDate(text,'(?:분배금\\s*)?지급\\s*기준일',year);
 const payDate=noticeDate(text,'(?:실제\\s*지급일|실\\s*지급일|지급\\s*예정일|분배금\\s*지급일)',year);
 if(!recordDate||!payDate)return [];
 const rows=[];
 for(const cells of tableRows(html)){
  const i=cells.indexOf(code);if(i<0)continue;
  const unit=Number((cells[i+(brand==='TIGER'?2:1)]||'').replace(/[,원\s]/g,''));
  rows.push({recordDate,payDate,unit,sourceUrl:url,officialVerified:true});
 }
 return validRecords(rows);
}
async function notices(code,brand){
 const root=brand==='RISE'?'https://kbam.co.kr/support/notice':'https://investments.miraeasset.com/tigeretf/ko/customer/notice/';
 const listing=await load(brand==='RISE'?root:root+'list.do?listCnt=30&pageIndex=1');
 const links=[...listing.matchAll(brand==='RISE'?/<a\b[^>]*href=["']([^"']*\/support\/notice\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi:/<a\b[^>]*href=["']([^"']*detailsKey=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(x=>/분배금/.test(plain(x[2]))).slice(0,6);
 const results=await Promise.all(links.map(async x=>{
  const url=new URL(x[1].replace(/&amp;/g,'&'),root).href;
  try{return parseNotice(await load(url),code,brand,url)}catch{return []}
 }));
 return {records:validRecords(results.flat()),source:brand+' official notices',officialVerified:true};
}
export const tiger=code=>notices(code,'TIGER');
export const rise=code=>notices(code,'RISE');
export async function calendar(code){
 const url='https://etfcal.com/etfs/kr/'+encodeURIComponent(code),text=plain(await load(url)),records=[];
 for(const m of text.matchAll(/(20\d{2}-\d{2}-\d{2})\s+(20\d{2}-\d{2}-\d{2})\s+([\d,]+(?:\.\d+)?)원/g))records.push({payDate:m[1],recordDate:m[2],unit:m[3],sourceUrl:url,officialVerified:false});
 return {records:validRecords(records),source:'ETFcal (third-party calendar)',officialVerified:false};
}
export const providers={ACE:ace,SOL:sol,PLUS:plus,KODEX:kodex,TIGER:tiger,RISE:rise};
