import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import {
  isPrivateOrReservedIp,
  isSafeExternalUrl,
} from '../../modules/cover-scan/cover-import.service';
import { uploadImage } from '../../shared/lib/cloudinary';

vi.mock('../../shared/lib/prisma', () => ({ prisma: {} }));
vi.mock('../../shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('isPrivateOrReservedIp', () => {
  it('blocks IPv4 loopback', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('127.255.255.254')).toBe(true);
  });

  it('blocks AWS/GCP cloud metadata (link-local)', () => {
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.0.1')).toBe(true);
  });

  it('blocks RFC1918 private ranges', () => {
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.254')).toBe(true);
  });

  it('does NOT block 172.15/172.32 (outside RFC1918)', () => {
    expect(isPrivateOrReservedIp('172.15.0.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false);
  });

  it('blocks CGNAT range', () => {
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('100.127.255.254')).toBe(true);
  });

  it('blocks IPv6 loopback and link-local', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd12:3456::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 pointing to private', () => {
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('142.250.190.78')).toBe(false); // Google
  });
});

describe('isSafeExternalUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    expect(await isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(await isSafeExternalUrl('gopher://localhost:25/x')).toBe(false);
    expect(await isSafeExternalUrl('ftp://example.com/x')).toBe(false);
    expect(await isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects malformed URLs', async () => {
    expect(await isSafeExternalUrl('')).toBe(false);
    expect(await isSafeExternalUrl('not-a-url')).toBe(false);
    expect(await isSafeExternalUrl('http://')).toBe(false);
  });

  it('rejects direct IP literal pointing to AWS metadata', async () => {
    expect(await isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('rejects direct IP literal loopback', async () => {
    expect(await isSafeExternalUrl('http://127.0.0.1/admin')).toBe(false);
    expect(await isSafeExternalUrl('http://[::1]/x')).toBe(false);
  });

  it('rejects RFC1918 IPs', async () => {
    expect(await isSafeExternalUrl('http://10.0.0.1/')).toBe(false);
    expect(await isSafeExternalUrl('http://192.168.1.1/')).toBe(false);
  });

  it('accepts public IP literal', async () => {
    expect(await isSafeExternalUrl('https://1.1.1.1/')).toBe(true);
    expect(await isSafeExternalUrl('https://8.8.8.8/')).toBe(true);
  });

  it('accepts public hostname (resolves to public IP)', async () => {
    // i.ebayimg.com e cloudflare.com sao publicos — DNS lookup real
    expect(await isSafeExternalUrl('https://cloudflare.com/')).toBe(true);
  });

  it('rejects hostname that does not resolve', async () => {
    expect(
      await isSafeExternalUrl('https://this-host-does-not-exist-xyz123.invalid/'),
    ).toBe(false);
  });

  it('rejects localhost (resolves to loopback)', async () => {
    expect(await isSafeExternalUrl('http://localhost/')).toBe(false);
  });
});

describe('uploadImage buffer validation', () => {
  it('rejects buffer that is not a real image (JSON exfiltrated via SSRF)', async () => {
    const fakeBuffer = Buffer.from(
      JSON.stringify({ AccessKeyId: 'AKIA...', SecretAccessKey: '...' }),
    );
    await expect(uploadImage(fakeBuffer, 'covers')).rejects.toThrow(
      /not a valid image|unsupported image format/,
    );
  });

  it('rejects buffer with image-ish magic bytes but garbage content', async () => {
    // 0xff 0xd8 = JPEG SOI mas o resto eh lixo
    const fakeJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('not really a jpeg payload'),
    ]);
    await expect(uploadImage(fakeJpeg, 'covers')).rejects.toThrow(
      /not a valid image|unsupported image format/,
    );
  });

  it('rejects HTML disguised as image', async () => {
    const html = Buffer.from('<html><body>not an image</body></html>');
    await expect(uploadImage(html, 'covers')).rejects.toThrow(
      /not a valid image|unsupported image format/,
    );
  });

  it('accepts a real PNG generated by sharp', async () => {
    // Cria PNG real 1x1 px via sharp — passa pelo guard mas ainda eh
    // rejeitado se as creds de storage nao tiverem (R2/Cloudinary
    // nao configurados em ambiente de teste). Logo, basta NAO jogar
    // o erro de "not a valid image".
    const realPng = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    // Pode resolver com sucesso (storage local) ou cair em outro erro nao
    // relacionado a validacao de imagem. Garantimos que NAO eh o erro de
    // validacao do guard.
    try {
      await uploadImage(realPng, 'covers');
    } catch (err) {
      expect((err as Error).message).not.toMatch(/not a valid image|unsupported image format/);
    }
  });
});
