import { createStaticPix, hasError } from 'pix-utils';
import QRCode from 'qrcode';

export interface PixPaymentData {
  pixCopyPaste: string; // BR Code string (copia-e-cola)
  pixQrCode: string; // base64 PNG do QR code (sem prefixo data:image)
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
    throw new Error(
      'PIX environment variables not configured (PIX_KEY, MERCHANT_NAME, MERCHANT_CITY)',
    );
  }

  // txid: max 25 chars, alphanumeric only
  const txid = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);

  const pix = createStaticPix({
    merchantName,
    merchantCity,
    pixKey,
    txid,
    transactionAmount: amount,
  });

  if (hasError(pix)) {
    throw new Error(`PIX generation failed: ${JSON.stringify(pix)}`);
  }

  const brCode = pix.toBRCode();

  // Generate QR code as base64 data URL, then strip prefix
  const qrDataUrl = await QRCode.toDataURL(brCode, {
    type: 'image/png',
    width: 400,
    margin: 2,
  });

  const pixQrCode = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  return {
    pixCopyPaste: brCode,
    pixQrCode,
  };
}
