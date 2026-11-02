export const nameKey=s=>String(s||'').normalize('NFKC').replace(/타켓/g,'타겟').replace(/[^0-9a-zA-Z가-힣]/g,'').toUpperCase();
// Product identifiers only. Distribution amounts and dates are fetched live.
const products={
 '0005A0':['KODEX 미국S&P500데일리커버드콜OTM'],
 '0008S0':['TIGER 미국배당다우존스타겟데일리커버드콜'],
 '0138T0':['RISE 미국S&P500데일리고정커버드콜'],
 '441640':['KODEX 미국배당커버드콜액티브'],
 '441680':['TIGER 미국나스닥100커버드콜(합성)'],
 '458760':['TIGER 미국배당다우존스타겟커버드콜2호'],
 '480030':['ACE 미국500데일리타겟커버드콜(합성)'],
 '482730':['TIGER 미국S&P500타겟데일리커버드콜'],
 '483290':['KODEX 미국배당다우존스타겟커버드콜'],
 '486290':['TIGER 미국나스닥100타겟데일리커버드콜'],
 '490600':['RISE 미국배당100데일리고정커버드콜'],
 '494210':['SOL 미국500타겟데일리커버드콜액티브','SOL 미국500타겟커버드콜액티브'],
 '494300':['KODEX 미국나스닥100데일리커버드콜OTM'],
 '494420':['PLUS 미국배당증가성장주데일리커버드콜'],
 '0144L0':['KODEX 미국성장커버드콜액티브'],
 '474220':['TIGER 미국테크TOP10타겟커버드콜'],
 '480020':['ACE 미국빅테크7+데일리타겟커버드콜(합성)'],
 '480040':['ACE 미국반도체데일리타겟커버드콜(합성)'],
 '483280':['KODEX 미국AI테크TOP10타겟커버드콜'],
 '490590':['RISE 미국AI밸류체인데일리고정커버드콜'],
 '491620':['RISE 미국테크100데일리고정커버드콜'],
 '493810':['TIGER 미국AI빅테크10타겟데일리커버드콜'],
 '0086B0':['TIGER 리츠부동산인프라TOP10액티브'],
 '0086C0':['TIGER 리츠부동산인프라10채권혼합액티브'],
 '453850':['ACE 미국30년국채액티브(H)'],
 '476760':['ACE 미국30년국채액티브'],
 '402970':['ACE 미국배당다우존스'],
 '0049M0':['ACE 미국배당퀄리티+커버드콜액티브'],
 '466940':['TIGER 은행고배당TOP10','TIGER 은행고배당플러스TOP10'],
 '289480':['TIGER 200커버드콜ATM','TIGER 200커버드콜'],
 '290080':['RISE 200고배당커버드콜ATM'],
 '472150':['TIGER 배당프리미엄액티브'],
 '475080':['KODEX 테슬라인컴프리미엄혼합액티브','KODEX 테슬라인컴프리미엄채권혼합액티브','KODEX 테슬라커버드콜채권혼합액티브'],
 '473330':['SOL 미국30년국채커버드콜(합성)'],
 '472830':['RISE 미국30년국채커버드콜(합성)'],
 '0013R0':['RISE 테슬라미국채타겟커버드콜혼합(합성)'],
 '329200':['TIGER 리츠부동산인프라']
};
export const KNOWN_CODES=Object.fromEntries(Object.entries(products).flatMap(([code,names])=>names.map(name=>[nameKey(name),code])));
export async function resolveCode(name,explicit){
 if(/^[0-9A-Z]{6}$/.test(String(explicit||'').toUpperCase()))return String(explicit).toUpperCase();
 const key=nameKey(name);if(KNOWN_CODES[key])return KNOWN_CODES[key];
 const r=await fetch('https://m.stock.naver.com/front-api/search/autoComplete?query='+encodeURIComponent(String(name).replace(/타켓/g,'타겟'))+'&target=stock,index,marketindicator,coin,ipo',{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('code_lookup_unavailable');
 const json=await r.json(),items=json?.result?.items||json?.items||[];
 // Never use substring matching: similar ETF names can be different securities.
 const found=items.find(x=>nameKey(x.name)===key&&/^[0-9A-Z]{6}$/.test(String(x.code||'')));
 return found?.code||null;
}
