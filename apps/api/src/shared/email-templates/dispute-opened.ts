import { baseEmailLayout } from './base-layout';

interface DisputeOpenedEmailData {
  sellerName: string;
  orderNumber: string;
  reason: string;
  descriptionExcerpt: string;
  disputeId: string;
}

/**
 * Email enviado ao vendedor quando o comprador abre uma disputa.
 */
export function disputeOpenedEmailTemplate(data: DisputeOpenedEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const reasonLabels: Record<string, string> = {
    NOT_RECEIVED: 'Produto nao recebido',
    DIFFERENT_FROM_LISTING: 'Produto diferente do anuncio',
    DAMAGED_IN_TRANSIT: 'Produto danificado no transporte',
    NOT_SHIPPED_ON_TIME: 'Envio fora do prazo',
  };

  const reasonLabel = reasonLabels[data.reason] || data.reason;

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Disputa aberta no pedido #${data.orderNumber}
    </h2>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Ola, ${data.sellerName}. O comprador abriu uma disputa referente ao pedido
      <strong>#${data.orderNumber}</strong>. Por favor, analise os detalhes e responda o mais
      rapido possivel.
    </p>
    <!-- Dispute details box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Pedido</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">#${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Motivo</td>
              <td align="right" style="color: #dc2626; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${reasonLabel}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top: 1px solid #e4e4e7; padding-top: 12px;">
                <p style="margin: 0 0 4px 0; color: #71717a; font-size: 13px;">Descricao do comprador</p>
                <p style="margin: 0; color: #3f3f46; font-size: 14px; line-height: 1.5; font-style: italic;">
                  "${data.descriptionExcerpt}"
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: 600; line-height: 1.6;">
      Importante: Voce tem 48 horas para responder. Caso contrario, a disputa sera
      escalada automaticamente para mediacao.
    </p>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Acesse a pagina da disputa para visualizar todos os detalhes e enviar sua resposta.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${webUrl}/seller/disputes/${data.disputeId}" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Responder Disputa
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
      Recomendamos que voce mantenha a comunicacao pela plataforma para que todo o historico
      fique registrado.
    </p>
  `;

  return {
    subject: `Disputa aberta no pedido #${data.orderNumber}`,
    html: baseEmailLayout(content),
  };
}
