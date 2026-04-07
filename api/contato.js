// api/contato.js — Envia e-mail via Resend (https://resend.com — gratuito 100/dia)
// Variável necessária: RESEND_API_KEY e CONTACT_EMAIL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, fone, email, assunto, msg } = req.body || {};

  if (!nome || !fone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const DEST_EMAIL  = process.env.CONTACT_EMAIL || 'seuemail@gmail.com';

  const assuntoMap = {
    interesse:      'Interesse em veículo',
    proposta:       'Proposta de compra',
    financiamento:  'Dúvida sobre financiamento',
    troca:          'Troca de veículo',
    outro:          'Outro assunto',
  };
  const assuntoLabel = assuntoMap[assunto] || assunto || 'Contato via site';

  const emailBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" style="max-width:600px;margin:0 auto;background:#fff">
  <tr><td style="background:#0a0d14;padding:20px 30px;border-bottom:4px solid #cc1f1f">
    <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#fff;letter-spacing:3px">GARAGE VEÍCULOS</div>
    <div style="font-size:11px;color:#cc1f1f;letter-spacing:4px;margin-top:2px">ARAGUARI MG</div>
  </td></tr>
  <tr><td style="padding:30px">
    <div style="background:#cc1f1f;color:#fff;display:inline-block;padding:4px 14px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px">NOVO CONTATO</div>
    <h2 style="font-size:18px;color:#0a0d14;margin:0 0 20px">${assuntoLabel}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:13px;width:120px">Nome</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600">${nome}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:13px">WhatsApp</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600"><a href="https://wa.me/55${fone.replace(/\D/g,'')}" style="color:#cc1f1f">${fone}</a></td></tr>
      ${email ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:13px">E-mail</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px"><a href="mailto:${email}" style="color:#cc1f1f">${email}</a></td></tr>` : ''}
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:13px">Assunto</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px">${assuntoLabel}</td></tr>
    </table>
    ${msg ? `<div style="margin-top:20px;background:#f9f9f9;padding:16px;border-left:3px solid #cc1f1f">
      <div style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">MENSAGEM</div>
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6">${msg.replace(/\n/g,'<br>')}</p>
    </div>` : ''}
    <div style="margin-top:24px">
      <a href="https://wa.me/55${fone.replace(/\D/g,'')}" style="display:inline-block;background:#25d366;color:#fff;padding:12px 28px;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:1px">RESPONDER NO WHATSAPP</a>
    </div>
  </td></tr>
  <tr><td style="background:#0a0d14;padding:16px 30px;text-align:center">
    <div style="font-size:11px;color:#6a7a9a">Este e-mail foi gerado automaticamente pelo site Garage Veiculos</div>
    <div style="font-size:11px;color:#444;margin-top:4px">${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</div>
  </td></tr>
</table>
</body>
</html>`;

  // --- Tenta enviar via Resend ---
  if (RESEND_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'Garage Veiculos <onboarding@resend.dev>',
          to:      [DEST_EMAIL],
          subject: `[Site] ${assuntoLabel} — ${nome}`,
          html:    emailBody,
          reply_to: email || undefined,
        }),
      });

      if (r.ok) {
        console.log('Email enviado via Resend para', DEST_EMAIL);
        return res.status(200).json({ ok: true, via: 'resend' });
      } else {
        const err = await r.text();
        console.error('Resend error:', err);
        // Não falha: retorna ok mesmo assim (cliente já abriu WhatsApp como fallback)
        return res.status(200).json({ ok: true, via: 'fallback', warn: err });
      }
    } catch (e) {
      console.error('Resend exception:', e.message);
    }
  } else {
    console.warn('RESEND_API_KEY nao configurada — email nao enviado. Configure em Vercel > Settings > Env Vars.');
  }

  // Sem Resend configurado: retorna ok (frontend usa WhatsApp como fallback)
  return res.status(200).json({ ok: true, via: 'whatsapp-only' });
}
