// Debug: test why scraper can't find covers
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.catalogEntry.findMany({
    where: {
      AND: [
        { coverFileName: null },
        { coverImageUrl: null },
        { sourceKey: { not: null } },
        { sourceKey: { startsWith: 'panini:' } },
      ],
    },
    select: { id: true, title: true, sourceKey: true },
    orderBy: { title: 'asc' },
    take: 3,
  });

  console.log('Found entries:', entries.length);

  for (const entry of entries) {
    const sku = entry.sourceKey.replace('panini:', '');
    const slug = entry.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\ufffd/g, '').replace(/['`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/-+/g, '-');

    console.log('\n---');
    console.log('Title:', entry.title);
    console.log('Title hex:', Buffer.from(entry.title).toString('hex').substring(0, 80));
    console.log('SKU:', sku);
    console.log('Slug:', slug);
    console.log('URL:', `https://panini.com.br/${slug}`);

    // Try GraphQL
    try {
      const gqlRes = await fetch('https://panini.com.br/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Store: 'default' },
        body: JSON.stringify({ query: `{ products(filter: { sku: { eq: "${sku}" } }, pageSize: 1) { items { small_image { url } } } }` }),
        signal: AbortSignal.timeout(15000),
      });
      const gqlData = await gqlRes.json();
      const imgUrl = gqlData.data?.products?.items?.[0]?.small_image?.url;
      console.log('GraphQL image:', imgUrl?.includes('placeholder') ? 'PLACEHOLDER' : imgUrl?.substring(0, 60) || 'NULL');
    } catch (e) {
      console.log('GraphQL error:', e.message);
    }

    // Try page scrape
    try {
      const res = await fetch(`https://panini.com.br/${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(20000),
        redirect: 'follow',
      });
      console.log('Page status:', res.status);
      if (res.ok) {
        const html = await res.text();
        console.log('HTML length:', html.length);
        const match = html.match(/https?:\/\/d14d9vp3wdof84\.cloudfront\.net\/image\/\S+-S897\S*/);
        console.log('CloudFront S897:', match ? match[0].substring(0, 80) : 'NO MATCH');
        const anyMatch = html.match(/cloudfront\.net/g);
        console.log('cloudfront mentions:', anyMatch?.length || 0);
      }
    } catch (e) {
      console.log('Page error:', e.message);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
