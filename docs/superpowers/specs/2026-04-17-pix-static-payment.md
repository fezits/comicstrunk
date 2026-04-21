# PIX Estatico com Confirmacao Manual — Design Spec

## Objetivo

Implementar pagamento PIX estatico (sem intermediario) para compras no marketplace, com QR code gerado localmente, confirmacao manual pelo admin, e notificacao por email.

## Decisoes de Design

- **PIX estatico** via `pix-utils` (sem Mercado Pago, sem taxas)
- **Confirmacao manual** pelo admin via painel existente (`/admin/payments`)
- **Notificacao por email** quando novo PIX e gerado (avisa o admin que tem pedido pendente)
- **Stripe para assinaturas** — ja implementado, so precisa configurar chaves (fora deste escopo)
- **Cartao de credito** — "em breve" (fora deste escopo)

## Fluxo

```
Comprador faz pedido → POST /orders (ja existe)
    ↓
Comprador inicia pagamento → POST /payments/initiate
    ↓
Backend gera PIX estatico via pix-utils:
  - pixCode (BR Code string)
  - pixQrCodeDataUrl (base64 do QR code)
  - Expiracao: 30 min
    ↓
Frontend exibe QR code + codigo copia-e-cola + countdown
    ↓
Comprador paga no app do banco
    ↓
Email enviado ao admin: "Novo pagamento PIX pendente - R$X - Pedido ORD-XXXX"
    ↓
Admin abre /admin/payments → ve pedido pendente
Admin confere no extrato do banco → clica "Confirmar"
    ↓
POST /payments/admin/approve (ja existe)
    ↓
Order status → PAID, items → PAID
Notificacao in-app + email pro comprador: "Pagamento confirmado"
```

## O que muda no codigo

### Backend

1. **Instalar `pix-utils` e `qrcode`** — dependencias pra gerar PIX
2. **Modificar `payments.service.ts` → `initiatePixPayment`** — substituir chamada ao Mercado Pago por geracao local via pix-utils
3. **Adicionar envvars PIX** — `PIX_KEY`, `MERCHANT_NAME`, `MERCHANT_CITY`
4. **Email de notificacao ao admin** quando PIX e criado

### Frontend

5. **Modificar `pix-payment-page.tsx`** — o componente ja existe e exibe QR code. Precisa funcionar com o formato de resposta novo (base64 data URL em vez de URL do MP)
6. **Criar pagina `/admin/payments`** — ja referenciada no nav-config. Lista pedidos pendentes com botao confirmar/rejeitar

## Configuracao necessaria

```env
PIX_KEY=braidatto@live.com
MERCHANT_NAME=Fernando Braidatto
MERCHANT_CITY=BAIRRO RINCAO
```

## Fora de escopo

- Confirmacao automatica via banco/Open Finance
- Pagamento via cartao de credito
- Mercado Pago como intermediario
- Stripe para marketplace (so assinaturas)
