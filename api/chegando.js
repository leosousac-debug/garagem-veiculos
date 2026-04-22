// api/chegando.js — Rota PÚBLICA dedicada para veículos "Chegando em Breve" e "Em Vistoria"
// GET /api/chegando → retorna veículos com status Chegando em Breve ou Em Vistoria
// Sem autenticação — dados públicos

function getConfig(){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||process.env.KV_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return null;
  return{url:url.replace(/\/$/,''),token};
}

async function rCmd(cfg,cmd,...args){
  const body=JSON.stringify([cmd,...args]);
  const r=await fetch(cfg.url,{
    method:'POST',
    headers:{'Authorization':'Bearer '+cfg.token,'Content-Type':'application/json'},
    body
  });
  if(!r.ok)throw new Error('Redis '+r.status);
  const d=await r.json();
  return d.result;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});

  const cfg=getConfig();
  if(!cfg)return res.status(200).json([]);

  try{
    const keys=await rCmd(cfg,'KEYS','veiculo:*');
    if(!keys||!keys.length)return res.status(200).json([]);

    const vals=await Promise.all(keys.map(k=>rCmd(cfg,'GET',k)));
    const chegando=vals
      .filter(Boolean)
      .map(v=>{try{return JSON.parse(v);}catch{return null;}})
      .filter(v=>v&&(v.status==='Chegando em Breve'||v.status==='Em Vistoria'))
      .sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));

    return res.status(200).json(chegando);
  }catch(e){
    console.error('GET /api/chegando error:',e);
    return res.status(500).json({error:e.message});
  }
}
