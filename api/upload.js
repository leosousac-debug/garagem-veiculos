// api/upload.js
import { put } from '@vercel/blob';

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
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return pwd === ADMIN_PASSWORD && (dateStr === today || dateStr === yesterday);
  } catch { return false; }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyToken(req)) return res.status(401).json({ error: 'Não autorizado' });
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { filename, data } = req.body;
    // data é base64
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = filename.split('.').pop() || 'jpg';
    const name = `veiculos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blob = await put(name, buffer, { access: 'public', contentType: `image/${ext}` });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
