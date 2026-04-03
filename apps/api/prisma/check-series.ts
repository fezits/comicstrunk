import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const checks = [
    'Batman - Vigilantes de Gotham', 'X-Men', 'Liga da Justiça', 
    'Homem-Aranha', 'Batman - 1ª Série', 'Capitão América', 
    'Espada Selvagem de Conan', 'Spawn', 'Sandman', 'Wolverine',
    'Superman', 'Novos Titãs', 'Dragon Ball', 'Berserk'
  ];
  for (const name of checks) {
    const series = await prisma.series.findMany({ where: { title: { contains: name } }, take: 5 });
    if (series.length > 0) {
      series.forEach(s => console.log(`✓ ${s.title} | ${s.totalEditions} eds | ${s.description}`));
    } else {
      console.log(`✗ MISS: ${name}`);
    }
    console.log('');
  }
  const total = await prisma.series.count();
  const withMulti = await prisma.series.count({ where: { totalEditions: { gte: 2 } } });
  console.log(`\nTotal series: ${total} (${withMulti} with 2+ editions)`);
}
main().finally(() => prisma.$disconnect());
