# PIX Estatico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o mock/Mercado Pago por geracao local de PIX via pix-utils, com QR code real e confirmacao manual pelo admin.

**Architecture:** `lib/pix.ts` encapsula geracao de BR Code via pix-utils e QR code via qrcode. `initiatePixPayment` chama essa lib em vez do Mercado Pago. Frontend ja funciona (espera base64 + copia-cola). Admin payment page ja tem botao de aprovar. So precisa conectar os pontos.

**Tech Stack:** pix-utils, qrcode (npm), Express, Prisma, Next.js

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `apps/api/src/shared/lib/pix.ts` | Gera BR Code + QR code base64 usando pix-utils |

### Modified Files
| File | Change |
|---|---|
| `apps/api/src/modules/payments/payments.service.ts:80-109` | Substituir bloco MP por chamada a lib/pix |
| `apps/api/.env.example` | Adicionar PIX_KEY, MERCHANT_NAME, MERCHANT_CITY |
| `apps/api/.env` | Adicionar valores reais |

---

## Task 1: Instalar dependencias

- [ ] **Step 1: Instalar pix-utils e qrcode**

```bash
cd apps/api && corepack pnpm add pix-utils qrcode && corepack pnpm add -D @types/qrcode
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add pix-utils and qrcode dependencies"
```

---

## Task 2: Criar lib/pix.ts

**Files:**
- Create: `apps/api/src/shared/lib/pix.ts`

- [ ] **Step 1: Criar o modulo de geracao PIX**

```typescript
import { createStaticPix } from 'pix-utils';
import QRCode from 'qrcode';

export interface PixPaymentData {
  pixCopyPaste: string;  // BR Code string (copia-e-cola)
  pixQrCode: string;     // base64 PNG do QR code
}

export function isPixConfigured(): boolean {
  return !!(process.env.PIX_KEY && process.env.MERCHANT_NAME && process.env.MERCHANT_CITY);
}

export async function generatePixPayment(
  amount: number,
  orderId: string,
  description: string,
): Promise<PixPaymentData> {
  const pixKey = process.env.PIX_KEY;
  const merchantName = process.env.MERCHANT_NAME;
  const merchantCity = process.env.MERCHANT_CITY;

  if (!pixKey || !merchantName || !merchantCity) {
    throw new Error('PIX environment variables not configured (PIX_KEY, MERCHANT_NAME, MERCHANT_CITY)');
  }

  // txid: max 25 chars, alphanumeric only
  const txid = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);

  const pix = createStaticPix({
    merchantName,
    merchantCity,
    pixKey,
    txid,
    transactionAmount: amount,
    description,
  });

  const brCode = pix.toBRCode();

  // Generate QR code as base64 PNG
  const qrBase64 = await QRCode.toDataURL(brCode, {
    type: 'image/png',
    width: 400,
    margin: 2,
  });

  // Remove data URL prefix to get just the base64
  const base64Only = qrBase64.replace(/^data:image\/png;base64,/, '');

  return {
    pixCopyPaste: brCode,
    pixQrCode: base64Only,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/shared/lib/pix.ts
git commit -m "feat: add PIX static payment generation lib"
```

---

## Task 3: Modificar initiatePixPayment

**Files:**
- Modify: `apps/api/src/modules/payments/payments.service.ts:1-137`

- [ ] **Step 1: Substituir import e bloco de geracao PIX**

Replace the Mercado Pago import and the generation block (lines 3, 80-109) with:

Import: replace `mpPayment, mpRefund, isMercadoPagoConfigured` with `generatePixPayment, isPixConfigured` from `../../shared/lib/pix`.

Block (lines 74-109): replace entirely with call to `generatePixPayment`.

The key change: instead of calling Mercado Pago API, call the local pix lib. The `providerPaymentId` becomes `pix-{orderId}` and `providerStatus` is always `pending` (manual confirmation).

- [ ] **Step 2: Update getPaymentStatus to skip MP polling**

In `getPaymentStatus`, the block that polls Mercado Pago (lines 160-189) should be skipped for local PIX payments. The `providerPaymentId` starts with `pix-` for local payments, so the existing `dev-` check pattern can be extended.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/payments/payments.service.ts
git commit -m "feat: use local PIX generation instead of Mercado Pago"
```

---

## Task 4: Environment variables

- [ ] **Step 1: Add PIX vars to .env.example**

```
# PIX Static Payment
PIX_KEY=your-pix-key@email.com
MERCHANT_NAME=Your Name
MERCHANT_CITY=Your City
```

- [ ] **Step 2: Add values to local .env**

```
PIX_KEY=braidatto@live.com
MERCHANT_NAME=Fernando Braidatto
MERCHANT_CITY=B RINCAO
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example
git commit -m "chore: add PIX environment variables to .env.example"
```

---

## Task 5: Test locally + Deploy

- [ ] **Step 1: Build and test API locally**
- [ ] **Step 2: Test PIX generation via curl**
- [ ] **Step 3: Deploy API to production**
- [ ] **Step 4: Set PIX env vars on production server**
- [ ] **Step 5: Restart API**
- [ ] **Step 6: E2E test: create order → initiate payment → verify QR code appears**
