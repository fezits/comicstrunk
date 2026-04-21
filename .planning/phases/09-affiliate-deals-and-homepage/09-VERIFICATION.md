# Phase 09 — Ofertas de Afiliados e Homepage: Guia de Verificação

## Pré-requisitos
1. API rodando: `pnpm --filter api dev` (porta 3001)
2. Web rodando: `pnpm --filter web dev` (porta 3000)
3. Seed data: `pnpm --filter api db:seed` (cria lojas parceiras, ofertas e seções da homepage)

## 1. Lojas Parceiras (Admin)

### 1.1 Criar loja parceira
- Login como admin, acesse `/admin/deals` → aba "Lojas Parceiras"
- Clique "Nova Loja"
- Preencha: Nome, Slug (auto-gerado), Tag de Afiliado, URL Base
- **Esperado**: Loja criada, aparece na tabela

### 1.2 Editar loja
- Clique no botão editar de uma loja
- Altere o nome
- **Esperado**: Nome atualizado na tabela

### 1.3 Desativar/ativar loja
- Toggle o switch de status
- **Esperado**: Status muda, loja inativa não aparece em filtros públicos

## 2. Ofertas (Admin)

### 2.1 Criar oferta tipo Cupom
- Aba "Ofertas", clique "Nova Oferta"
- Selecione loja, tipo "Cupom", preencha título, desconto (ex: "15% OFF"), código do cupom
- Defina data de expiração futura
- **Esperado**: Oferta criada com tipo COUPON

### 2.2 Criar oferta tipo Promoção
- Tipo "Promoção", sem código de cupom
- Upload de banner (imagem)
- **Esperado**: Oferta criada com banner visível

### 2.3 Gerenciar ofertas
- Filtrar por loja, tipo, status
- Editar oferta existente
- Desativar oferta (toggle)
- **Esperado**: Filtros funcionam, edição salva, toggle muda status

### 2.4 Oferta expirada
- Crie oferta com expiração no passado (ou espere o cron de 2h da manhã)
- **Esperado**: Status mostra "Expirada" no admin, não aparece na página pública

## 3. Página Pública /deals

### 3.1 Listagem de ofertas
- Acesse `/deals` (sem login necessário)
- **Esperado**: Grid com ofertas ativas, disclosure de afiliado visível no topo

### 3.2 Filtros
- Filtre por loja específica
- Filtre por tipo (Cupons/Promoções)
- Ordene por "Expirando em breve"
- **Esperado**: Lista filtrada corretamente

### 3.3 Card de cupom
- Encontre oferta tipo Cupom
- Clique no botão de copiar código
- **Esperado**: Código copiado, toast "Copiado!" aparece

### 3.4 Click tracking
- Clique em "Ver oferta" em qualquer deal
- **Esperado**: Abre nova aba com URL do parceiro (com tag de afiliado), clique registrado no analytics

### 3.5 Deduplicação de cliques
- Clique na mesma oferta 2x em menos de 1 hora
- **Esperado**: Apenas 1 clique registrado no analytics

## 4. Analytics de Cliques (Admin)

### 4.1 Dashboard
- Aba "Analytics" em `/admin/deals`
- **Esperado**: Cards com total de cliques, cliques únicos, ofertas ativas
- Tabela com cliques por oferta
- Barras horizontais com cliques por loja

### 4.2 Filtro por período
- Selecione "Últimos 7 dias", "Últimos 30 dias"
- **Esperado**: Dados filtrados pelo período

### 4.3 Exportar CSV
- Clique "Exportar CSV"
- **Esperado**: Download de arquivo CSV com dados de cliques

## 5. Homepage

### 5.1 Homepage pública
- Acesse `/` (raiz do site)
- **Esperado**: NÃO redireciona para /catalog
- **Esperado**: Hero section com "Comics Trunk", tagline, botões CTA
- **Esperado**: Seções configuráveis abaixo (carrossel, destaques, ofertas do dia, cupons)

### 5.2 Carrossel de banners
- Seção BANNER_CAROUSEL
- **Esperado**: Auto-rotação a cada 5s, dots de navegação, clique leva à oferta/catálogo

### 5.3 Catálogo em Destaque
- Seção CATALOG_HIGHLIGHTS
- **Esperado**: Grid de cards com capa, título, série, avaliação em estrelas

### 5.4 Ofertas do Dia
- Seção DEALS_OF_DAY
- **Esperado**: Strip horizontal com ofertas expirando em breve, botão "Ver oferta"

### 5.5 Cupons em Destaque
- Seção FEATURED_COUPONS
- **Esperado**: Cards com código de cupom, botão copiar, loja

## 6. Configuração da Homepage (Admin)

### 6.1 Listar seções
- Acesse `/admin/homepage`
- **Esperado**: Lista de seções com tipo, título, visibilidade, ordem

### 6.2 Reordenar seções
- Use as setas para mover seções para cima/baixo
- **Esperado**: Ordem atualizada, refletida na homepage pública

### 6.3 Ocultar/mostrar seção
- Toggle visibilidade de uma seção
- **Esperado**: Seção oculta não aparece na homepage pública

### 6.4 Criar nova seção
- Clique "Nova Seção", selecione tipo, defina título
- **Esperado**: Seção criada e visível na homepage

### 6.5 Excluir seção
- Delete uma seção
- **Esperado**: Seção removida, homepage atualizada

## 7. API Endpoints (para testes via curl)

```bash
# === OFERTAS PÚBLICAS ===

# Listar ofertas ativas
curl http://localhost:3001/api/v1/deals

# Filtrar por loja
curl "http://localhost:3001/api/v1/deals?storeId=<STORE_ID>"

# Filtrar por tipo
curl "http://localhost:3001/api/v1/deals?type=COUPON"

# Ver oferta específica
curl http://localhost:3001/api/v1/deals/<ID>

# Listar lojas ativas
curl http://localhost:3001/api/v1/deals/stores

# Click tracking (redireciona)
curl -L http://localhost:3001/api/v1/deals/click/<DEAL_ID>

# === HOMEPAGE PÚBLICA ===

# Dados da homepage
curl http://localhost:3001/api/v1/homepage

# === ADMIN OFERTAS ===

# Listar todas as ofertas (admin)
curl http://localhost:3001/api/v1/deals/admin/list \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Criar oferta
curl -X POST http://localhost:3001/api/v1/deals/admin \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"<ID>","type":"COUPON","title":"Desconto HQs Marvel","discount":"15% OFF","couponCode":"MARVEL15","affiliateBaseUrl":"https://amazon.com.br/hqs-marvel"}'

# Atualizar oferta
curl -X PUT http://localhost:3001/api/v1/deals/admin/<ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Novo título"}'

# === ADMIN LOJAS ===

# Listar todas as lojas (admin)
curl http://localhost:3001/api/v1/deals/stores/admin/list \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Criar loja
curl -X POST http://localhost:3001/api/v1/deals/stores/admin \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Amazon BR","slug":"amazon-br","affiliateTag":"comicstrunk-20","baseUrl":"https://amazon.com.br"}'

# === ANALYTICS ===

# Dashboard de cliques
curl "http://localhost:3001/api/v1/deals/admin/analytics?startDate=2026-01-01" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Exportar CSV
curl "http://localhost:3001/api/v1/deals/admin/analytics/export" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# === HOMEPAGE ADMIN ===

# Listar seções
curl http://localhost:3001/api/v1/homepage/admin/sections \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Criar seção
curl -X POST http://localhost:3001/api/v1/homepage/admin/sections \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"DEALS_OF_DAY","title":"Ofertas do Dia","sortOrder":5,"isVisible":true}'

# Reordenar seções
curl -X POST http://localhost:3001/api/v1/homepage/admin/sections/reorder \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderedIds":["<ID1>","<ID2>","<ID3>","<ID4>"]}'
```

## Resumo dos Arquivos

### Contracts
- `packages/contracts/src/deals.ts` — Schemas para PartnerStore + Deal
- `packages/contracts/src/homepage.ts` — Schemas para HomepageSection

### API (Backend)
- `apps/api/src/modules/deals/partner-stores.service.ts` — CRUD lojas parceiras
- `apps/api/src/modules/deals/deals.service.ts` — CRUD ofertas + composição URL afiliado
- `apps/api/src/modules/deals/clicks.service.ts` — Tracking de cliques + analytics + CSV
- `apps/api/src/modules/deals/deals.routes.ts` — 15 endpoints (público + admin + analytics)
- `apps/api/src/modules/homepage/homepage.service.ts` — CRUD seções + montagem homepage
- `apps/api/src/modules/homepage/homepage.routes.ts` — 6 endpoints (público + admin)
- `apps/api/prisma/seed-deals.ts` — Seed: 3 lojas, 8 ofertas

### Web (Frontend)
- `apps/web/src/lib/api/deals.ts` — Cliente API ofertas
- `apps/web/src/lib/api/homepage.ts` — Cliente API homepage
- `apps/web/src/components/features/deals/` — 9 componentes (cards, filtros, grid, admin)
- `apps/web/src/components/features/homepage/` — 8 componentes (carrossel, destaques, admin)
- 4 rotas de página (deals público, admin deals, admin homepage, homepage)

### Modificados
- `packages/contracts/src/index.ts` — Exports deals + homepage
- `apps/api/src/create-app.ts` — Registro de rotas
- `apps/api/src/shared/cron/index.ts` — Cron expiração de ofertas (2h)
- `apps/api/prisma/seed.ts` — Seed deals + homepage
- `apps/web/src/app/[locale]/(public)/page.tsx` — Homepage real (não mais redirect)
- Nav config + traduções PT-BR
