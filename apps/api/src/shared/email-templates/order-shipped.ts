import { baseEmailLayout } from './base-layout';

interface OrderShippedEmailData {
  userName: string;
  orderNumber: string;
  trackingCode: string;
  carrier?: string;
  itemTitle: string;
}

/**
 * Order shipped email sent when seller marks an item as shipped with tracking code.
 */
export function orderShippedEmailTemplate(data: OrderShippedEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const carrierInfo = data.carrier
    ? `<tr>
        <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Transportadora</td>
        <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${data.carrier}</td>
      </tr>`
    : '';

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Seu pedido foi enviado!
    </h2>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Ola, ${data.userName}! Um item do seu pedido foi enviado e esta a caminho.
    </p>
    <!-- Shipping details box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Item</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${data.itemTitle}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Pedido</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${data.orderNumber}</td>
            </tr>
            ${carrierInfo}
            <tr>
              <td style="color: #71717a; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 12px;">Codigo de Rastreio</td>
              <td align="right" style="color: #7C3AED; font-size: 16px; font-weight: 700; border-top: 1px solid #e4e4e7; padding-top: 12px; font-family: monospace;">${data.trackingCode}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Acompanhe o envio utilizando o codigo de rastreio acima nos Correios ou na transportadora informada.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${webUrl}/orders" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Acompanhar Pedido
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Seu pedido foi enviado! - ${data.orderNumber}`,
    html: baseEmailLayout(content),
  };
}
