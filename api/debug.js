// api/debug.js — diagnóstico de variáveis (remova após corrigir)
export default function handler(req, res) {
  const pwd = process.env.ADMIN_PASSWORD;
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  let tokenOk = false;
  if (token && pwd) {
    try {
      const d = Buffer.from(token,'base64').toString();
      const [p, dt] = d.split(':');
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
      tokenOk = p === pwd && (dt===today||dt===yesterday);
    } catch {}
  }

  return res.status(200).json({
    // Variáveis KV (banco de dados)
    KV_REST_API_URL:          process.env.KV_REST_API_URL         ? '✅ presente' : '❌ ausente',
    KV_REST_API_TOKEN:        process.env.KV_REST_API_TOKEN       ? '✅ presente' : '❌ ausente',
    KV_REST_API_READ_ONLY:    process.env.KV_REST_API_READ_ONLY_TOKEN ? '✅ presente' : '❌ ausente',
    KV_URL:                   process.env.KV_URL                  ? '✅ presente' : '❌ ausente',
    KV_REDIS_URL:             process.env.KV_REDIS_URL            ? '✅ presente' : '❌ ausente',
    UPSTASH_REDIS_REST_URL:   process.env.UPSTASH_REDIS_REST_URL  ? '✅ presente' : '❌ ausente',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN? '✅ presente' : '❌ ausente',
    // Blob (fotos)
    BLOB_READ_WRITE_TOKEN:    process.env.BLOB_READ_WRITE_TOKEN   ? '✅ presente' : '❌ ausente',
    // Admin
    ADMIN_PASSWORD:           process.env.ADMIN_PASSWORD          ? '✅ presente' : '❌ ausente',
    // Token
    token_recebido:           token ? '✅ sim' : '❌ não',
    token_valido:             tokenOk ? '✅ sim' : '❌ inválido',
  });
}
