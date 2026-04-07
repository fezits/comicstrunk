import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3005';

async function main() {
  // Update all entries that have /uploads/ relative URLs to absolute
  const result = await prisma.$executeRawUnsafe(`
    UPDATE catalog_entries 
    SET cover_image_url = CONCAT('${API_URL}', cover_image_url)
    WHERE cover_image_url LIKE '/uploads/%'
  `);
  console.log(`Updated ${result} entries to absolute URLs`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
