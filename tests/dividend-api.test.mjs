import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../api/dividend.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
function setup(cache,provider){
 const writes=[];
 const ctx=vm.createContext({resolveCode:async()=> '490590',providers:{RISE:provider},calendar:async()=>{throw Error('unverified fallback must not run')},readOfficialCache:async()=>cache,writeOfficialCache:async(...args)=>writes.push(args)});
 vm.runInContext(source,ctx);
 const res={setHeader(){},status(s){this.statusCode=s;return this},json(body){this.body=body;return this}};
 return {run:()=>ctx.handler({method:'GET',query:{name:'RISE ETF'}},res),res,writes};
}
const cached={cached:true,verifiedAt:'2026-11-02T12:22:17.648Z',cacheAgeMs:3600000,records:[{recordDate:'2026-10-30',payDate:'2026-11-03',unit:158}],officialVerified:true};
test('empty and timed-out official sources return labeled verified cache without renewing its timestamp',async()=>{
 for(const provider of [async()=>({records:[]}),async()=>{throw Error('timeout')}]){
  const c=setup(cached,provider);await c.run();
  assert.equal(c.res.statusCode,200);assert.equal(c.res.body.cached,true);
  assert.equal(c.res.body.checkedAt,cached.verifiedAt);
  assert.equal(c.res.body.cacheReason,'official_source_temporarily_unavailable');
  assert.equal(c.writes.length,0);
 }
});
test('live official success replaces source cache and is not labeled as cached',async()=>{
 const live={records:cached.records,officialVerified:true,source:'RISE official notices'};
 const c=setup(cached,async()=>live);await c.run();
 assert.equal(c.res.body.cached,undefined);assert.equal(c.writes.length,1);
 assert.equal(c.writes[0][3],c.res.body.checkedAt);
});
test('official future payments and estimated notices are returned outside confirmed records',async()=>{
 const estimate={recordDate:'',payDate:'',unit:94,status:'estimated',officialVerified:true};
 const upcoming={recordDate:'2099-11-13',payDate:'2099-11-17',unit:99,officialVerified:true};
 const c=setup(null,async()=>({records:[upcoming,...cached.records],estimates:[estimate],officialVerified:true}));
 await c.run();
 assert.equal(c.res.body.records.length,1);
 assert.equal(c.res.body.records[0].unit,158);
 assert.equal(c.res.body.estimates.length,2);
 assert.equal(c.res.body.estimates[0].status,'estimated');
 assert.equal(c.res.body.estimates[1].status,'scheduled');
});
test('an estimate without a confirmed history does not renew the official cache',async()=>{
 const c=setup(null,async()=>({records:[],estimates:[{unit:94,status:'estimated'}]}));
 await c.run();
 assert.equal(c.res.statusCode,200);
 assert.equal(c.res.body.records.length,0);
 assert.equal(c.res.body.estimates[0].unit,94);
 assert.equal(c.writes.length,0);
});
