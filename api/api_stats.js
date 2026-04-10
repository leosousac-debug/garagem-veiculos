// api/stats.js — Likes e Views globais (Redis)
// GET  /api/stats            → retorna { likes: {id: {total}}, views: {id: N} }
// POST /api/stats body {action:'like'|'unlike'|'view', id}

function getConfig(){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||process.env.KV_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return null;
  return{url:url.replace(/\/$/,''),token};
}
async function rCmd(cfg,...args){
  const r=await fetch(cfg.url,{method:'POST',headers:{Authorization:`Bearer ${cfg.token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const txt=await r.text();
  if(!r.ok)throw new Error(`Redis ${r.status}: ${txt}`);
  return JSON.parse(txt).result;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();

  const cfg=getConfig();
  if(!cfg){
    // Sem Redis: retorna vazio (frontend usa fallback localStorage)
    if(req.method==='GET')return res.status(200).json({likes:{},views:{}});
    return res.status(200).json({total:0});
  }

  // GET — todos os stats
  if(req.method==='GET'){
    try{
      const likeKeys=await rCmd(cfg,'KEYS','stat:like:*');
      const viewKeys=await rCmd(cfg,'KEYS','stat:view:*');
      const likes={};const views={};
      if(likeKeys&&likeKeys.length){
        const vals=await Promise.all(likeKeys.map(k=>rCmd(cfg,'GET',k)));
        likeKeys.forEach((k,i)=>{const id=k.replace('stat:like:','');likes[id]={total:parseInt(vals[i]||0)};});
      }
      if(viewKeys&&viewKeys.length){
        const vals=await Promise.all(viewKeys.map(k=>rCmd(cfg,'GET',k)));
        viewKeys.forEach((k,i)=>{const id=k.replace('stat:view:','');views[id]=parseInt(vals[i]||0);});
      }
      return res.status(200).json({likes,views});
    }catch(err){return res.status(500).json({error:err.message});}
  }

  // POST — registrar like/unlike/view
  if(req.method==='POST'){
    try{
      const{action,id}=req.body||{};
      if(!action||!id)return res.status(400).json({error:'action e id obrigatórios'});
      if(action==='view'){
        await rCmd(cfg,'INCR',`stat:view:${id}`);
        const total=await rCmd(cfg,'GET',`stat:view:${id}`);
        return res.status(200).json({total:parseInt(total||0)});
      }
      if(action==='like'){
        await rCmd(cfg,'INCR',`stat:like:${id}`);
        const total=await rCmd(cfg,'GET',`stat:like:${id}`);
        return res.status(200).json({total:parseInt(total||0)});
      }
      if(action==='unlike'){
        const cur=await rCmd(cfg,'GET',`stat:like:${id}`);
        const newVal=Math.max(0,parseInt(cur||0)-1);
        await rCmd(cfg,'SET',`stat:like:${id}`,String(newVal));
        return res.status(200).json({total:newVal});
      }
      return res.status(400).json({error:'action inválido'});
    }catch(err){return res.status(500).json({error:err.message});}
  }
  return res.status(405).end();
}
