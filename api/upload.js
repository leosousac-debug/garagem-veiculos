// api/upload.js — Cloudinary (sem SDK, via REST API)

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

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Cloudinary não configurado. Verifique as variáveis de ambiente.' });
  }

  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Nenhuma imagem recebida' });

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'garagem-veiculos';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;

    const crypto = await import('crypto');
    const signature = crypto.default
      .createHash('sha256')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const formData = new URLSearchParams();
    formData.append('file', data);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);
    formData.append('folder', folder);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      }
    );

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      throw new Error(`Cloudinary error ${uploadRes.status}: ${txt}`);
    }

    const result = await uploadRes.json();
    const url = result.secure_url.replace('/upload/', '/upload/q_auto,f_auto/');
    return res.status(200).json({ url });

  } catch (err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
