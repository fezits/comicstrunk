/**
 * Base HTML email layout with Comics Trunk branding.
 *
 * Features:
 * - Responsive design (max-width 600px)
 * - Comics Trunk purple (#7C3AED) header bar
 * - White body, gray footer
 * - All text in PT-BR
 * - Inline CSS only (email client compatibility)
 */
export function baseEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Comics Trunk</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Main container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #7C3AED; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Comics Trunk
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 32px; border-radius: 0 0 8px 8px; border: 1px solid #e4e4e7; border-top: none; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                Comics Trunk - Sua plataforma de gibis e HQs
              </p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.5;">
                Voce recebeu este email porque tem uma conta no Comics Trunk.
                Para alterar suas preferencias de notificacao, acesse as configuracoes da sua conta.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
