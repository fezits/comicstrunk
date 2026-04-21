import { baseEmailLayout } from './base-layout';

interface PasswordResetEmailData {
  userName: string;
  resetLink: string;
}

/**
 * Password reset email with secure link and expiry warning.
 */
export function passwordResetEmailTemplate(data: PasswordResetEmailData): {
  subject: string;
  html: string;
} {
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">
      Redefinir sua senha
    </h2>
    <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Ola, ${data.userName}! Recebemos uma solicitacao para redefinir a senha da sua conta no Comics Trunk.
    </p>
    <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      Clique no botao abaixo para criar uma nova senha:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="${data.resetLink}" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 15px; font-weight: 600;">
            Redefinir Senha
          </a>
        </td>
      </tr>
    </table>
    <!-- Expiry warning -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
            Este link expira em <strong>1 hora</strong>. Caso expire, solicite uma nova redefinicao de senha.
          </p>
        </td>
      </tr>
    </table>
    <!-- Security note -->
    <p style="margin: 0 0 8px 0; color: #71717a; font-size: 13px; line-height: 1.5;">
      Se voce nao solicitou a redefinicao de senha, ignore este email. Sua senha atual permanecera inalterada.
    </p>
    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
      Caso o botao nao funcione, copie e cole o link abaixo no seu navegador:
    </p>
    <p style="margin: 8px 0 0 0; color: #7C3AED; font-size: 12px; word-break: break-all; line-height: 1.5;">
      ${data.resetLink}
    </p>
  `;

  return {
    subject: 'Redefinir sua senha - Comics Trunk',
    html: baseEmailLayout(content),
  };
}
