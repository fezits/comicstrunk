import { baseEmailLayout } from './base-layout';

interface PaymentConfirmedEmailData {
  userName: string;
  orderNumber: string;
  totalAmount: string;
  itemCount: number;
}

/**
 * Payment confirmation email sent when order payment succeeds.
 */
export function paymentConfirmedEmailTemplate(data: PaymentConfirmedEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Pagamento confirmado!
    </h2>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Ola, ${data.userName}! O pagamento do seu pedido foi confirmado com sucesso.
    </p>
    <!-- Order summary box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Pedido</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Itens</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${data.itemCount}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 12px;">Total</td>
              <td align="right" style="color: #7C3AED; font-size: 18px; font-weight: 700; border-top: 1px solid #e4e4e7; padding-top: 12px;">R$ ${data.totalAmount}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Os vendedores serao notificados e prepararao seus itens para envio. Voce recebera
      atualizacoes de rastreamento assim que cada item for enviado.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${webUrl}/orders" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Ver Pedido
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Pagamento confirmado - Pedido ${data.orderNumber}`,
    html: baseEmailLayout(content),
  };
}
