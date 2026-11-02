import {resolveCode} from '../lib/etf-codes.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
 const name=String(req.query?.name||'').trim();if(!name)return res.status(400).json({error:'name_required'});
 try{const code=await resolveCode(name);return code?res.status(200).json({code}):res.status(404).json({error:'code_not_found'})}
 catch{return res.status(502).json({error:'lookup_unavailable'})}
}
