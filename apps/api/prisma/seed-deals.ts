import { PrismaClient, DealType } from '@prisma/client';

const prisma = new PrismaClient();

const PARTNER_STORES = [
  {
    id: 'store-amazon-br',
    name: 'Amazon Brasil',
    slug: 'amazon-br',
    affiliateTag: 'comicstrunk-20',
    baseUrl: 'https://www.amazon.com.br',
    logoUrl: null,
  },
  {
    id: 'store-mercadolivre',
    name: 'Mercado Livre',
    slug: 'mercado-livre',
    affiliateTag: 'comicstrunk-ml',
    baseUrl: 'https://www.mercadolivre.com.br',
    logoUrl: null,
  },
  {
    id: 'store-shopee',
    name: 'Shopee',
    slug: 'shopee',
    affiliateTag: 'comicstrunk-sp',
    baseUrl: 'https://shopee.com.br',
    logoUrl: null,
  },
];

export async function seedDeals() {
  console.log('\n  Seeding partner stores and deals...');

  // Create partner stores
  const storeMap = new Map<string, string>();

  for (const store of PARTNER_STORES) {
    const record = await prisma.partnerStore.upsert({
      where: { slug: store.slug },
      update: {
        name: store.name,
        affiliateTag: store.affiliateTag,
        baseUrl: store.baseUrl,
        isActive: true,
      },
      create: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        affiliateTag: store.affiliateTag,
        baseUrl: store.baseUrl,
        logoUrl: store.logoUrl,
        isActive: true,
      },
    });
    storeMap.set(store.slug, record.id);
    console.log(`    Partner store: ${record.name} (${record.id})`);
  }

  // Get category IDs for linking deals
  const mangaCat = await prisma.category.findFirst({ where: { name: 'Manga' } });
  const superCat = await prisma.category.findFirst({ where: { name: 'Super-heroi' } });
  const aventuraCat = await prisma.category.findFirst({ where: { name: 'Aventura' } });

  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const DEALS = [
    // COUPON deals
    {
      id: 'deal-amazon-manga-10',
      storeSlug: 'amazon-br',
      type: 'COUPON' as DealType,
      title: '10% off em Mangas na Amazon',
      description: 'Cupom exclusivo para mangas selecionados na Amazon Brasil. Valido para compras acima de R$50.',
      couponCode: 'MANGA10',
      discount: '10%',
      affiliateBaseUrl: 'https://www.amazon.com.br/manga',
      categorySlug: mangaCat?.id ?? null,
      startsAt: null,
      expiresAt: inThirtyDays,
    },
    {
      id: 'deal-shopee-hq-15',
      storeSlug: 'shopee',
      type: 'COUPON' as DealType,
      title: '15% off em HQs na Shopee',
      description: 'Desconto especial em quadrinhos de super-herois. Use o cupom no checkout.',
      couponCode: 'HQ15OFF',
      discount: '15%',
      affiliateBaseUrl: 'https://shopee.com.br/quadrinhos',
      categorySlug: superCat?.id ?? null,
      startsAt: null,
      expiresAt: inSevenDays,
    },
    {
      id: 'deal-ml-frete-gratis',
      storeSlug: 'mercado-livre',
      type: 'COUPON' as DealType,
      title: 'Frete gratis em quadrinhos no ML',
      description: 'Frete gratis para compras de quadrinhos acima de R$80 no Mercado Livre.',
      couponCode: 'FRETEFREE',
      discount: 'Frete gratis',
      affiliateBaseUrl: 'https://www.mercadolivre.com.br/quadrinhos',
      categorySlug: null,
      startsAt: null,
      expiresAt: inThirtyDays,
    },
    {
      id: 'deal-amazon-colecao-20',
      storeSlug: 'amazon-br',
      type: 'COUPON' as DealType,
      title: '20% off na colecao completa Dragon Ball',
      description: 'Desconto exclusivo para a colecao completa de Dragon Ball em capa dura.',
      couponCode: 'DB20FULL',
      discount: '20%',
      affiliateBaseUrl: 'https://www.amazon.com.br/dragon-ball-colecao',
      categorySlug: mangaCat?.id ?? null,
      startsAt: null,
      expiresAt: inSevenDays,
    },
    // PROMOTION deals
    {
      id: 'deal-amazon-promo-batman',
      storeSlug: 'amazon-br',
      type: 'PROMOTION' as DealType,
      title: 'Batman Ano Um por R$29,90',
      description: 'Promocao relampago! Batman Ano Um de Frank Miller com preco especial.',
      couponCode: null,
      discount: 'R$29,90',
      affiliateBaseUrl: 'https://www.amazon.com.br/batman-ano-um',
      categorySlug: superCat?.id ?? null,
      startsAt: null,
      expiresAt: inSevenDays,
    },
    {
      id: 'deal-shopee-kit-naruto',
      storeSlug: 'shopee',
      type: 'PROMOTION' as DealType,
      title: 'Kit Naruto 5 volumes por R$99',
      description: 'Kit com os 5 primeiros volumes de Naruto com preco especial.',
      couponCode: null,
      discount: 'R$99,00',
      affiliateBaseUrl: 'https://shopee.com.br/kit-naruto',
      categorySlug: mangaCat?.id ?? null,
      startsAt: null,
      expiresAt: inThirtyDays,
    },
    {
      id: 'deal-ml-aventura-30',
      storeSlug: 'mercado-livre',
      type: 'PROMOTION' as DealType,
      title: '30% off em quadrinhos de aventura',
      description: 'Selecao especial de quadrinhos de aventura com ate 30% de desconto.',
      couponCode: null,
      discount: '30%',
      affiliateBaseUrl: 'https://www.mercadolivre.com.br/quadrinhos-aventura',
      categorySlug: aventuraCat?.id ?? null,
      startsAt: null,
      expiresAt: inSevenDays,
    },
    // Expired deal (for testing)
    {
      id: 'deal-expired-test',
      storeSlug: 'amazon-br',
      type: 'PROMOTION' as DealType,
      title: 'Promocao expirada - One Piece',
      description: 'Esta promocao ja expirou e serve para testar a logica de expiracao.',
      couponCode: null,
      discount: '50%',
      affiliateBaseUrl: 'https://www.amazon.com.br/one-piece-promo',
      categorySlug: mangaCat?.id ?? null,
      startsAt: threeDaysAgo,
      expiresAt: oneDayAgo,
    },
  ];

  for (const deal of DEALS) {
    const storeId = storeMap.get(deal.storeSlug);
    if (!storeId) {
      console.log(`    Skipping deal "${deal.title}" — store not found`);
      continue;
    }

    // Use upsert with the fixed ID for idempotency
    const existing = await prisma.deal.findUnique({ where: { id: deal.id } });

    if (existing) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          storeId,
          type: deal.type,
          title: deal.title,
          description: deal.description,
          couponCode: deal.couponCode,
          discount: deal.discount,
          affiliateBaseUrl: deal.affiliateBaseUrl,
          categoryId: deal.categorySlug,
          startsAt: deal.startsAt,
          expiresAt: deal.expiresAt,
          isActive: deal.expiresAt && deal.expiresAt < now ? false : true,
        },
      });
      console.log(`    Deal updated: ${deal.title} (${deal.id})`);
    } else {
      await prisma.deal.create({
        data: {
          id: deal.id,
          storeId,
          type: deal.type,
          title: deal.title,
          description: deal.description,
          couponCode: deal.couponCode,
          discount: deal.discount,
          affiliateBaseUrl: deal.affiliateBaseUrl,
          categoryId: deal.categorySlug,
          startsAt: deal.startsAt,
          expiresAt: deal.expiresAt,
          isActive: deal.expiresAt && deal.expiresAt < now ? false : true,
        },
      });
      console.log(`    Deal created: ${deal.title} (${deal.id})`);
    }
  }

  console.log('  Deals seeding complete.');
}
