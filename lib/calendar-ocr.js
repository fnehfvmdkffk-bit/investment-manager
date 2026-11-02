import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
// An inspected document cache, keyed by the exact image bytes, never by ticker/month alone.
const reviewedImages={
 '19363bf28b1c8ee94e3021496205247afe77c08d97825ba8f41a9e170238d042':{
  year:2026,month:10,recordDate:'2026-10-30',payDate:'2026-11-03',
  sourceUrl:'https://kbam.co.kr/media/tinymce/2026/10/bc7db64613cb43bb8e094c3df4e65632.png'
 }
};
const median=values=>{const xs=[...values].sort((a,b)=>a-b);return xs.length?xs[Math.floor(xs.length/2)]:0};
function dateOf(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?d.toISOString().slice(0,10):''}
function parseWords(tsv){return String(tsv||'').split(/\r?\n/).map(line=>line.split('\t')).filter(x=>x[0]==='5'&&x.length>=12&&x[11].trim()).map(x=>({text:x.slice(11).join('\t').trim(),x:+x[6],y:+x[7],w:+x[8],h:+x[9],confidence:+x[10]})).filter(x=>x.confidence>=70)}
function labelBoxes(words,label){
 const result=[];
 for(const first of words){
  if(!label.startsWith(first.text.replace(/\s/g,'')))continue;
  const row=words.filter(x=>Math.abs(x.y-first.y)<Math.max(first.h,x.h)*0.4&&x.x>=first.x).sort((a,b)=>a.x-b.x);
  let text='',end=first.x;
  for(const word of row.slice(0,6)){
   if(word.x>end+Math.max(first.h,word.h)*1.2)break;
   text+=word.text.replace(/\s/g,'');end=Math.max(end,word.x+word.w);
   if(text===label){result.push({cx:(first.x+end)/2,y:first.y});break}
   if(!label.startsWith(text))break;
  }
 }
 return result;
}
export function parseCalendarTsv(tsv,context){
 const year=Number(context.year),month=Number(context.month);if(!Number.isInteger(year)||year<2020||year>2100||month<1||month>12)return null;
 const words=parseWords(tsv),numbers=words.filter(x=>x.confidence>=80).map(x=>{
  const m=x.text.match(/^\(?(?:(\d{1,2})\/)?(\d{1,2})\)?$/);return m?{...x,month:m[1]?+m[1]:null,day:+m[2],cx:x.x+x.w/2,cy:x.y+x.h/2}:null;
 }).filter(x=>x&&x.day>=1&&x.day<=31&&(!x.month||x.month<=12));
 const rows=[];
 for(const word of numbers.sort((a,b)=>a.cy-b.cy)){let row=rows.find(r=>Math.abs(r.cy-word.cy)<Math.max(word.h,30)*0.7);if(!row){row={cy:word.cy,words:[]};rows.push(row)}row.words.push(word)}
 const grids=rows.filter(r=>r.words.length>=4).map(r=>{
  const ns=r.words.sort((a,b)=>a.cx-b.cx),gaps=[];
  for(let i=1;i<ns.length;i++){const diff=ns[i].day-ns[i-1].day;if(diff>=1&&diff<=3)gaps.push((ns[i].cx-ns[i-1].cx)/diff)}
  return {...r,words:ns,spacing:median(gaps)};
 }).filter(r=>r.spacing>20);
 const gridNumbers=grids.flatMap(r=>r.words),left=Math.min(...gridNumbers.map(x=>x.cx)),right=Math.max(...gridNumbers.map(x=>x.cx)),gridSpacing=(right-left)/6;
 if(!gridNumbers.length||gridSpacing<20||Math.abs(gridSpacing/median(grids.map(r=>r.spacing))-1)>.1)return null;
 function findDate(label){
  const candidates=[];
  for(const box of labelBoxes(words,label))for(const row of grids){
   const distance=box.y-row.cy;if(distance<15||distance>220)continue;
   const word=row.words.find(x=>Math.abs(x.cx-box.cx)<row.spacing*0.4);if(!word)continue;
   const marker=row.words.find(x=>x.month),m=word.month||marker?.month||month;
   const y=year+(m<month?1:0),date=dateOf(y,m,word.day);if(!date)continue;
   const column=(word.cx-left)/gridSpacing,columnIndex=Math.round(column);
   if(columnIndex<0||columnIndex>6||Math.abs(column-columnIndex)>.18||new Date(date+'T00:00:00Z').getUTCDay()!==columnIndex)continue;
   // A month marker in the same calendar row anchors the weekday columns.
   const anchor=marker||grids.flatMap(r=>r.words).find(x=>x.month);
   if(anchor){
    const anchorDate=dateOf(year+(anchor.month<month?1:0),anchor.month,anchor.day);if(!anchorDate)continue;
    const spacing=marker?row.spacing:median(grids.map(r=>r.spacing));
    const offset=(word.cx-anchor.cx)/spacing,rounded=Math.round(offset);
    if(Math.abs(offset-rounded)>0.18)continue;
    if((new Date(anchorDate+'T00:00:00Z').getUTCDay()+rounded+7)%7!==new Date(date+'T00:00:00Z').getUTCDay())continue;
   }
   candidates.push({date,distance});
  }
  return candidates.sort((a,b)=>a.distance-b.distance)[0]?.date||'';
 }
 const recordDate=findDate('지급기준일'),payDate=findDate('지급예정일');
 if(!recordDate||!payDate||!recordDate.startsWith(year+'-'+String(month).padStart(2,'0'))||payDate<recordDate||(Date.parse(payDate)-Date.parse(recordDate))/86400000>31)return null;
 return {recordDate,payDate};
}
let queue=Promise.resolve();
const memo=new Map();
export async function calendarFromImage(buffer,context,{forceOcr=false}={}){
 const sha256=createHash('sha256').update(buffer).digest('hex');
 const reviewed=reviewedImages[sha256];
 if(reviewed&&(reviewed.year!==Number(context.year)||reviewed.month!==Number(context.month)))return null;
 if(!forceOcr&&reviewed&&reviewed.year===Number(context.year)&&reviewed.month===Number(context.month)&&reviewed.sourceUrl===context.sourceUrl)return {recordDate:reviewed.recordDate,payDate:reviewed.payDate,sha256,method:'reviewed-image'};
 const key=sha256+'|'+context.year+'|'+context.month;if(memo.has(key))return memo.get(key);
 const job=queue.then(async()=>{
  const {PNG}=await import('pngjs');
  const png=PNG.sync.read(buffer);if(png.width*png.height>6000000)throw Error('calendar_image_too_large');
  // Remove colored highlights so their circle outlines cannot become false digits.
  for(let i=0;i<png.data.length;i+=4){const a=png.data[i+3]/255,l=(png.data[i]*.299+png.data[i+1]*.587+png.data[i+2]*.114)*a+255*(1-a),v=l<170?0:255;png.data[i]=png.data[i+1]=png.data[i+2]=v;png.data[i+3]=255}
  const {createWorker}=await import('tesseract.js');
  const langPath=path.join(path.dirname(require.resolve('@tesseract.js-data/kor/package.json')),'4.0.0');
  const worker=await createWorker('kor',1,{langPath,cacheMethod:'none',workerPath:require.resolve('tesseract.js/src/worker-script/node/index.js'),corePath:path.dirname(require.resolve('tesseract.js-core/tesseract-core.wasm.js'))});
  try{await worker.setParameters({tessedit_pageseg_mode:'11',user_defined_dpi:'150'});const {data}=await worker.recognize(PNG.sync.write(png),{}, {tsv:true});const dates=parseCalendarTsv(data.tsv,context);return dates?{...dates,sha256,method:'ocr-validated-calendar'}:null}finally{await worker.terminate()}
 });
 queue=job.catch(()=>{});memo.set(key,job);try{return await job}catch(e){memo.delete(key);throw e}
}
