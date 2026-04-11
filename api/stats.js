// api/stats.js — Likes (1 por IP) e Views globais via Redis
// GET  /api/stats            → { likes: { id: { total } }, views: { id: N } }
// POST /api/stats body       → { action: 'like'|'unlike'|'view', id }

function getConfig(){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||process.env.KV_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token) return null;
  return { url: url.replace(/\/$/,''), token };
}

async function rCmd(cfg, ...args){
  const r = await fetch(cfg.url, {
    method:'POST',
    headers:{ Authorization:`Bearer ${cfg.token}`, 'Content-Type':'application/json' },
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  if(!r.ok) throw new Error(`Redis ${r.status}: ${txt}`);
  return JSON.parse(txt).result;
}

// Hash simples do IP para anonimizar (não armazenamos o IP bruto)
function hashIP(ip){
  let h=0;
  for(let i=0;i<ip.length;i++){ h=((h<<5)-h)+ip.charCodeAt(i); h|=0; }
  return Math.abs(h).toString(36);
}

function getClientIP(req){
  return (req.headers['x-forwarded-for']||'').split(',')[0].trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || 'unknown';
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();

  const cfg = getConfig();

  // GET — retorna todos os stats
  if(req.method==='GET'){
    if(!cfg) return res.status(200).json({ likes:{}, views:{} });
    try{
      const [likeKeys, viewKeys] = await Promise.all([
        rCmd(cfg,'KEYS','stat:like:*'),
        rCmd(cfg,'KEYS','stat:view:*')
      ]);
      const likes={}, views={};
      if(likeKeys?.length){
        const vals=await Promise.all(likeKeys.map(k=>rCmd(cfg,'GET',k)));
        likeKeys.forEach((k,i)=>{
          const id=k.replace('stat:like:','');
          likes[id]={total:parseInt(vals[i]||0)};
        });
      }
      if(viewKeys?.length){
        const vals=await Promise.all(viewKeys.map(k=>rCmd(cfg,'GET',k)));
        viewKeys.forEach((k,i)=>{
          const id=k.replace('stat:view:','');
          views[id]=parseInt(vals[i]||0);
        });
      }
      return res.status(200).json({ likes, views });
    }catch(err){ return res.status(500).json({error:err.message}); }
  }

  // POST — registrar ação
  if(req.method==='POST'){
    const { action, id } = req.body||{};
    if(!action||!id) return res.status(400).json({error:'action e id obrigatórios'});
    if(!cfg) return res.status(200).json({total:0}); // fallback silencioso

    try{
      if(action==='view'){
        await rCmd(cfg,'INCR',`stat:view:${id}`);
        const total=await rCmd(cfg,'GET',`stat:view:${id}`);
        return res.status(200).json({ total: parseInt(total||0) });
      }

      if(action==='like'||action==='unlike'){
        const ip = getClientIP(req);
        const ipHash = hashIP(ip);
        const ipKey = `stat:liked:${id}:${ipHash}`; // rastro anônimo deste IP

        const alreadyLiked = await rCmd(cfg,'EXISTS',ipKey);

        if(action==='like'){
          if(alreadyLiked){
            // IP já curtiu — retorna o total atual sem incrementar
            const total=await rCmd(cfg,'GET',`stat:like:${id}`);
            return res.status(200).json({ total:parseInt(total||0), alreadyLiked:true });
          }
          // Novo like: incrementa contador e marca o IP (expira em 30 dias)
          await Promise.all([
            rCmd(cfg,'INCR',`stat:like:${id}`),
            rCmd(cfg,'SET',ipKey,'1','EX',String(30*24*3600))
          ]);
          const total=await rCmd(cfg,'GET',`stat:like:${id}`);
          return res.status(200).json({ total:parseInt(total||0), alreadyLiked:false });
        }

        if(action==='unlike'){
          if(!alreadyLiked){
            const total=await rCmd(cfg,'GET',`stat:like:${id}`);
            return res.status(200).json({ total:parseInt(total||0) });
          }
          // Remove o rastro do IP e decrementa
          const cur=await rCmd(cfg,'GET',`stat:like:${id}`);
          const newVal=Math.max(0,parseInt(cur||0)-1);
          await Promise.all([
            rCmd(cfg,'SET',`stat:like:${id}`,String(newVal)),
            rCmd(cfg,'DEL',ipKey)
          ]);
          return res.status(200).json({ total:newVal });
        }
      }

      return res.status(400).json({error:'action inválido'});
    }catch(err){
      console.error('stats error:',err.message);
      return res.status(500).json({error:err.message});
    }
  }

  return res.status(405).end();
}
