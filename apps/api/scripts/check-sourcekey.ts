import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const rikaKeys = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'rika:' } } });
  const paniniKeys = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'panini:' } } });
  const nullKeys = await p.catalogEntry.count({ where: { sourceKey: null } });
  const nullBarcode = await p.catalogEntry.count({ where: { barcode: null } });
  const hasBarcode = await p.catalogEntry.count({ where: { barcode: { not: null } } });
  const total = await p.catalogEntry.count();

  console.log('=== sourceKey stats ===');
  console.log(`  rika:*   ${rikaKeys}`);
  console.log(`  panini:* ${paniniKeys}`);
  console.log(`  null:    ${nullKeys}`);
  console.log(`  TOTAL:   ${total}`);
  console.log('\n=== barcode stats ===');
  console.log(`  has barcode: ${hasBarcode}`);
  console.log(`  null:        ${nullBarcode}`);

  // Samples
  const sample = await p.catalogEntry.findFirst({ where: { sourceKey: { startsWith: 'rika:' } }, select: { sourceKey: true, barcode: true, title: true } });
  console.log('\nRika sample:', sample);
  const sample2 = await p.catalogEntry.findFirst({ where: { sourceKey: { startsWith: 'panini:' } }, select: { sourceKey: true, barcode: true, title: true } });
  console.log('Panini sample:', sample2);
}

main().catch(console.error).finally(() => p.$disconnect());
