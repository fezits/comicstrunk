# Comics Trunk

Plataforma brasileira para colecionadores de quadrinhos (gibis, HQs, mangás). Combina gestão de coleção, marketplace peer-to-peer e comunidade em um único lugar.

**Produção:** [comicstrunk.com](https://comicstrunk.com)

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui, next-intl |
| **Backend** | Express, Node.js, Prisma ORM, MySQL |
| **Contratos** | Zod schemas + TypeScript types (pacote compartilhado) |
| **Pagamentos** | PIX estático (pix-utils), Stripe (assinaturas) |
| **Monorepo** | pnpm 9.15 workspaces + Turborepo |
| **Deploy** | cPanel com Passenger (API + Web separados) |

## Estrutura

```
apps/api/          Express backend (porta 3001)
apps/web/          Next.js frontend (porta 3000)
packages/contracts Schemas Zod + tipos TypeScript compartilhados
docs/              Documentação (PRD, deploy, sync, planos)
scripts/           Deploy, scraping, importação, testes
```

## Setup Local

```bash
# Pré-requisitos: Node.js 20+, Docker Desktop (para MySQL)

# 1. Instalar dependências
corepack pnpm install

# 2. Subir MySQL
docker start comicstrunk-mysql

# 3. Configurar ambiente
cp apps/api/.env.example apps/api/.env

# 4. Aplicar migrations
corepack pnpm --filter api db:migrate

# 5. Iniciar dev
corepack pnpm dev
```

**Nota Windows:** `pnpm` não está no PATH. Sempre usar `corepack pnpm`.

## Catálogo

34k+ gibis de múltiplas fontes, 6.2k+ séries, URLs com slugs SEO-friendly.

| Fonte | Categorias | Gibis |
|-------|-----------|-------|
| Rika (VTEX API) | Super-heróis, Mangás | ~27k |
| Panini (GraphQL) | Marvel, DC, Mangás | ~7k |

Busca combina título e editora no mesmo campo (ex: "dragon ball conrad").

## Funcionalidades

| Fase | Funcionalidade |
|------|---------------|
| 1 | Infraestrutura, auth JWT (access + refresh), perfil com links sociais |
| 2 | Catálogo com slugs, aprovação editorial, taxonomia, busca por título + editora |
| 3 | Coleção pessoal, adicionar em lote (por série + busca rápida), 3 modos de visualização, limites por plano (FREE: 1000, BASIC: 5000) |
| 4 | Marketplace, carrinho com reserva, pedidos, comissões 10%, envio com tracking |
| 5 | Pagamento PIX estático (pix-utils, sem intermediário), confirmação manual pelo admin |
| 6 | Assinaturas FREE/BASIC (Stripe), downgrade automático |
| 7 | Reviews, comentários, favoritos, notificações in-app, emails (Resend) |
| 8 | Disputas com mediação admin, evidências, reembolso |
| 9 | Ofertas de afiliados, click tracking, homepage configurável |
| 10 | Admin unificado, documentos legais, LGPD, contato |
| SEO | Slugs em catálogo e séries, favicon, redirect 301 de CUID para slug |

## Comandos

```bash
# Desenvolvimento
corepack pnpm dev                # API (3001) + Web (3000)
corepack pnpm build              # Build completo (contracts → API → Web)
corepack pnpm lint               # Lint em todos os pacotes
corepack pnpm type-check         # TypeScript check

# API
corepack pnpm --filter api dev
corepack pnpm --filter api db:migrate
corepack pnpm --filter api db:seed
corepack pnpm --filter api db:studio

# Web
corepack pnpm --filter web dev
corepack pnpm --filter web build

# Sync de catálogo
cd apps/api
npx tsx scripts/sync-catalog.ts              # Incremental
npx tsx scripts/sync-catalog.ts --full       # Varredura completa
```

## Deploy

Guia completo em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Regra principal:** nunca rodar `pnpm install` ou `next build` no servidor (1GB RAM compartilhada). Todo build é local.

```bash
./scripts/deploy.sh api    # Build + copy + restart
```

Web deploy é manual (ver docs) — requer substituição do server.js por versão custom que serve arquivos estáticos.

## Documentação

- [CLAUDE.md](CLAUDE.md) — Guia para Claude Code / AI assistants
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Deploy passo a passo no cPanel
- [docs/SYNC-CATALOG.md](docs/SYNC-CATALOG.md) — Importação de catálogo (Rika + Panini)
- [docs/PRD.md](docs/PRD.md) — Requisitos do produto
