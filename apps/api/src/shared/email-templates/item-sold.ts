import { baseEmailLayout } from './base-layout';

interface ItemSoldEmailData {
  sellerName: string;
  orderNumber: string;
  itemTitle: string;
  salePrice: string;
  sellerNet: string;
}

/**
 * Item sold notification email sent to seller when their item is purchased.
 */
export function itemSoldEmailTemplate(data: ItemSoldEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Voce fez uma venda!
    </h2>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Parabens, ${data.sellerName}! Um comprador adquiriu um item da sua colecao.
    </p>
    <!-- Sale details box -->
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
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Valor da venda</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">R$ ${data.salePrice}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 12px;">Valor liquido</td>
              <td align="right" style="color: #16a34a; font-size: 18px; font-weight: 700; border-top: 1px solid #e4e4e7; padding-top: 12px;">R$ ${data.sellerNet}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Acesse seus pedidos para ver os detalhes e preparar o envio. Lembre-se de enviar
      o item o mais rapido possivel e informar o codigo de rastreamento.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${webUrl}/seller/orders" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Ver Pedido
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Voce fez uma venda! - ${data.itemTitle}`,
    html: baseEmailLayout(content),
  };
}
