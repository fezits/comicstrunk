// Backfill: cria Subscription FREE pra todos os usuários sem nenhuma assinatura.
// Uso: node scripts/backfill-free-subscriptions.js (precisa DATABASE_URL)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const usersWithoutSub = await prisma.user.findMany({
    where: { subscriptions: { none: {} } },
    select: { id: true, email: true },
  });

  console.log(`[backfill] ${usersWithoutSub.length} usuários sem subscription. Criando FREE...`);

  let created = 0;
  for (const u of usersWithoutSub) {
    try {
      await prisma.subscription.create({
        data: { userId: u.id, planType: 'FREE', status: 'ACTIVE' },
      });
      created++;
    } catch (err) {
      console.error(`  [erro] ${u.email}:`, err && err.message ? err.message : err);
    }
  }

  console.log(`[backfill] ${created}/${usersWithoutSub.length} subscriptions FREE criadas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[backfill] erro fatal:', err);
  process.exit(1);
});
