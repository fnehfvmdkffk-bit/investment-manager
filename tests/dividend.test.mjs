import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=name=>html.slice(html.indexOf('function '+name+'('),html.indexOf('\n}',html.indexOf('function '+name+'('))+2);
function context(){
 const ctx=vm.createContext({DIV_STORE_KEY:'test',BASE_HOLDINGS:{A:[{'상품명':'ETF','수량':100,'평단가':10}]},TRADES:[],USER_DIVS:[],DATA:{A:{rows:[]}},names:['A'],holdingNameKey:s=>String(s).replace(/\s/g,''),holdingStockCode:()=> '123456',productsFor:()=>['ETF'],prevTradingDay:d=>d,AbortSignal,Date,Map,Set,Number,String,Array,localStorage:{setItem(){}},saveServerState:async()=>{},render(){},setTimeout(){},document:{getElementById:()=>({textContent:'',classList:{add(){},remove(){}}})}});
 vm.runInContext(extract('holdingQtyOnDate')+'\n'+html.match(/function holdingStateAtDate[^\n]+/)[0]+'\n'+'async '+extract('refreshAllDividends'),ctx);return ctx;
}
const row={recordDate:'2026-10-15',payDate:'2026-10-19',unit:50};
function source(c,rows=[row]){let calls=0;c.fetch=async()=>{calls++;return{ok:true,json:async()=>({records:rows,source:'test'})}};return()=>calls}
test('manual and automatic quantity agree; future trades are excluded',()=>{const c=context();c.TRADES=[{account:'A',product:'E TF',date:'2026-10-10',type:'매수',qty:10,price:20},{account:'A',product:'ETF',date:'2026-10-20',type:'매수',qty:9,price:30}];assert.equal(c.holdingQtyOnDate('A','ETF','2026-10-15'),110)});
test('repeat lookup is idempotent and refreshes automatic quantity',async()=>{const c=context();source(c);await c.refreshAllDividends();await c.refreshAllDividends();assert.equal(c.USER_DIVS.length,1);c.TRADES.push({account:'A',product:'ETF',date:'2026-10-10',type:'매수',qty:5,price:10});await c.refreshAllDividends();assert.equal(c.USER_DIVS[0].qty,105)});
test('corrected amount does not duplicate baseline dividend',async()=>{const c=context();source(c);c.DATA.A.rows=[{'상품명':'ETF','기준일':row.recordDate,'배당단가':40}];await c.refreshAllDividends();assert.equal(c.USER_DIVS.length,0)});
test('manual and preexisting duplicate records are preserved',async()=>{const c=context();source(c);const d={account:'A',product:'ETF',baseDate:row.recordDate,payDate:row.payDate,unit:40,qty:99};c.USER_DIVS=[{...d,id:1},{...d,id:2}];await c.refreshAllDividends();assert.equal(c.USER_DIVS.length,2);assert.equal(c.USER_DIVS[0].unit,40);assert.equal(c.USER_DIVS[0].qty,99)});
test('same ETF is fetched once but allocated separately by account',async()=>{const c=context();c.names=['A','B'];c.BASE_HOLDINGS.B=[{'상품명':'ETF','수량':20}];c.DATA.B={rows:[]};const calls=source(c);await c.refreshAllDividends();assert.equal(calls(),1);assert.equal(c.USER_DIVS.length,2);assert.equal(c.USER_DIVS.find(x=>x.account==='B').qty,20)});
test('missing dates and reversed payment dates cannot be imported',async()=>{const c=context();source(c,[{...row,payDate:''},{...row,payDate:'2026-10-01'}]);await c.refreshAllDividends();assert.equal(c.USER_DIVS.length,0)});
test('an unchanged lookup does not write server state',async()=>{const c=context();source(c);let writes=0;c.saveServerState=async()=>{writes++};await c.refreshAllDividends();await c.refreshAllDividends();assert.equal(writes,1)});
test('a sold position is still checked for an earlier distribution',async()=>{const c=context();source(c);c.TRADES=[{account:'A',product:'ETF',date:'2026-10-20',type:'매도',qty:100,price:10}];await c.refreshAllDividends();assert.equal(c.USER_DIVS[0].qty,100)});
