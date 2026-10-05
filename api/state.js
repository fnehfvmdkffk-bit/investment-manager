import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';
const pw=()=>process.env.APP_PASSWORD||process.env.app_password||'';
const session=p=>crypto.createHmac('sha256',p).update('im-session').digest('hex');
function ok(req){const p=pw();if(!p)return false;const c=String(req.headers.cookie||'');const m=c.match(/(?:^|; )im_session=([^;]+)/);if(!m)return false;const a=Buffer.from(m[1]),b=Buffer.from(session(p));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!ok(req))return res.status(401).json({error:'unauthorized'});
 if(req.method==='GET'){
  try{const r=await get('investment-data.json',{access:'private'});if(!r||r.statusCode!==200)return res.status(200).json({trades:[],dividends:[]});const t=await new Response(r.stream).text();return res.status(200).json(JSON.parse(t))}
  catch(e){return res.status(200).json({trades:[],dividends:[]})}
 }
 if(req.method==='PUT'){
  const trades=Array.isArray(req.body?.trades)?req.body.trades:[],dividends=Array.isArray(req.body?.dividends)?req.body.dividends:[];
  if(trades.length>10000||dividends.length>10000)return res.status(413).json({error:'too_large'});
  await put('investment-data.json',JSON.stringify({trades,dividends,updatedAt:new Date().toISOString()}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
  return res.status(200).json({ok:true});
 }
 return res.status(405).end();
}