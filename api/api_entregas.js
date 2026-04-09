// api/entregas.js — CRUD de entregas (usa mesmo Redis do veículos)

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  const PWD = process.env.ADMIN_PASSWORD;
  if (!PWD) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [pwd, dateStr] = decoded.split(':');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return pwd === PWD && (dateStr === today || dateStr === yesterday);
  } catch { return false; }
}

function getConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function rCmd(cfg, ...args) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Redis error ${r.status}: ${txt}`);
  return JSON.parse(txt).result;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cfg = getConfig();

  if (req.method === 'GET') {
    if (!cfg) return res.status(200).json([]);
    try {
      const keys = await rCmd(cfg, 'KEYS', 'entrega:*');
      if (!keys || !keys.length) return res.status(200).json([]);
      const values = await Promise.all(keys.map(k => rCmd(cfg, 'GET', k).then(v => v ? JSON.parse(v) : null)));
      const lista = values.filter(Boolean).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
      return res.status(200).json(lista);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (!verifyToken(req)) return res.status(401).json({ error: 'Não autorizado' });
  if (!cfg) return res.status(500).json({ error: 'Redis não configurado' });

  if (req.method === 'POST') {
    try {
      const id = uid();
      const entrega = { ...req.body, id, criadoEm: Date.now() };
      await rCmd(cfg, 'SET', `entrega:${id}`, JSON.stringify(entrega));
      return res.status(201).json(entrega);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const raw = await rCmd(cfg, 'GET', `entrega:${id}`);
      if (!raw) return res.status(404).json({ error: 'Não encontrado' });
      const updated = { ...JSON.parse(raw), ...req.body, id, atualizadoEm: Date.now() };
      await rCmd(cfg, 'SET', `entrega:${id}`, JSON.stringify(updated));
      return res.status(200).json(updated);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      await rCmd(cfg, 'DEL', `entrega:${id}`);
      return res.status(200).json({ ok: true });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
