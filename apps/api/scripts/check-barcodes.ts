import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const samples = await p.catalogEntry.findMany({
    take: 10,
    select: { barcode: true, title: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Last 10 entries:');
  samples.forEach((s) => console.log(`  ${s.barcode} → ${s.title?.substring(0, 50)}`));

  const rikaCount = await p.catalogEntry.count({ where: { barcode: { startsWith: 'rika-' } } });
  const paniniCount = await p.catalogEntry.count({ where: { barcode: { startsWith: 'panini-' } } });
  const otherCount = await p.catalogEntry.count({
    where: {
      AND: [
        { NOT: { barcode: { startsWith: 'rika-' } } },
        { NOT: { barcode: { startsWith: 'panini-' } } },
        { barcode: { not: null } },
      ],
    },
  });
  const nullCount = await p.catalogEntry.count({ where: { barcode: null } });
  const total = await p.catalogEntry.count();

  console.log(`\nContagem por prefixo:`);
  console.log(`  rika-*:   ${rikaCount}`);
  console.log(`  panini-*: ${paniniCount}`);
  console.log(`  outros:   ${otherCount}`);
  console.log(`  null:     ${nullCount}`);
  console.log(`  TOTAL:    ${total}`);

  // Check if barcode is unique index
  const rikaExample = await p.catalogEntry.findFirst({ where: { barcode: { startsWith: 'rika-' } }, select: { barcode: true } });
  const paniniExample = await p.catalogEntry.findFirst({ where: { barcode: { startsWith: 'panini-' } }, select: { barcode: true } });
  console.log(`\nExemplos:`);
  console.log(`  Rika:   ${rikaExample?.barcode}`);
  console.log(`  Panini: ${paniniExample?.barcode}`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => p.$disconnect());
