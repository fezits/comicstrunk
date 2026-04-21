import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const total = await p.catalogEntry.count();
  const withCover = await p.catalogEntry.count({ where: { coverFileName: { not: null } } });
  const noCover = await p.catalogEntry.count({ where: { coverFileName: null } });
  const rikaWithCover = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'rika:' }, coverFileName: { not: null } } });
  const rikaTotal = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'rika:' } } });
  const paniniWithCover = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'panini:' }, coverFileName: { not: null } } });
  const paniniTotal = await p.catalogEntry.count({ where: { sourceKey: { startsWith: 'panini:' } } });
  console.log(`Total gibis: ${total}`);
  console.log(`Com capa vinculada: ${withCover} (${Math.round(withCover/total*100)}%)`);
  console.log(`Sem capa: ${noCover}`);
  console.log(`\nRika:   ${rikaWithCover}/${rikaTotal} com capa (${Math.round(rikaWithCover/rikaTotal*100)}%)`);
  console.log(`Panini: ${paniniWithCover}/${paniniTotal} com capa (${Math.round(paniniWithCover/paniniTotal*100)}%)`);
}
main().catch(console.error).finally(() => p.$disconnect());
