import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOfficialCache,SOURCE_CACHE_MAX_AGE} from '../lib/source-cache.js';
import seeds from '../lib/verified-official-responses.js';
const now=Date.parse('2026-11-03T00:00:00Z');
test('verified official snapshots preserve dates, gross amounts and provenance',()=>{
 for(const [code,entry] of Object.entries(seeds)){
  const result=normalizeOfficialCache(entry,entry.brand,code,now);
  assert.ok(result?.cached,code);assert.deepEqual(result.records,entry.records);
  assert.equal(result.verifiedAt,entry.verifiedAt);
 }
 assert.equal(seeds['480020'].records[0].unit,301);
 assert.equal(seeds['490590'].records[0].payDate,'2026-11-03');
});
test('rejects stale, future, wrong-product and unverified snapshots',()=>{
 const entry=seeds['490590'];
 for(const e of [
  {...entry,verifiedAt:new Date(now-SOURCE_CACHE_MAX_AGE-1).toISOString()},
  {...entry,verifiedAt:new Date(now+300001).toISOString()},
  {...entry,code:'491620'}, {...entry,brand:'ACE'}, {...entry,officialVerified:false},
  {...entry,records:[{...entry.records[0],payDate:'2026-10-01'}]},
  {...entry,records:[{...entry.records[0],officialVerified:false}]},
  {...entry,records:[{...entry.records[0],sourceUrl:'https://kbam.co.kr.evil.test/846'}]}
 ])assert.equal(normalizeOfficialCache(e,'RISE','490590',now),null);
});
