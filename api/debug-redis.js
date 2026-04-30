// api/debug-redis.js — TEMPORARIO, remova apos diagnostico

function getConfig(){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||process.env.KV_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return null;
  return{url:url.replace(/\/$/,''),token};
}

async function rCmd(cfg,cmd,...args){
  const body=JSON.stringify([cmd,...args]);
  const r=await fetch(cfg.url,{method:'POST',
    headers:{'Authorization':'Bearer '+cfg.token,'Content-Type':'application/json'},body});
  const d=await r.json();
  return{ok:r.ok,status:r.status,result:d.result,error:d.error};
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const cfg=getConfig();
  if(!cfg)return res.status(200).json({erro:'Redis nao configurado'});

  const result={};

  // Teste com KEYS
  const k=await rCmd(cfg,'KEYS','veiculo:*');
  result.KEYS={http_status:k.status,ok:k.ok,total:Array.isArray(k.result)?k.result.length:null,erro:k.error};

  // Teste com SCAN
  const s=await rCmd(cfg,'SCAN','0','MATCH','veiculo:*','COUNT','100');
  result.SCAN={http_status:s.status,ok:s.ok,cursor:s.result&&s.result[0],chaves_encontradas:s.result&&s.result[1],erro:s.error};

  // Total de chaves no Redis
  const db=await rCmd(cfg,'DBSIZE');
  result.DBSIZE_total=db.result;

  // Mostrar cada veiculo com status exato
  if(Array.isArray(k.result)&&k.result.length){
    result.veiculos=[];
    for(const key of k.result){
      const v=await rCmd(cfg,'GET',key);
      try{
        const obj=JSON.parse(v.result);
        result.veiculos.push({
          chave:key,
          marca:obj.marca,
          modelo:obj.modelo,
          status:obj.status,
          status_json:JSON.stringify(obj.status)
        });
      }catch(e){
        result.veiculos.push({chave:key,erro:'JSON invalido',raw:String(v.result).slice(0,80)});
      }
    }
  }

  res.setHeader('Content-Type','application/json');
  return res.status(200).end(JSON.stringify(result,null,2));
}
