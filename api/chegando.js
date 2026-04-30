// api/chegando.js — Veículos "Chegando em Breve" e "Em Vistoria"

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
  if(!r.ok){const t=await r.text().catch(()=>'');throw new Error('Redis '+r.status+': '+t.slice(0,100));}
  const d=await r.json();
  return d.result;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='GET')return res.status(405).json({error:'Metodo nao permitido'});

  const cfg=getConfig();
  if(!cfg)return res.status(200).json([]);

  try{
    // SCAN percorre todas as chaves (mais confiavel que KEYS no Vercel KV)
    let keys=[];
    let cursor='0';
    do{
      const r2=await rCmd(cfg,'SCAN',cursor,'MATCH','veiculo:*','COUNT','200');
      cursor=String(r2[0]);
      if(r2[1]&&r2[1].length)keys.push(...r2[1]);
    }while(cursor!=='0');

    if(!keys.length)return res.status(200).json([]);

    const vals=await Promise.all(keys.map(k=>rCmd(cfg,'GET',k).catch(()=>null)));
    const chegando=vals
      .filter(Boolean)
      .map(v=>{try{return JSON.parse(v);}catch{return null;}})
      .filter(v=>v&&(v.status==='Chegando em Breve'||v.status==='Em Vistoria'))
      .sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));

    return res.status(200).json(chegando);
  }catch(e){
    console.error('[chegando] ERRO:',e.message);
    return res.status(500).json({error:e.message});
  }
}
