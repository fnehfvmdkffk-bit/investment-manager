import test from 'node:test';
import assert from 'node:assert/strict';
import {isoDate,validRecords,parseAce,parseSol,parsePlus,parseKodex,parseNotice} from '../lib/dividend-sources.js';
import {KNOWN_CODES,nameKey,resolveCode} from '../lib/etf-codes.js';
test('official parsers select gross distribution rather than taxable distribution',()=>{
 const ace=parseAce({dividendList:[{std_DT:'20261015',dividend_DT:'20261019',dividend_PRI:191,tax_PRI:149}]},'https://papi.aceetf.co.kr/example');
 const sol=parseSol({items:[{WORK_DT:'20261030',DIVIDEND_DT:'20261102',DIVIDEND_PRI:103,WEEK_PRI:0,TAX_PRI:1}]},'https://www.soletf.co.kr/example');
 const plus=parsePlus({content:[{wkdate:'20261015',dkdate:'20261019',dividend:'95',taxBase:'0'}]},'https://www.plusetf.co.kr/example');
 const kodex=parseKodex({dividList:[{basicD:'20261030',payD:'20261103',dividA:'112',taxDividA:'0'}]},'https://m.samsungfund.com/example');
 assert.deepEqual([ace[0].unit,sol[0].unit,plus[0].unit,kodex[0].unit],[191,103,95,112]);
 assert.ok([ace,sol,plus,kodex].every(x=>x[0].officialVerified&&x[0].payDate&&x[0].sourceUrl));
});
test('invalid calendar dates and incomplete events are rejected',()=>{
 assert.equal(isoDate('20260230'),'');assert.equal(isoDate('20261015'),'2026-10-15');
 assert.deepEqual(validRecords([{recordDate:'2026-10-15',payDate:'',unit:10},{recordDate:'2026-10-15',payDate:'2026-10-14',unit:10},{recordDate:'2026-10-15',payDate:'2026-10-19',unit:Infinity}]),[]);
});
test('event correction uses record date, not amount, as identity',()=>{const records=validRecords([{recordDate:'20261015',payDate:'20261019',unit:112},{recordDate:'20261015',payDate:'20261019',unit:110}]);assert.equal(records.length,1);assert.equal(records[0].unit,112)});
test('alphanumeric and historical names resolve without external lookup',async()=>{
 assert.equal(await resolveCode('KODEX 미국S&P500데일리커버드콜otm'),'0005A0');
 assert.equal(await resolveCode('SOL 미국500 타켓커버드콜액티브'),'494210');
 assert.equal(await resolveCode('KODEX 테슬라인컴프리미엄혼합액티브'),'475080');
 assert.equal(await resolveCode('TIGER 은행고배당TOP10'),'466940');
 assert.equal(KNOWN_CODES[nameKey('RISE 미국ai밸류체인데일리고정커버드콜')],'490590');
});
test('explicit user code is preserved',async()=>{assert.equal(await resolveCode('ACE 미국30년국채액티브(H)','476760'),'476760')});

test('RISE notices use the gross amount and both explicitly stated dates',()=>{const html='<h1>2026년 10월 중순 분배금 지급 안내</h1><p>지급기준일 : 2026년 10월 15일 지급예정일 : 2026년 10월 19일</p><table><tr><td>RISE ETF</td><td>490600</td><td>106</td><td>0</td></tr></table>';const rows=parseNotice(html,'490600','RISE','https://kbam.co.kr/support/notice/example');assert.equal(rows[0].unit,106);assert.equal(rows[0].recordDate,'2026-10-15');assert.equal(rows[0].payDate,'2026-10-19');assert.deepEqual(parseNotice(html.replace('지급예정일','unknown'),'490600','RISE','https://kbam.co.kr/support/notice/example'),[])});
