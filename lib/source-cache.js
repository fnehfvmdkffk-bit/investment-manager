import {get,put} from '@vercel/blob';
import seeds from './verified-official-responses.js';
import {validRecords} from './dividend-sources.js';
export const SOURCE_CACHE_MAX_AGE=31*86400000;
const memory=new Map();
const officialHosts={TIGER:'investments.miraeasset.com',RISE:'kbam.co.kr',ACE:'papi.aceetf.co.kr'};
const pathFor=(brand,code)=>'dividend-source-cache/v1/'+brand+'-'+code+'.json';
export function normalizeOfficialCache(entry,brand,code,now=Date.now()){
 if(!entry||entry.brand!==brand||entry.code!==code||entry.officialVerified!==true||!Array.isArray(entry.records))return null;
 const time=Date.parse(entry.verifiedAt);if(!Number.isFinite(time)||time>now+300000||now-time>SOURCE_CACHE_MAX_AGE)return null;
 const host=officialHosts[brand];
 if(!host)return null;
 const records=validRecords(entry.records||[]).filter(x=>x.officialVerified===true&&typeof x.sourceUrl==='string'&&x.sourceUrl.startsWith('https://'+host+'/'));
 if(!records.length)return null;
 return {...entry,records,cached:true,cacheAgeMs:Math.max(0,now-time),source:String(entry.source||brand+' official notices')+' (verified cache)'};
}
export async function readOfficialCache(brand,code){
 if(!officialHosts[brand])return null;
 const key=brand+'|'+code,remembered=memory.get(key),local=remembered&&remembered.until>Date.now()?normalizeOfficialCache(remembered.entry,brand,code):null;
 if(local)return local;
 let entry=null;
 try{const r=await get(pathFor(brand,code),{access:'private',abortSignal:AbortSignal.timeout(5000)});if(r?.statusCode===200)entry=JSON.parse(await new Response(r.stream).text())}catch{}
 const remote=normalizeOfficialCache(entry,brand,code),seed=normalizeOfficialCache(seeds[code],brand,code);
 const best=remote&&(!seed||remote.verifiedAt>=seed.verifiedAt)?remote:seed;
 if(best)memory.set(key,{entry:{...best,source:best.source.replace(/ \(verified cache\)$/,'')},until:Date.now()+60000});
 return best;
}
export async function writeOfficialCache(brand,code,result,verifiedAt){
 if(!officialHosts[brand]||result.officialVerified!==true||!result.records?.length)return;
 const entry={brand,code,source:result.source,officialVerified:true,records:result.records,verifiedAt};
 if(!normalizeOfficialCache(entry,brand,code))return;
 memory.set(brand+'|'+code,{entry,until:Date.now()+60000});
 try{await put(pathFor(brand,code),JSON.stringify(entry),{access:'private',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60,contentType:'application/json',abortSignal:AbortSignal.timeout(5000)})}catch{}
}
