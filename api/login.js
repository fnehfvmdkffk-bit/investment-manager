import crypto from 'node:crypto';
const pw=()=>process.env.APP_PASSWORD||process.env.app_password||'';
const session=p=>crypto.createHmac('sha256',p).update('im-session').digest('hex');
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).end();
 const p=pw(), supplied=String(req.body?.password||'');
 if(!p) return res.status(500).json({error:'config'});
 const a=Buffer.from(supplied), b=Buffer.from(p);
 if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'invalid'});
 res.setHeader('Set-Cookie','im_session='+session(p)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000');
 return res.status(200).json({ok:true});
}