/**
 * emailService.js
 * Envio de e-mail via Gmail SMTP (Nodemailer) com a DANFE em anexo.
 */

import nodemailer from "nodemailer";

function getTransporter() {
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!user || !pass) throw new Error("SMTP não configurado (SMTP_USER / SMTP_PASS)");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

/**
 * Envia e-mail com a DANFE em anexo ao cliente.
 * @param {object} opts
 * @param {object} opts.pedido       - documento do Firestore
 * @param {Buffer} opts.danfePdfBuffer - PDF da DANFE
 * @param {string} opts.chaveAcesso  - chave de 44 dígitos da NF-e
 * @param {string} opts.numero       - número da NF-e
 * @param {string} opts.serie        - série da NF-e
 */
export async function sendNotaFiscalEmail({ pedido, danfePdfBuffer, chaveAcesso, numero, serie }) {
  const transporter = getTransporter();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const to = String(pedido?.cliente?.email || "").trim();

  if (!to) throw new Error("E-mail do cliente não preenchido no pedido");

  const nomeCliente = String(pedido?.cliente?.nome || "Cliente").trim();
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const dataEmissao = formatDate(new Date().toISOString());
  const chaveFormatada = String(chaveAcesso || "").replace(/(\d{4})/g, "$1 ").trim();
  const nfNumero = String(numero || "").padStart(9, "0");
  const nfSerie = String(serie || "1").padStart(3, "0");

  const itensHtml = itens
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.nome || "Produto"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantidade || 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatCurrency(item.preco)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatCurrency((item.preco || 0) * (item.quantidade || 1))}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#7c3aed;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px;">Zuca Personalizados</h1>
            <p style="margin:6px 0 0;color:#ddd6fe;font-size:13px;">Nota Fiscal Eletrônica</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;">Olá, <strong>${nomeCliente}</strong>!</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
              Sua Nota Fiscal Eletrônica foi emitida com sucesso. O arquivo DANFE está em anexo neste e-mail.
            </p>

            <!-- NF-e info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#6b7280;width:40%;">Número / Série</td>
                      <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:bold;">${nfNumero} / ${nfSerie}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#6b7280;">Data de Emissão</td>
                      <td style="padding:4px 0;font-size:13px;color:#111827;">${dataEmissao}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#6b7280;vertical-align:top;">Chave de Acesso</td>
                      <td style="padding:4px 0;font-size:11px;color:#374151;word-break:break-all;font-family:monospace;">${chaveFormatada}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Itens -->
            <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#374151;">Itens do pedido</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Produto</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">Qtd</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Unit.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itensHtml}
              </tbody>
            </table>

            <!-- Totais -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              ${pedido.frete?.valor ? `
              <tr>
                <td style="font-size:13px;color:#6b7280;padding:3px 0;">Frete (${pedido.frete.servico || ""})</td>
                <td style="font-size:13px;color:#374151;text-align:right;padding:3px 0;">${formatCurrency(pedido.frete.valor)}</td>
              </tr>` : ""}
              ${pedido.desconto > 0 ? `
              <tr>
                <td style="font-size:13px;color:#6b7280;padding:3px 0;">Desconto</td>
                <td style="font-size:13px;color:#16a34a;text-align:right;padding:3px 0;">-${formatCurrency(pedido.desconto)}</td>
              </tr>` : ""}
              <tr>
                <td style="font-size:15px;font-weight:bold;color:#111827;padding:8px 0 0;">Total</td>
                <td style="font-size:15px;font-weight:bold;color:#7c3aed;text-align:right;padding:8px 0 0;">${formatCurrency(pedido.total)}</td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
              Você pode consultar sua NF-e no portal da SEFAZ:
              <a href="https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx" style="color:#7c3aed;">nfe.fazenda.gov.br</a>
              usando a chave de acesso acima.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Zuca Personalizados — Campo Grande, MS<br>
              Este é um e-mail automático, não responda.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to,
    subject: `Nota Fiscal Eletrônica — Pedido #${String(pedido.id || "").slice(0, 8).toUpperCase()}`,
    html,
    attachments: [
      {
        filename: `NF-e_${nfNumero}.pdf`,
        content: danfePdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
