import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE catalog_entries SET cover_image_url = REPLACE(cover_image_url, 'http://localhost:3005', 'http://192.168.1.9:3005') WHERE cover_image_url LIKE '%localhost:3005%'`
  );
  console.log(`Updated ${result} entries`);
}
main().finally(() => prisma.$disconnect());
