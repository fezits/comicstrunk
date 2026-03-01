import { baseEmailLayout } from './base-layout';

interface DisputeResolvedEmailData {
  userName: string;
  orderNumber: string;
  disputeId: string;
  resolutionType: 'RESOLVED_REFUND' | 'RESOLVED_PARTIAL_REFUND' | 'RESOLVED_NO_REFUND';
  justification: string;
  refundAmount?: string;
  role: 'buyer' | 'seller';
}

/**
 * Email enviado a ambas as partes quando uma disputa e resolvida.
 * Conteudo varia conforme o papel (comprador vs vendedor).
 */
export function disputeResolvedEmailTemplate(data: DisputeResolvedEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const resolutionLabels: Record<string, string> = {
    RESOLVED_REFUND: 'Reembolso total',
    RESOLVED_PARTIAL_REFUND: 'Reembolso parcial',
    RESOLVED_NO_REFUND: 'Sem reembolso',
  };

  const resolutionLabel = resolutionLabels[data.resolutionType] || data.resolutionType;

  const resolutionColors: Record<string, string> = {
    RESOLVED_REFUND: '#16a34a',
    RESOLVED_PARTIAL_REFUND: '#ca8a04',
    RESOLVED_NO_REFUND: '#dc2626',
  };

  const resolutionColor = resolutionColors[data.resolutionType] || '#3f3f46';

  const isBuyer = data.role === 'buyer';

  const introText = isBuyer
    ? `Ola, ${data.userName}. A disputa referente ao pedido <strong>#${data.orderNumber}</strong> foi analisada e resolvida pela equipe do Comics Trunk.`
    : `Ola, ${data.userName}. A disputa aberta pelo comprador referente ao pedido <strong>#${data.orderNumber}</strong> foi analisada e resolvida.`;

  const refundRow =
    data.refundAmount && data.resolutionType !== 'RESOLVED_NO_REFUND'
      ? `
            <tr>
              <td style="color: #71717a; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 12px;">Valor do reembolso</td>
              <td align="right" style="color: ${isBuyer ? '#16a34a' : '#dc2626'}; font-size: 18px; font-weight: 700; border-top: 1px solid #e4e4e7; padding-top: 12px;">R$ ${data.refundAmount}</td>
            </tr>`
      : '';

  const nextStepsText = isBuyer
    ? data.resolutionType === 'RESOLVED_NO_REFUND'
      ? 'A disputa foi encerrada sem reembolso. Se voce discorda da decisao, entre em contato com nosso suporte.'
      : 'O valor do reembolso sera creditado conforme o metodo de pagamento original. O prazo pode variar de acordo com a operadora.'
    : data.resolutionType === 'RESOLVED_NO_REFUND'
      ? 'A disputa foi encerrada a seu favor. Nenhuma acao adicional e necessaria.'
      : 'O valor do reembolso sera debitado do seu saldo de vendas. Consulte seus pedidos para mais detalhes.';

  const ctaUrl = isBuyer
    ? `${webUrl}/orders`
    : `${webUrl}/seller/disputes/${data.disputeId}`;

  const ctaLabel = isBuyer ? 'Ver Pedido' : 'Ver Disputa';

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Disputa resolvida — Pedido #${data.orderNumber}
    </h2>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      ${introText}
    </p>
    <!-- Resolution details box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Pedido</td>
              <td align="right" style="color: #18181b; font-size: 15px; font-weight: 600; padding-bottom: 8px;">#${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="color: #71717a; font-size: 13px; padding-bottom: 8px;">Resolucao</td>
              <td align="right" style="color: ${resolutionColor}; font-size: 15px; font-weight: 600; padding-bottom: 8px;">${resolutionLabel}</td>
            </tr>${refundRow}
            <tr>
              <td colspan="2" style="border-top: 1px solid #e4e4e7; padding-top: 12px;">
                <p style="margin: 0 0 4px 0; color: #71717a; font-size: 13px;">Justificativa</p>
                <p style="margin: 0; color: #3f3f46; font-size: 14px; line-height: 1.5;">
                  ${data.justification}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      ${nextStepsText}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${ctaUrl}" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            ${ctaLabel}
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Disputa resolvida — Pedido #${data.orderNumber}`,
    html: baseEmailLayout(content),
  };
}
