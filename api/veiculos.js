// api/veiculos.js
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [pwd, dateStr] = decoded.split(':');
    const today = new Date().toISOString().split('T')[0];
    // Aceita token do dia atual e do dia anterior (janela de 48h para não travar)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return pwd === ADMIN_PASSWORD && (dateStr === today || dateStr === yesterday);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET público - lista veículos ativos
  if (req.method === 'GET') {
    try {
      const keys = await kv.keys('veiculo:*');
      if (!keys || keys.length === 0) return res.status(200).json([]);

      const veiculos = await Promise.all(keys.map(k => kv.get(k)));
      const ativos = veiculos
        .filter(v => v !== null)
        .filter(v => req.query.admin === '1' || v.status === 'Ativo')
        .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

      return res.status(200).json(ativos);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Rotas protegidas abaixo
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // POST - criar veículo
  if (req.method === 'POST') {
    try {
      const id = uuidv4();
      const veiculo = {
        ...req.body,
        id,
        criadoEm: Date.now(),
        status: req.body.status || 'Ativo'
      };
      await kv.set(`veiculo:${id}`, veiculo);
      return res.status(201).json(veiculo);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT - atualizar veículo
  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      const existing = await kv.get(`veiculo:${id}`);
      if (!existing) return res.status(404).json({ error: 'Não encontrado' });

      const updated = { ...existing, ...req.body, id, atualizadoEm: Date.now() };
      await kv.set(`veiculo:${id}`, updated);
      return res.status(200).json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE - excluir veículo
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      await kv.del(`veiculo:${id}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
