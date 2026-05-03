# Busca unificada catálogo + coleção — design

**Data:** 2026-05-02
**Status:** Design aprovado, pendente implementação

## Problema

Hoje as duas buscas divergem em comportamento e UX:

1. **Coleção não casa palavras separadas.** O backend faz só `catalogEntry.title.contains(query)` — uma substring única. Buscar "dragon ball" não retorna nada se o título não contém exatamente essa string.
2. **Coleção esconde a busca dentro do painel de filtros.** No mobile, o usuário precisa abrir o Sheet de filtros, digitar e dar Enter ou tirar foco. Pouco descobrível.
3. **Mobile não tem botão de busca explícito** em nenhuma das duas páginas. A única forma de disparar é Enter no teclado virtual ou perda de foco.
4. **Desktop dispara busca a partir do 1º caractere** (debounce 400ms catálogo, 300ms coleção). Causa requisições desnecessárias com 1-2 chars que retornam dezenas de milhares de resultados irrelevantes.

## Objetivo

- Coleção e catálogo passam a usar a **mesma lógica de busca** (multi-token, casa em `title` OR `publisher`).
- Coleção e catálogo passam a usar a **mesma UI de busca** (componente `<SearchBar>` compartilhado).
- Mobile ganha **botão lupa clicável** dentro do input.
- Desktop **só dispara busca automática a partir do 3º caractere**; Enter sempre dispara.

## Não-objetivos

- Não mudar lógica de busca em outras superfícies (séries, marketplace, admin) nesta entrega — `<SearchBar>` fica disponível para reuso depois.
- Não introduzir Meilisearch/full-text search — fica para o plano dedicado em `docs/PLAN-MEILISEARCH.md`.
- Não mudar contrato Zod nem rota da API.

## Arquitetura

### Backend — `getItems` da coleção

**Arquivo:** `apps/api/src/modules/collection/collection.service.ts`

Substituir o bloco atual:

```ts
if (query) {
  where.catalogEntry = {
    title: { contains: query },
  };
}
// ...
if (seriesId) {
  where.catalogEntry = {
    ...((where.catalogEntry as Prisma.CatalogEntryWhereInput) ?? {}),
    seriesId,
  };
}
```

Por uma construção unificada que reproduz o padrão do `searchCatalog`:

```ts
const catalogEntryFilter: Prisma.CatalogEntryWhereInput = {};

if (query) {
  const words = query.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1) {
    catalogEntryFilter.OR = [
      { title: { contains: words[0] } },
      { publisher: { contains: words[0] } },
    ];
  } else if (words.length > 1) {
    catalogEntryFilter.AND = words.map((word) => ({
      OR: [
        { title: { contains: word } },
        { publisher: { contains: word } },
      ],
    }));
  }
}

if (seriesId) {
  catalogEntryFilter.seriesId = seriesId;
}

if (Object.keys(catalogEntryFilter).length > 0) {
  where.catalogEntry = catalogEntryFilter;
}
```

**Compatibilidade:** sem mudança de schema, contrato (`collectionSearchSchema`), rota ou response shape. Apenas comportamento interno do `WHERE`.

### Frontend — componente `<SearchBar>`

**Novo arquivo:** `apps/web/src/components/ui/search-bar.tsx`

```ts
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
  minCharsForAutoSubmit?: number; // default 3
  debounceMs?: number;             // default 400
}
```

**Renderização:**

- `<div className="relative ...">` wrapper.
- `<Search>` ícone lucide à esquerda (decorativo, não-clicável). Posição: `absolute left-3 top-1/2 -translate-y-1/2`.
- `<Input type="search" />` controlado por `value`.
- `<Button>` lucide `<Search>` à direita, `variant="ghost"`, `size="icon"`, `className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 md:hidden"` — visível apenas em mobile via CSS (não via `useIsMobile()` no render, evita SSR mismatch).
- Padding do input: `pl-9 pr-10` em todos os breakpoints (espaço sempre reservado para o botão; no desktop o botão é `hidden`, então fica decorativo o pr-10).

**Comportamento:**

| Evento | Mobile (< md) | Desktop (≥ md) |
|---|---|---|
| Digitação | Não dispara `onSubmit`. Só atualiza `value` via `onChange`. | Debounce 400ms; só chama `onSubmit` se `value.trim().length >= 3` OU `=== 0` (limpar). |
| Enter no input | Dispara `onSubmit(value)` imediatamente. | Igual mobile. |
| Click no botão lupa | Dispara `onSubmit(value)` imediatamente. | Botão não é visível (mas se clicado por A11y, dispara igual). |
| `value` muda externamente (URL sync) | Não dispara `onSubmit`. | Igual mobile. |

**Detecção mobile/desktop:** via Tailwind breakpoint (`md:hidden`/`md:flex`), não via JS. Para a lógica de auto-submit, uso `useIsMobile()` apenas para decidir se inicio o debounce — fonte única de verdade.

**Anti-loop:**
- `lastSubmittedRef.current` guarda o último valor que disparou `onSubmit`. Auto-submit só dispara se `value.trim() !== lastSubmittedRef.current`.
- Submit manual (Enter/click) também atualiza `lastSubmittedRef`.

**Cleanup:** `useEffect` de cleanup para limpar o timer no unmount; cada nova digitação cancela timer anterior.

### Frontend — integração no catálogo

**Arquivo:** `apps/web/src/app/[locale]/(public)/catalog/page.tsx`

Substituir o bloco atual da search bar (`<div className="relative flex-1 max-w-lg">`, ~10 linhas) por:

```tsx
<SearchBar
  value={searchInput}
  onChange={setSearchInput}
  onSubmit={(v) => submitSearch(v)}
  placeholder={t('searchPlaceholder')}
  className="flex-1 max-w-lg"
/>
```

Remover da page: `searchTimer` ref, `handleSearchInputChange`, `useIsMobile` (vai pro componente). Manter: `searchInput` state, `useEffect` de sync com URL, `submitSearch`.

### Frontend — integração na coleção

**Arquivos:** `apps/web/src/app/[locale]/(collector)/collection/page.tsx` e `apps/web/src/components/features/collection/collection-filters.tsx`

**Em `collection-filters.tsx`:**
- Remover prop não usada após mudança: nenhuma (o componente continua recebendo `filters` para os outros campos).
- Remover bloco `<FilterSection title={t('searchPlaceholder')}>` e o `Input` interno.
- Remover state `searchInput`, `searchTimer`, `useIsMobile`, `submitSearch`, `handleSearchInputChange`. O componente fica focado em condition/read/sale/sort.

**Em `collection/page.tsx`:**
- Adicionar `const [searchInput, setSearchInput] = useState(filters.query ?? '')` e `useEffect(() => setSearchInput(filters.query ?? ''), [filters.query])`.
- Adicionar nova linha entre `<CollectionStats>` e `<div className="flex gap-8">`:

```tsx
<div className="flex justify-end">
  <SearchBar
    value={searchInput}
    onChange={setSearchInput}
    onSubmit={(v) => handleFiltersChange({ ...filters, query: v || undefined, page: 1 })}
    placeholder={t('searchPlaceholder')}
    className="w-full sm:max-w-lg"
  />
</div>
```

### i18n

**Adicionar em `apps/web/messages/pt-BR.json`:**
- `common.searchAriaLabel`: `"Buscar"` — ASCII no key, valor com acento.

Reaproveitar `catalog.searchPlaceholder` e `collection.searchPlaceholder` existentes.

## Plano de teste e verificação

**Regra estrita:** ao declarar pronto, listar comandos exatos rodados, URL/endpoint, e output observado. Sem isso, não é "pronto".

### Backend

1. `pnpm --filter api dev` (porta 3001).
2. Login para obter token JWT (POST `/api/v1/auth/login` com `vai_q_eh@yahoo.com.br` / `Ct@2026!Teste`).
3. `curl -H "Authorization: Bearer ..." "http://localhost:3001/api/v1/collection?query=spider"` — esperar 200, `total > 0` se a conta tem item Spider.
4. `curl ... "?query=dragon%20ball"` — esperar match com itens cuja CatalogEntry tem "dragon" e "ball" no título (separados ou juntos).
5. `curl ... "?query=marvel%20deluxe"` — esperar match com itens onde "marvel" está no publisher e "deluxe" no título (ou vice-versa).
6. `curl ... "?query="` — esperar todos os itens (paginação default).
7. `curl ... "?query=ZZZNOEXISTE"` — esperar `total: 0`.
8. `curl ... "?query=spider&seriesId=<id-real>"` — esperar combinação correta.

Output a registrar: `total` retornado em cada caso.

### Frontend — catálogo

1. `pnpm --filter web dev` (porta 3000).
2. Abrir `http://localhost:3000/pt-BR/catalog`.
3. **Desktop (viewport ≥ 768px):**
   - Digitar "s" → URL não muda (esperar 1 segundo). ✓
   - Digitar "sp" → URL não muda. ✓
   - Digitar "spi" → após 400ms, URL ganha `?title=spi`. ✓
   - Apagar até vazio → URL perde `?title=`. ✓
   - Digitar "x", apertar Enter → URL ganha `?title=x` imediatamente. ✓
4. **Mobile (DevTools responsive 390px):**
   - Botão lupa visível à direita do input. ✓
   - Digitar "spi" → URL não muda (sem auto-submit no mobile). ✓
   - Clicar botão lupa → URL ganha `?title=spi`. ✓
   - Apagar, digitar "x", apertar Enter no teclado → URL ganha `?title=x`. ✓

### Frontend — coleção

1. Login no browser com `vai_q_eh@yahoo.com.br`.
2. Abrir `http://localhost:3000/pt-BR/collection`.
3. Verificar: search bar **na toolbar/topo da página**, NÃO dentro do painel de filtros lateral.
4. Abrir o Sheet/sidebar de filtros — confirmar que NÃO existe mais campo de busca lá.
5. Repetir os mesmos 9 cenários do catálogo (desktop + mobile).
6. **Caso crítico do bug original:** com a coleção contendo um item "Dragon Ball Vol. 1" (Conrad ou Panini), buscar `dragon ball` na coleção. **Antes:** retornava nada se o título exato não tivesse essa string. **Agora:** deve retornar.
7. Confirmar que combinar `query` + filtros (ex: `condition=NEW`) continua funcionando (sidebar + search bar coexistem).

### Sanidade do build

- `corepack pnpm type-check` — sem novos erros.
- `corepack pnpm lint` — sem novos warnings.
- `corepack pnpm --filter contracts build && corepack pnpm --filter api build` — limpo.
- `corepack pnpm --filter web build` — "Compiled successfully", sem `Type error`.

### Acessibilidade rápida

- Tab até o input, Tab até o botão lupa (mobile), Enter no botão dispara. ✓
- `aria-label="Buscar"` lido pelo screen reader (via DevTools accessibility tree).

## Riscos

- **SSR/hydration mismatch do `useIsMobile`**: mitigado renderizando o botão sempre no DOM e controlando visibilidade via `md:hidden`.
- **Auto-submit em loop**: mitigado pelo `lastSubmittedRef`. Caso o pai mude `value` via URL externamente (ex: clicar tag de filtro), o `useEffect` de sync atualiza `value` mas o `lastSubmittedRef` evita re-submit redundante.
- **Quebra do filtro `seriesId` na coleção**: o código atual misturava `query` e `seriesId` via spread. A reescrita unifica num único objeto `catalogEntryFilter` — reduz risco, mas o teste 8 do backend valida explicitamente.
- **Performance**: o multi-token cria N condições `OR` para cada palavra. Para queries de 5+ palavras pode ficar lento sem índice. Aceitável: catálogo já roda esse padrão em produção sem queixa, e a coleção do usuário é ordens de magnitude menor que o catálogo global.
- **Duplicação de placeholder**: catálogo e coleção mantêm chaves separadas (`catalog.searchPlaceholder`, `collection.searchPlaceholder`) com textos potencialmente diferentes. Não unifico — cada contexto pode ter copy distinto.
