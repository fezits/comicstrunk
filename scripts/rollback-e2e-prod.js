#!/usr/bin/env node
/**
 * Rollback script para limpar dados criados pelo teste full-flow em produção.
 *
 * Uso (executado SOMENTE após autorização):
 *   node scripts/rollback-e2e-prod.js docs/test-reports/marketplace-flow/<run-id>/rollback.json --confirm
 *
 * Sem a flag --confirm o script só faz dry-run e mostra o que removeria.
 *
 * Conecta direto no MySQL via DATABASE_URL — não passa pela API.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = args[0];
  const confirmed = args.includes('--confirm');

  if (!manifestPath) {
    console.error('Uso: node scripts/rollback-e2e-prod.js <manifest.json> [--confirm]');
    process.exit(1);
  }

  if (!fs.existsSync(manifestPath)) {
    console.error(`[rollback] Manifesto não encontrado: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const e = manifest.entities;

  console.log('\n=== ROLLBACK E2E ===');
  console.log(`runId:     ${manifest.runId}`);
  console.log(`env:       ${manifest.env}`);
  console.log(`apiUrl:    ${manifest.apiUrl}`);
  console.log(`adminEmail:${manifest.adminEmail}`);
  console.log('');
  console.log('Entities a remover:');
  console.log(`  users:             ${e.users.length}`);
  console.log(`  catalogEntries:    ${e.catalogEntries.length}`);
  console.log(`  collectionItems:   ${e.collectionItems.length}`);
  console.log(`  shippingAddresses: ${e.shippingAddresses.length}`);
  console.log(`  bankAccounts:      ${e.bankAccounts.length}`);
  console.log(`  orders:            ${e.orders.length}`);
  console.log(`  orderItems:        ${e.orderItems.length}`);
  console.log(`  payments:          ${e.payments.length}`);
  console.log('');

  if (!confirmed) {
    console.log('[DRY-RUN] Nenhuma alteração feita. Use --confirm para executar.\n');
    process.exit(0);
  }

  if (manifest.env === 'production') {
    console.log('[!] Você está prestes a remover dados em PRODUÇÃO.');
    console.log('[!] Confirmação por prompt em 5s — Ctrl+C para abortar.');
    await new Promise((r) => setTimeout(r, 5000));
  }

  const prisma = new PrismaClient();

  try {
    // Ordem de remoção respeita as FKs do schema
    let counts = { ok: 0, failed: 0 };

    async function safeDelete(label, fn) {
      try {
        const result = await fn();
        const n = typeof result?.count === 'number' ? result.count : 1;
        console.log(`  [ok] ${label}: ${n}`);
        counts.ok += n;
      } catch (err) {
        console.error(`  [fail] ${label}: ${err.message}`);
        counts.failed += 1;
      }
    }

    // 1. Notifications associadas aos users
    if (e.users.length) {
      await safeDelete('notifications', () =>
        prisma.notification.deleteMany({ where: { userId: { in: e.users } } }),
      );
    }

    // 2. Payments
    if (e.payments.length) {
      await safeDelete('payments', () =>
        prisma.payment.deleteMany({ where: { id: { in: e.payments } } }),
      );
    }
    if (e.orders.length) {
      await safeDelete('payments-by-order', () =>
        prisma.payment.deleteMany({ where: { orderId: { in: e.orders } } }),
      );
    }

    // 3. Disputes
    if (e.orderItems.length) {
      await safeDelete('disputes', () =>
        prisma.dispute.deleteMany({ where: { orderItemId: { in: e.orderItems } } }),
      );
    }

    // 4. OrderItems
    if (e.orderItems.length) {
      await safeDelete('orderItems', () =>
        prisma.orderItem.deleteMany({ where: { id: { in: e.orderItems } } }),
      );
    }

    // 5. Orders
    if (e.orders.length) {
      await safeDelete('orders', () =>
        prisma.order.deleteMany({ where: { id: { in: e.orders } } }),
      );
    }

    // 6. CartItems (em geral já limpos no createOrder, mas garantir)
    if (e.users.length) {
      await safeDelete('cartItems', () =>
        prisma.cartItem.deleteMany({ where: { userId: { in: e.users } } }),
      );
    }

    // 7. CollectionItems
    if (e.collectionItems.length) {
      await safeDelete('collectionItems', () =>
        prisma.collectionItem.deleteMany({ where: { id: { in: e.collectionItems } } }),
      );
    }

    // 8. BankAccounts
    if (e.bankAccounts.length) {
      await safeDelete('bankAccounts', () =>
        prisma.bankAccount.deleteMany({ where: { id: { in: e.bankAccounts } } }),
      );
    }

    // 9. ShippingAddresses
    if (e.shippingAddresses.length) {
      await safeDelete('shippingAddresses', () =>
        prisma.shippingAddress.deleteMany({ where: { id: { in: e.shippingAddresses } } }),
      );
    }

    // 10. CatalogEntries (apenas os criados pelo teste)
    if (e.catalogEntries.length) {
      await safeDelete('catalogEntries', () =>
        prisma.catalogEntry.deleteMany({ where: { id: { in: e.catalogEntries } } }),
      );
    }

    // 11. Users — última, depois das deps
    if (e.users.length) {
      await safeDelete('refreshTokens', () =>
        prisma.refreshToken.deleteMany({ where: { userId: { in: e.users } } }),
      );
      await safeDelete('users', () =>
        prisma.user.deleteMany({ where: { id: { in: e.users } } }),
      );
    }

    console.log('');
    console.log(`Total removidos: ${counts.ok}, falhas: ${counts.failed}`);
    console.log('=== Rollback concluído ===\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[rollback] erro fatal:', err);
  process.exit(1);
});
