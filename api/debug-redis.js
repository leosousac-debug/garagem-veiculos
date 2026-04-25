// api/debug-redis.js — Mostra TUDO que está no Redis
// Acesse: https://garageveiculos.vercel.app/api/debug-redis
// REMOVA este arquivo após o diagnóstico!

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
  const d=await r.json();
  return{ok:r.ok,status:r.status,result:d.result,error:d.error};
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS')return res.status(200).end();

  const cfg=getConfig();
  if(!cfg)return res.status(200).json({erro:'Redis não configurado'});

  const result={
    redis_url_prefix: process.env.KV_REST_API_URL?.slice(0,40)+'...',
    testes: {}
  };

  // Teste 1: KEYS veiculo:*
  const keys_raw=await rCmd(cfg,'KEYS','veiculo:*');
  result.testes.KEYS={
    http_status: keys_raw.status,
    ok: keys_raw.ok,
    result: keys_raw.result,
    error: keys_raw.error,
    total_chaves: Array.isArray(keys_raw.result)?keys_raw.result.length:null
  };

  // Teste 2: SCAN
  const scan_raw=await rCmd(cfg,'SCAN','0','MATCH','veiculo:*','COUNT','100');
  result.testes.SCAN={
    http_status: scan_raw.status,
    ok: scan_raw.ok,
    result: scan_raw.result,
    error: scan_raw.error
  };

  // Teste 3: DBSIZE (quantas chaves no total)
  const dbsize=await rCmd(cfg,'DBSIZE');
  result.testes.DBSIZE={total:dbsize.result};

  // Se KEYS funcionou, buscar cada veículo e mostrar status
  const keys=keys_raw.result;
  if(Array.isArray(keys)&&keys.length>0){
    result.veiculos=[];
    for(const k of keys){
      const v_raw=await rCmd(cfg,'GET',k);
      try{
        const v=JSON.parse(v_raw.result);
        result.veiculos.push({
          chave: k,
          id: v.id,
          marca: v.marca,
          modelo: v.modelo,
          status: v.status,
          status_tipo: typeof v.status,
          status_length: v.status?.length,
          status_chars: v.status?.split('').map(c=>c.charCodeAt(0))
        });
      }catch(e){
        result.veiculos.push({chave:k, erro:'JSON inválido', raw:String(v_raw.result).slice(0,100)});
      }
    }
  }

  return res.status(200).json(result);
}
