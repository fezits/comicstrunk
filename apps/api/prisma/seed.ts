import {
  PrismaClient,
  PlanType,
  BillingInterval,
  UserRole,
  HomepageSectionType,
  LegalDocumentType,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { seedCatalog } from './seed-catalog';
import { seedDeals } from './seed-deals';

const prisma = new PrismaClient();

async function seedHomepage() {
  console.log('\n  Seeding homepage sections...');

  const sections = [
    {
      id: 'homepage-banner-carousel',
      type: HomepageSectionType.BANNER_CAROUSEL,
      title: 'Destaques',
      sortOrder: 0,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-catalog-highlights',
      type: HomepageSectionType.CATALOG_HIGHLIGHTS,
      title: 'Catalogo em Destaque',
      sortOrder: 1,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-deals-of-day',
      type: HomepageSectionType.DEALS_OF_DAY,
      title: 'Ofertas do Dia',
      sortOrder: 2,
      isVisible: true,
      contentRefs: {},
    },
    {
      id: 'homepage-featured-coupons',
      type: HomepageSectionType.FEATURED_COUPONS,
      title: 'Cupons em Destaque',
      sortOrder: 3,
      isVisible: true,
      contentRefs: {},
    },
  ];

  for (const section of sections) {
    const result = await prisma.homepageSection.upsert({
      where: { id: section.id },
      update: {
        title: section.title,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        contentRefs: section.contentRefs,
      },
      create: {
        id: section.id,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        contentRefs: section.contentRefs,
      },
    });
    console.log(`  Homepage section: ${result.title} (${result.type})`);
  }
}

async function seedLegalDocuments() {
  console.log('\n  Seeding legal documents...');

  const effectDate = new Date('2026-01-01T00:00:00Z');

  const documents = [
    {
      id: 'legal-terms-of-use-v1',
      type: LegalDocumentType.TERMS_OF_USE,
      version: 1,
      isMandatory: true,
      content:
        'Termos de Uso do Comics Trunk. Ao utilizar esta plataforma, voce concorda com os termos aqui descritos. ' +
        'O Comics Trunk e uma plataforma de colecionadores de quadrinhos que oferece gerenciamento de colecao, ' +
        'marketplace peer-to-peer e recursos comunitarios. O uso indevido da plataforma pode resultar em suspensao ' +
        'ou encerramento da conta. Reservamo-nos o direito de modificar estes termos a qualquer momento, ' +
        'notificando os usuarios sobre alteracoes significativas.',
    },
    {
      id: 'legal-privacy-policy-v1',
      type: LegalDocumentType.PRIVACY_POLICY,
      version: 1,
      isMandatory: true,
      content:
        'Politica de Privacidade do Comics Trunk. Coletamos e processamos seus dados pessoais conforme a LGPD ' +
        '(Lei Geral de Protecao de Dados). Os dados coletados incluem: informacoes de cadastro, historico de ' +
        'transacoes, dados de navegacao e preferencias. Seus dados sao utilizados para fornecer e melhorar ' +
        'nossos servicos, processar transacoes e enviar comunicacoes relevantes. Voce pode solicitar acesso, ' +
        'correcao ou exclusao de seus dados a qualquer momento.',
    },
    {
      id: 'legal-seller-terms-v1',
      type: LegalDocumentType.SELLER_TERMS,
      version: 1,
      isMandatory: true,
      content:
        'Termos para Vendedores do Comics Trunk. Ao listar itens para venda, voce concorda em fornecer descricoes ' +
        'precisas e fotos reais dos produtos. O Comics Trunk cobra uma comissao sobre cada venda realizada. ' +
        'Vendedores sao responsaveis pelo envio dos itens dentro do prazo acordado. Disputas serao mediadas ' +
        'pela plataforma conforme nossa politica de resolucao de conflitos.',
    },
    {
      id: 'legal-payment-policy-v1',
      type: LegalDocumentType.PAYMENT_POLICY,
      version: 1,
      isMandatory: false,
      content:
        'Politica de Pagamentos do Comics Trunk. Aceitamos pagamentos via Mercado Pago e Stripe. Os valores ' +
        'das transacoes sao processados em Reais (BRL). Os pagamentos aos vendedores sao liberados apos ' +
        'confirmacao de recebimento pelo comprador ou apos o prazo de protecao. Taxas de processamento ' +
        'podem ser aplicadas conforme o metodo de pagamento escolhido.',
    },
    {
      id: 'legal-returns-policy-v1',
      type: LegalDocumentType.RETURNS_POLICY,
      version: 1,
      isMandatory: false,
      content:
        'Politica de Devolucoes do Comics Trunk. Compradores podem solicitar devolucao em ate 7 dias apos o ' +
        'recebimento, conforme o Codigo de Defesa do Consumidor. O item deve ser devolvido nas mesmas condicoes ' +
        'em que foi recebido. O custo do frete de devolucao sera definido conforme a resolucao da disputa. ' +
        'Reembolsos sao processados pelo mesmo metodo de pagamento original.',
    },
    {
      id: 'legal-shipping-policy-v1',
      type: LegalDocumentType.SHIPPING_POLICY,
      version: 1,
      isMandatory: false,
      content:
        'Politica de Envio do Comics Trunk. Os vendedores sao responsaveis por embalar e enviar os itens de ' +
        'forma segura. Recomendamos embalagens reforçadas para proteger os quadrinhos durante o transporte. ' +
        'O prazo de envio deve ser respeitado conforme acordado na listagem. O comprador recebera o codigo ' +
        'de rastreamento assim que o item for despachado.',
    },
    {
      id: 'legal-cancellation-policy-v1',
      type: LegalDocumentType.CANCELLATION_POLICY,
      version: 1,
      isMandatory: false,
      content:
        'Politica de Cancelamento do Comics Trunk. Pedidos podem ser cancelados antes do envio sem penalidade. ' +
        'Apos o envio, o cancelamento esta sujeito a politica de devolucoes. Assinaturas podem ser canceladas ' +
        'a qualquer momento, com efeito ao final do periodo ja pago. Nao ha reembolso proporcional para ' +
        'periodos parciais de assinatura.',
    },
    {
      id: 'legal-cookies-policy-v1',
      type: LegalDocumentType.COOKIES_POLICY,
      version: 1,
      isMandatory: false,
      content:
        'Politica de Cookies do Comics Trunk. Utilizamos cookies essenciais para o funcionamento da plataforma, ' +
        'cookies de preferencias para lembrar suas configuracoes, e cookies analiticos para entender como voce ' +
        'utiliza nossos servicos. Voce pode gerenciar suas preferencias de cookies nas configuracoes do navegador. ' +
        'Cookies de terceiros podem ser utilizados para fins de publicidade e analise.',
    },
  ];

  for (const doc of documents) {
    const result = await prisma.legalDocument.upsert({
      where: { id: doc.id },
      update: {
        content: doc.content,
        isMandatory: doc.isMandatory,
        dateOfEffect: effectDate,
      },
      create: {
        id: doc.id,
        type: doc.type,
        version: doc.version,
        content: doc.content,
        dateOfEffect: effectDate,
        isMandatory: doc.isMandatory,
      },
    });
    console.log(`  Legal document: ${result.type} v${result.version} (mandatory: ${result.isMandatory})`);
  }
}

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const adminPasswordHash = hashSync('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@comicstrunk.com' },
    update: {},
    create: {
      email: 'admin@comicstrunk.com',
      name: 'Admin',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      acceptedTermsAt: new Date(),
    },
  });
  console.log(`  Admin user: ${admin.email} (${admin.id})`);

  // Create sync service user
  const syncPasswordHash = hashSync('SyncService2026!', 12);
  const syncUser = await prisma.user.upsert({
    where: { email: 'sync@comicstrunk.com' },
    update: {},
    create: {
      email: 'sync@comicstrunk.com',
      name: 'Sync Service',
      passwordHash: syncPasswordHash,
      role: UserRole.ADMIN,
      acceptedTermsAt: new Date(),
    },
  });
  console.log(`  Sync user: ${syncUser.email} (${syncUser.id})`);

  // Create default plan configs (FREE + BASIC for all billing intervals)
  const planConfigs = [
    {
      id: 'plan-free-monthly',
      planType: PlanType.FREE,
      name: 'Gratuito',
      price: 0,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 50,
      commissionRate: 0.1, // 10%
      trialDays: 0,
    },
    {
      id: 'plan-basic-monthly',
      planType: PlanType.BASIC,
      name: 'Basico Mensal',
      price: 9.9,
      billingInterval: BillingInterval.MONTHLY,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-quarterly',
      planType: PlanType.BASIC,
      name: 'Basico Trimestral',
      price: 24.9,
      billingInterval: BillingInterval.QUARTERLY,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-semiannual',
      planType: PlanType.BASIC,
      name: 'Basico Semestral',
      price: 44.9,
      billingInterval: BillingInterval.SEMIANNUAL,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
    {
      id: 'plan-basic-annual',
      planType: PlanType.BASIC,
      name: 'Basico Anual',
      price: 79.9,
      billingInterval: BillingInterval.ANNUAL,
      collectionLimit: 200,
      commissionRate: 0.08, // 8%
      trialDays: 7,
    },
  ];

  for (const plan of planConfigs) {
    const result = await prisma.planConfig.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        collectionLimit: plan.collectionLimit,
        commissionRate: plan.commissionRate,
        trialDays: plan.trialDays,
        isActive: true,
      },
      create: {
        id: plan.id,
        planType: plan.planType,
        name: plan.name,
        price: plan.price,
        billingInterval: plan.billingInterval,
        collectionLimit: plan.collectionLimit,
        commissionRate: plan.commissionRate,
        trialDays: plan.trialDays,
        isActive: true,
      },
    });
    console.log(`  Plan config: ${result.name} (${result.id})`);
  }

  // Create default commission configs
  const freeCommission = await prisma.commissionConfig.upsert({
    where: { id: 'commission-free' },
    update: {},
    create: {
      id: 'commission-free',
      planType: PlanType.FREE,
      rate: 0.1, // 10%
      isActive: true,
    },
  });
  console.log(`  Commission config: FREE ${freeCommission.rate} (${freeCommission.id})`);

  const basicCommission = await prisma.commissionConfig.upsert({
    where: { id: 'commission-basic' },
    update: {},
    create: {
      id: 'commission-basic',
      planType: PlanType.BASIC,
      rate: 0.08, // 8%
      isActive: true,
    },
  });
  console.log(`  Commission config: BASIC ${basicCommission.rate} (${basicCommission.id})`);

  // Seed catalog data (categories, tags, characters, series, entries)
  await seedCatalog(admin.id);

  // Seed partner stores and deals
  await seedDeals();

  // Seed homepage sections
  await seedHomepage();

  // Seed legal documents
  await seedLegalDocuments();

  console.log('\nSeeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
