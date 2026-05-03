# Mailpit — local SMTP capture for dev

Mailpit is a tiny SMTP server with a web UI that captures every email the API
tries to send instead of forwarding them to a real provider. Useful in dev to
inspect welcome / password-reset / order-shipped emails without paying Resend
credits or polluting real mailboxes.

## Install (Windows, one-off)

The binary is *not* committed (`.gitignore`d). Download once:

```bash
cd scripts/dev
curl -sL -o mailpit-windows-amd64.zip \
  https://github.com/axllent/mailpit/releases/latest/download/mailpit-windows-amd64.zip
unzip -o mailpit-windows-amd64.zip
```

This drops `mailpit.exe` here. Other OSes: download the matching asset from
<https://github.com/axllent/mailpit/releases/latest>.

## Run

```bash
./scripts/dev/mailpit.exe
```

Defaults:
- SMTP: `127.0.0.1:1025`
- Web UI: <http://127.0.0.1:8025>

## Wire the API to it

Add to `apps/api/.env`:

```env
MAIL_TRANSPORT=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
```

Restart the API. Now every email the platform tries to send shows up at
<http://127.0.0.1:8025>. Resend is bypassed; nothing leaves the machine.

To go back to Resend: remove `MAIL_TRANSPORT` and `SMTP_HOST`, set
`RESEND_API_KEY`.
