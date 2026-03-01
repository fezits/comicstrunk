import { baseEmailLayout } from './base-layout';

interface WelcomeEmailData {
  userName: string;
}

/**
 * Welcome email sent after successful signup.
 */
export function welcomeEmailTemplate(data: WelcomeEmailData): {
  subject: string;
  html: string;
} {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Bem-vindo ao Comics Trunk, ${data.userName}!
    </h2>
    <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Sua conta foi criada com sucesso. O Comics Trunk e a plataforma ideal para
      colecionar, comprar e vender gibis, HQs e mangas.
    </p>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Com o Comics Trunk voce pode:
    </p>
    <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #3f3f46; font-size: 15px; line-height: 1.8;">
      <li>Gerenciar sua colecao de gibis e HQs</li>
      <li>Explorar o catalogo com milhares de titulos</li>
      <li>Comprar e vender no marketplace</li>
      <li>Avaliar e comentar suas leituras favoritas</li>
    </ul>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 16px 0;">
          <a href="${webUrl}/catalog" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Explorar Catalogo
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
      Se voce nao criou esta conta, por favor ignore este email.
    </p>
  `;

  return {
    subject: 'Bem-vindo ao Comics Trunk!',
    html: baseEmailLayout(content),
  };
}
