// api/auth.js
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (password === ADMIN_PASSWORD) {
    // Token simples baseado em variável de ambiente + timestamp do dia
    // Válido por 24h (muda todo dia)
    const today = new Date().toISOString().split('T')[0];
    const token = Buffer.from(`${ADMIN_PASSWORD}:${today}`).toString('base64');
    return res.status(200).json({ token });
  }

  return res.status(401).json({ error: 'Senha incorreta' });
}
