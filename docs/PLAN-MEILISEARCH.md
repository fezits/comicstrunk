# Plano: Meilisearch — Busca inteligente com tolerancia a erros

## Objetivo

Substituir a busca atual (MySQL LIKE via Prisma `contains`) por Meilisearch Cloud, ganhando:
- **Tolerancia a typos**: "Batiman" → Batman, "Roban" → Robin
- **Relevancia**: resultados ranqueados por qualidade do match
- **Sinonimos**: "HQ" = "quadrinhos" = "gibi"
- **Highlight**: termos buscados destacados nos resultados
- **Facets**: contagem por editora, categoria, formato nos filtros
- **Velocidade**: ~50ms por busca

## Estado Atual

- Busca usa `LIKE %palavra%` via Prisma `contains` (sem fuzzy, sem relevancia)
- Multi-word split em AND (todas as palavras devem estar presentes)
- Sem fulltext index no MySQL
- Arquivos-chave:
  - `apps/api/src/modules/catalog/catalog.service.ts` — searchCatalog() linhas 240-305
  - `apps/api/src/modules/marketplace/marketplace.service.ts` — search() linhas 35-144
  - `apps/api/src/modules/series/series.service.ts` — list() linhas 7-30
  - `apps/web/src/components/features/catalog/catalog-filters.tsx` — filtros UI
  - `apps/web/src/app/[locale]/(public)/catalog/page.tsx` — pagina do catalogo
  - `packages/contracts/src/catalog.ts` — catalogSearchSchema

## Decisoes Tecnicas

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Servico | Meilisearch Cloud | Free/Build tier, fuzzy nativo, zero infra |
| SDK frontend | meilisearch direto | Integra melhor com shadcn/ui existente |
| Sync | Hooks no service + script bulk | Consistencia sem complexidade |
| Escopo inicial | Catalogo + Marketplace + Series | Cobrir todas as buscas textuais existentes |
| Fallback | Manter busca Prisma como fallback | Se Meilisearch estiver fora, busca degradada funciona |

## Plano de Implementacao

---

### Fase 1: Infraestrutura (backend)

#### Task 1.1: Setup Meilisearch Cloud + client lib

**Arquivos:**
- `apps/api/.env` / `apps/api/.env.example`
- `apps/api/src/shared/lib/meilisearch.ts` (novo)
- `apps/api/package.json`

**Acoes:**
1. Criar conta em cloud.meilisearch.com, criar projeto (regiao: mais proxima do Brasil)
2. Copiar Host URL, Admin API Key, Search API Key
3. `pnpm --filter api add meilisearch`
4. Adicionar variaveis ao `.env` e `.env.example`:
   ```
   MEILISEARCH_HOST=https://ms-xxx.meilisearch.io
   MEILISEARCH_ADMIN_KEY=admin_key_aqui
   MEILISEARCH_SEARCH_KEY=search_key_aqui
   ```
5. Criar `apps/api/src/shared/lib/meilisearch.ts`:
   - Exportar `meiliClient` (instancia com admin key)
   - Exportar `configureCatalogIndex()` — configura searchable/filterable/sortable attributes, typo tolerance, sinonimos, stop words PT-BR
   - Exportar `indexCatalogEntry()`, `removeCatalogEntry()`, `indexCatalogEntries()` — helpers de sync
   - Exportar `transformToSearchDoc(prismaEntry)` — transforma record do Prisma em doc flat pro Meili
   - Graceful degradation: se MEILISEARCH_HOST nao estiver definido, funcoes retornam silenciosamente (nao quebra dev local)

**Configuracao do indice `catalog`:**
```
Searchable (ordem de importancia):
  title, seriesName, publisher, author, description, characters, tags, categories

Filterable:
  publisher, format, language, approvalStatus, categories, tags, characters,
  seriesId, publishYear, isForSale, condition, salePrice

Sortable:
  title, createdAt, averageRating, salePrice

Typo tolerance:
  enabled: true
  oneTypo: 4 chars (default 5 — captura "Roban"→"Robin")
  twoTypos: 8 chars
  desativado em: isbn, barcode, sourceKey
  desativado em numeros: true

Sinonimos:
  hq ↔ quadrinhos ↔ gibi ↔ comic
  manga ↔ manga

Stop words PT-BR:
  de, da, do, das, dos, em, no, na, o, a, os, as, e, ou, que, para, com, um, uma
```

#### Task 1.2: Script de indexacao em massa

**Arquivos:**
- `apps/api/scripts/sync-meilisearch.ts` (novo)
- `apps/api/package.json` (novo script)

**Acoes:**
1. Criar script que:
   - Chama `configureCatalogIndex()` para configurar o indice
   - Busca TODOS os CatalogEntry com `approvalStatus: 'APPROVED'` em batches de 1000
   - Inclui: series, categories, tags, characters (relacoes)
   - Transforma cada record via `transformToSearchDoc()`
   - Envia para Meilisearch em batches via `addDocuments()`
   - Loga progresso: "Indexed 1000/5432 entries..."
   - Aguarda conclusao das tasks com `waitForTask()`
2. Adicionar script ao package.json: `"search:sync": "tsx scripts/sync-meilisearch.ts"`
3. Documentar: `pnpm --filter api search:sync`

**Documento flat para o Meilisearch:**
```typescript
{
  id: string,              // CUID (primary key)
  title: string,
  slug: string,
  description: string | null,
  publisher: string | null,
  author: string | null,
  isbn: string | null,
  barcode: string | null,
  format: string | null,
  language: string | null,
  pageCount: number | null,
  publishYear: number | null,
  coverImageUrl: string | null,
  averageRating: number,
  approvalStatus: string,
  seriesId: string | null,
  seriesName: string | null,
  editionNumber: number | null,
  volumeNumber: number | null,
  categories: string[],     // nomes flat ["Manga", "Acao"]
  tags: string[],           // nomes flat ["Classico", "Shounen"]
  characters: string[],     // nomes flat ["Goku", "Vegeta"]
  createdAt: number,        // timestamp para sort
}
```

#### Task 1.3: Hooks de sync incremental nos services

**Arquivos:**
- `apps/api/src/modules/catalog/catalog.service.ts`
- `apps/api/src/modules/catalog/catalog-import.service.ts`

**Acoes:**
1. No `catalog.service.ts`, adicionar chamadas fire-and-forget apos cada operacao:
   - `create()` → se aprovado, `indexCatalogEntry(doc)` 
   - `update()` → se aprovado, `indexCatalogEntry(doc)`; se nao aprovado, `removeCatalogEntry(id)`
   - `delete()` → `removeCatalogEntry(id)`
   - `approve()` → `indexCatalogEntry(doc)`
   - `reject()` → `removeCatalogEntry(id)`
2. No `catalog-import.service.ts`, apos import em massa:
   - Coletar IDs dos entries criados/atualizados
   - Buscar do DB com includes e indexar em batch via `indexCatalogEntries()`
3. Todas as chamadas Meilisearch sao fire-and-forget (nao bloqueiam a response)
4. Wrap em try/catch — falha no Meilisearch nao deve quebrar o CRUD normal

---

### Fase 2: Endpoint de busca (backend)

#### Task 2.1: Novo endpoint de busca via Meilisearch

**Arquivos:**
- `apps/api/src/modules/catalog/catalog.routes.ts`
- `apps/api/src/modules/catalog/catalog.service.ts`
- `packages/contracts/src/catalog.ts`

**Acoes:**
1. Adicionar no contracts um `catalogMeiliSearchSchema`:
   ```typescript
   export const catalogMeiliSearchSchema = z.object({
     q: z.string().default(''),
     page: z.coerce.number().int().min(1).default(1),
     limit: z.coerce.number().int().min(1).max(100).default(20),
     publisher: z.string().optional(),
     categoryIds: z.string().optional(),   // comma-separated names
     characterIds: z.string().optional(),  // comma-separated names
     tagIds: z.string().optional(),        // comma-separated names
     seriesId: z.string().optional(),
     yearFrom: z.coerce.number().optional(),
     yearTo: z.coerce.number().optional(),
     sortBy: z.enum(['relevance', 'title', 'createdAt', 'averageRating']).default('relevance'),
     sortOrder: z.enum(['asc', 'desc']).default('desc'),
   });
   ```
2. Adicionar `searchViaMeili()` no service:
   - Monta filtros Meilisearch: `approvalStatus = "APPROVED"` + filtros do usuario
   - Chama `catalogIndex.search(q, { page, hitsPerPage, filter, sort, facets, highlight })`
   - Retorna hits com highlight, facetDistribution, pagination info
3. Adicionar rota `GET /api/v1/catalog/search`:
   - Valida com `catalogMeiliSearchSchema`
   - Chama `searchViaMeili()`
   - Retorna no formato padrao `sendPaginated()`
4. **Manter o endpoint antigo** `GET /api/v1/catalog` funcionando como fallback

**Response do novo endpoint:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "title": "Batman: O Cavaleiro das Trevas",
      "_formatted": {
        "title": "<mark>Batman</mark>: O Cavaleiro das Trevas"
      },
      "publisher": "Panini",
      "coverImageUrl": "...",
      "categories": ["Super-heroi", "DC Comics"],
      "characters": ["Batman", "Coringa"]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
  "facets": {
    "publisher": { "Panini": 25, "JBC": 10, "NewPOP": 7 },
    "categories": { "Manga": 15, "Super-heroi": 12 }
  },
  "processingTimeMs": 3
}
```

#### Task 2.2: Busca no marketplace via Meilisearch

**Arquivos:**
- `apps/api/src/modules/marketplace/marketplace.service.ts`
- `apps/api/src/modules/marketplace/marketplace.routes.ts`

**Acoes:**
1. Opcao A (recomendada): Criar um indice separado `marketplace` com CollectionItems onde `isForSale = true`
   - Documento inclui: todos os campos do catalogo + salePrice, condition, sellerId, sellerName
   - Sync: hooks no collection.service quando marca/desmarca como for sale
2. Opcao B (mais simples): Reutilizar indice `catalog` com campo `isForSale` filtravel
   - Menos preciso pois um CatalogEntry pode ter multiplos listings com precos diferentes
3. **Decisao**: Opcao A para marketplace real, Opcao B como MVP rapido

#### Task 2.3: Busca de series via Meilisearch

**Arquivos:**
- `apps/api/src/modules/series/series.service.ts`

**Acoes:**
1. Criar indice `series` com campos: id, title, slug, publisher, description, entryCount
2. Configurar searchable: [title, publisher, description]
3. Adicionar busca fuzzy no endpoint existente GET /api/v1/series
4. Sync: hooks no series.service CRUD

---

### Fase 3: Frontend

#### Task 3.1: Client Meilisearch no frontend

**Arquivos:**
- `apps/web/.env.local` / `apps/web/.env.example`
- `apps/web/src/lib/meilisearch.ts` (novo)
- `apps/web/package.json`

**Acoes:**
1. `pnpm --filter web add meilisearch`
2. Adicionar variaveis:
   ```
   NEXT_PUBLIC_MEILISEARCH_HOST=https://ms-xxx.meilisearch.io
   NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=search_key_aqui
   ```
3. Criar `apps/web/src/lib/meilisearch.ts`:
   - Exportar searchClient com search key (read-only, seguro no browser)
   - Exportar helper `searchCatalog(q, filters, page)` tipado

#### Task 3.2: Atualizar pagina do catalogo

**Arquivos:**
- `apps/web/src/app/[locale]/(public)/catalog/page.tsx`
- `apps/web/src/components/features/catalog/catalog-filters.tsx`
- `apps/web/src/lib/api/catalog.ts`

**Acoes:**
1. No `catalog.ts` API client, adicionar `searchCatalogMeili()` que chama o novo endpoint `/catalog/search`
   - OU: chamar Meilisearch direto do frontend (mais rapido, menos carga no backend)
2. Atualizar `catalog/page.tsx`:
   - Trocar chamada de `searchCatalog()` por `searchCatalogMeili()`
   - Usar highlights nos resultados (titulo com `<mark>`)
   - Adicionar facets dinamicos nos filtros (contagem por editora/categoria)
3. Atualizar `catalog-filters.tsx`:
   - Mostrar contagem de resultados por filtro usando facetDistribution
   - Ex: "Panini (25)" ao lado do checkbox

**Decisao frontend: busca direta vs via API**
- **Direta** (frontend → Meilisearch): Mais rapido (~50ms), menos carga no API server. Search key e read-only, seguro.
- **Via API** (frontend → Express → Meilisearch): Permite adicionar logica extra (analytics, rate limit). Mais latencia.
- **Recomendacao**: Busca direta para catalogo publico. Via API se precisar de logica server-side.

#### Task 3.3: Atualizar busca do marketplace

**Arquivos:**
- `apps/web/src/components/features/marketplace/marketplace-listing-page.tsx`
- `apps/web/src/components/features/marketplace/marketplace-filters.tsx`

**Acoes:**
1. Mesma abordagem: trocar busca LIKE por Meilisearch
2. Adicionar facets para condition, faixa de preco, editora

#### Task 3.4: Busca global (header) — opcional/futuro

**Arquivos:**
- `apps/web/src/components/layout/header.tsx`
- `apps/web/src/components/features/search/global-search.tsx` (novo)

**Acoes:**
1. Componente de busca global no header (icone de lupa)
2. Dropdown com resultados ao digitar (typeahead)
3. Multi-index: busca simultanea em catalog + series + marketplace
4. Resultados agrupados por tipo: "Catalogo (5)", "Series (2)", "Marketplace (3)"
5. Meilisearch suporta multi-index search nativamente

---

### Fase 4: Refinamentos

#### Task 4.1: Sinonimos e ajustes de relevancia

**Acoes:**
1. Monitorar buscas sem resultado (logar no backend)
2. Adicionar sinonimos conforme necessidade:
   - Nomes de personagens: "Homem-Aranha" ↔ "Spider-Man", "Wolverine" ↔ "Logan"
   - Editoras: "Panini" ↔ "Panini Comics"
   - Formatos: "tankobon" ↔ "manga"
3. Ajustar ranking rules se necessario
4. Adicionar distinct attribute se houver duplicatas nos resultados

#### Task 4.2: Analytics de busca

**Acoes:**
1. Logar termos buscados (endpoint ou middleware)
2. Dashboard admin: termos mais buscados, buscas sem resultado
3. Usar para alimentar sinonimos e melhorar catalogo

---

## Ordem de Execucao

```
Fase 1 (backend infra)     ████████████░░░░░░░░  ~2 dias
  1.1 Setup client/config   ██████░░░░░░░░░░░░░░  0.5 dia
  1.2 Script bulk index      ████░░░░░░░░░░░░░░░░  0.5 dia
  1.3 Hooks de sync          ██████░░░░░░░░░░░░░░  1 dia

Fase 2 (endpoints)          ████████████░░░░░░░░  ~2 dias
  2.1 Catalog search         ████████░░░░░░░░░░░░  1 dia
  2.2 Marketplace search     ████░░░░░░░░░░░░░░░░  0.5 dia
  2.3 Series search          ████░░░░░░░░░░░░░░░░  0.5 dia

Fase 3 (frontend)           ████████████░░░░░░░░  ~2 dias
  3.1 Client setup           ██░░░░░░░░░░░░░░░░░░  0.25 dia
  3.2 Catalogo UI            ████████░░░░░░░░░░░░  1 dia
  3.3 Marketplace UI         ████░░░░░░░░░░░░░░░░  0.5 dia
  3.4 Busca global           ████░░░░░░░░░░░░░░░░  opcional

Fase 4 (refinamento)        ████░░░░░░░░░░░░░░░░  continuo
```

## Verificacao

- [ ] "Batiman" retorna Batman nos resultados
- [ ] "Roban" retorna Robin nos resultados
- [ ] "dragon bal" retorna Dragon Ball
- [ ] Filtros por editora/categoria/formato funcionam com busca fuzzy
- [ ] Resultados mostram highlight nos termos buscados
- [ ] Facets mostram contagem correta por filtro
- [ ] CRUD no catalogo reflete no Meilisearch em segundos
- [ ] Import em massa sincroniza corretamente
- [ ] Busca funciona no marketplace com preco/condicao
- [ ] Se Meilisearch estiver fora do ar, busca degradada (Prisma) funciona
- [ ] Search key no frontend nao permite modificar dados

## Custos

| Item | Custo |
|------|-------|
| Meilisearch Cloud (Build) | $30/mes ou free tier se <10k docs |
| SDK meilisearch (npm) | Gratuito |
| Desenvolvimento | ~6 dias |

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Meilisearch fora do ar | Fallback para busca Prisma existente |
| Dados dessincronizados | Script de re-sync completo + logs de falha |
| Free tier insuficiente | Monitorar uso, upgrade quando necessario |
| Latencia cross-region | Escolher regiao mais proxima do Brasil |
