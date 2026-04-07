# Comics Trunk

Plataforma brasileira para colecionadores de quadrinhos (gibis, HQs, mangás). Combina gestão de coleção, marketplace peer-to-peer e comunidade em um único lugar.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui, next-intl |
| **Backend** | Express, Node.js, Prisma ORM, MySQL |
| **Contratos** | Zod schemas + TypeScript types (pacote compartilhado) |
| **Monorepo** | pnpm 9.15 workspaces + Turborepo |
| **Deploy** | cPanel com Passenger (API + Web separados) |

## Estrutura

```
apps/api/          Express backend (porta 3001)
apps/web/          Next.js frontend (porta 3000)
packages/contracts Schemas Zod + tipos TypeScript compartilhados
docs/              Documentação (PRD, deploy, sync, planos)
e2e/               Testes E2E com Playwright
```

## Funcionalidades Implementadas

| Fase | Funcionalidade |
|------|---------------|
| 1 | Infraestrutura, auth JWT (access + refresh), perfil com links sociais |
| 2 | Catálogo curado com aprovação editorial, taxonomia (séries, categorias, tags, personagens), busca com filtros |
| 3 | Coleção pessoal, status de leitura, progresso de séries, import/export CSV, limites por plano |
| 4 | Marketplace, carrinho com reserva 24h, pedidos com snapshot de preços, comissões, envio com tracking |
| 5 | Pagamento PIX (Mercado Pago), webhooks idempotentes, histórico de pagamentos, dados bancários |
| 6 | Assinaturas FREE/BASIC (Stripe), downgrade automático, enforcement de limites |
| 7 | Reviews, comentários, favoritos, notificações in-app, emails transacionais (Resend) |
| 8 | Disputas com mediação admin, evidências, reembolso, retenção de repasse |
| 9 | Ofertas de afiliados, click tracking, homepage configurável, analytics |
| 10 | Admin unificado, documentos legais, LGPD, formulário de contato |
| Sync | Importação de catálogo via API remota (Rika VTEX + Panini GraphQL), sync incremental |

## Módulos da API

29 módulos em `apps/api/src/modules/`:
admin, auth, banking, cart, catalog, categories, characters, collection, comments, commission, contact, deals, disputes, favorites, homepage, legal, lgpd, marketplace, notifications, orders, payments, reviews, series, shipping, subscriptions, sync, tags, users

## Rotas do Frontend

69 páginas organizadas em grupos:
- **(admin)** — Painel admin (catálogo, usuários, comissões, deals, disputas, legal, LGPD, pagamentos, assinaturas)
- **(auth)** — Login, cadastro, recuperação de senha
- **(collector)** — Coleção, favoritos, notificações, assinatura, endereços, pagamentos
- **(orders)** — Pedidos e disputas do comprador
- **(public)** — Catálogo, marketplace, séries, deals, contato, políticas
- **(seller)** — Dashboard do vendedor, pedidos, dados bancários, disputas

## Comandos

```bash
# Desenvolvimento
pnpm dev                # API (3001) + Web (3000)
pnpm build              # Build completo (contracts → API → Web)
pnpm lint               # Lint em todos os pacotes
pnpm type-check         # TypeScript check

# API
pnpm --filter api dev
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api db:studio

# Web
pnpm --filter web dev
pnpm --filter web build

# Sync de catálogo
cd apps/api
npx tsx scripts/sync-catalog.ts              # Incremental
npx tsx scripts/sync-catalog.ts --dry-run    # Simulação
npx tsx scripts/sync-catalog.ts --full       # Varredura completa
```

## Deploy

```bash
./scripts/deploy-api.sh    # Build + copy + restart Passenger
./scripts/deploy-web.sh    # Build standalone + sync to cPanel
./scripts/backup-db.sh     # Backup MySQL com rotação
```

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para detalhes.

## Documentação

- [PRD](docs/PRD.md) — Requisitos do produto
- [Deployment](docs/DEPLOYMENT.md) — Deploy no cPanel
- [Sync de Catálogo](docs/SYNC-CATALOG.md) — Importação Rika/Panini
- [Sync API Remoto](docs/planos/sync-api-remoto.md) — Endpoints de sync via HTTP
