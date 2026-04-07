// api/upload.js — Vercel Blob via REST (sem SDK @vercel/blob)

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

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!verifyToken(req)) return res.status(401).json({ error: 'Não autorizado' });

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado' });

  try {
    const { filename, data } = req.body;
    if (!data) return res.status(400).json({ error: 'Nenhuma imagem recebida' });

    // Remove prefixo data:image/...;base64,
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const ext = (filename || 'foto.jpg').split('.').pop().toLowerCase() || 'jpg';
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mime = mimeMap[ext] || 'image/jpeg';
    const blobName = `veiculos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // PUT direto na API do Vercel Blob
    const blobRes = await fetch(`https://blob.vercel-storage.com/${blobName}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${blobToken}`,
        'Content-Type': mime,
        'x-content-type': mime,
      },
      body: buffer
    });

    if (!blobRes.ok) {
      const txt = await blobRes.text();
      throw new Error(`Blob error ${blobRes.status}: ${txt}`);
    }

    const blobData = await blobRes.json();
    return res.status(200).json({ url: blobData.url });
  } catch (err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
