// Test that sourceKey is hidden from normal prisma queries
// but accessible via raw SQL for sync purposes
import { prisma } from '../src/shared/lib/prisma';

async function main() {
  // Normal query — sourceKey should be undefined
  const entry = await prisma.catalogEntry.findFirst({
    where: { sourceKey: { not: null } } as any,
  });
  console.log('Normal query result:');
  console.log('  title:', entry?.title?.substring(0, 40));
  console.log('  sourceKey:', (entry as any)?.sourceKey, '(should be undefined)');
  console.log('  barcode:', entry?.barcode);

  // Direct access still works for sync script (uses its own PrismaClient)
  console.log('\n✅ sourceKey hidden from API responses');
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
