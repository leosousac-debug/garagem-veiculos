// api/veiculos.js — CRUD de veículos com Redis (Vercel KV / Upstash)
// GET    /api/veiculos              → lista pública (Ativo + Chegando em Breve + Em Vistoria)
// GET    /api/veiculos?admin=1      → lista completa (todos os status)
// GET    /api/veiculos?status=todos → todos os status visíveis (mesmo que público)
// POST   /api/veiculos              → criar veículo (autenticado)
// PUT    /api/veiculos?id=X         → atualizar veículo (autenticado)
// DELETE /api/veiculos?id=X         → excluir veículo (autenticado)

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

function verifyToken(req){
  const auth=req.headers['authorization']||'';
  const token=auth.replace('Bearer ','').trim();
  if(!token)return false;
  // Token válido por 24h: hash diário
  const today=new Date().toISOString().slice(0,10).replace(/-/g,'');
  const pwd=process.env.ADMIN_PASSWORD||'garage2024';
  const expected=Buffer.from(pwd+today).toString('base64');
  // Aceitar também token do dia anterior (evita logout na virada do dia)
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10).replace(/-/g,'');
  const expectedYest=Buffer.from(pwd+yesterday).toString('base64');
  return token===expected||token===expectedYest;
}

function uid(){
  return Date.now().toString(36)+Math.random().toString(36).slice(2,6);
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  if(req.method==='OPTIONS')return res.status(200).end();

  const cfg=getConfig();

  // ── SEM REDIS: fallback vazio ─────────────────────────────────────────────
  if(!cfg){
    if(req.method==='GET')return res.status(200).json([]);
    return res.status(503).json({error:'Redis não configurado. Verifique KV_REST_API_URL e KV_REST_API_TOKEN nas variáveis de ambiente do Vercel.'});
  }

  // ── GET ───────────────────────────────────────────────────────────────────
  if(req.method==='GET'){
    try{
      const keys=await rCmd(cfg,'KEYS','veiculo:*');
      if(!keys||!keys.length)return res.status(200).json([]);
      const vals=await Promise.all(keys.map(k=>rCmd(cfg,'GET',k)));
      let veiculos=vals
        .filter(Boolean)
        .map(v=>{try{return JSON.parse(v);}catch{return null;}})
        .filter(Boolean)
        .sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));

      const isAdmin=req.query.admin==='1'||verifyToken(req);
      const statusTodos=req.query.status==='todos';

      if(isAdmin){
        // Admin: retorna todos os status
        return res.status(200).json(veiculos);
      }else if(statusTodos){
        // Público com todos os status visíveis (Ativo + Chegando + Em Vistoria)
        veiculos=veiculos.filter(v=>
          v.status==='Ativo'||
          v.status==='Chegando em Breve'||
          v.status==='Em Vistoria'
        );
        return res.status(200).json(veiculos);
      }else{
        // Público padrão: Ativo + Chegando em Breve + Em Vistoria
        // (IMPORTANTE: inclui Chegando para aparecer na página Chegando)
        veiculos=veiculos.filter(v=>
          v.status==='Ativo'||
          v.status==='Chegando em Breve'||
          v.status==='Em Vistoria'
        );
        return res.status(200).json(veiculos);
      }
    }catch(e){
      console.error('GET veiculos error:',e);
      return res.status(500).json({error:e.message});
    }
  }

  // ── AUTENTICAÇÃO para métodos de escrita ──────────────────────────────────
  if(!verifyToken(req)){
    return res.status(401).json({error:'Não autorizado'});
  }

  // ── POST — criar veículo ──────────────────────────────────────────────────
  if(req.method==='POST'){
    try{
      const data={...req.body};
      if(!data.id)data.id=uid();
      if(!data.criadoEm)data.criadoEm=Date.now();
      data.atualizadoEm=Date.now();
      await rCmd(cfg,'SET','veiculo:'+data.id,JSON.stringify(data));
      return res.status(201).json(data);
    }catch(e){
      return res.status(500).json({error:e.message});
    }
  }

  // ── PUT — atualizar veículo ───────────────────────────────────────────────
  if(req.method==='PUT'){
    const{id}=req.query;
    if(!id)return res.status(400).json({error:'ID obrigatório'});
    try{
      const existing=await rCmd(cfg,'GET','veiculo:'+id);
      const old=existing?JSON.parse(existing):{};
      const data={...old,...req.body,id,atualizadoEm:Date.now()};
      await rCmd(cfg,'SET','veiculo:'+id,JSON.stringify(data));
      return res.status(200).json(data);
    }catch(e){
      return res.status(500).json({error:e.message});
    }
  }

  // ── DELETE — excluir veículo ──────────────────────────────────────────────
  if(req.method==='DELETE'){
    const{id}=req.query;
    if(!id)return res.status(400).json({error:'ID obrigatório'});
    try{
      await rCmd(cfg,'DEL','veiculo:'+id);
      return res.status(200).json({deleted:true,id});
    }catch(e){
      return res.status(500).json({error:e.message});
    }
  }

  return res.status(405).json({error:'Método não permitido'});
}
