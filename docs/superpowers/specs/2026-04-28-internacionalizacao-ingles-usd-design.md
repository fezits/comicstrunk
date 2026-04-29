# Internacionalização: inglês + USD + afiliados US — Design

**Status:** Draft (criado 2026-04-28)
**Owner:** Fernando
**Tracking:** primeiro passo concreto rumo a tornar o Comics Trunk acessível ao mercado anglófono.

---

## TL;DR

Abrir o Comics Trunk para o mercado anglófono (en-US como primeira variação) **sem** mexer no marketplace P2P, que continua exclusivamente brasileiro. A monetização internacional vem de **afiliados (Amazon.com Associates + eBay Partner Network)** e, num segundo momento, **assinaturas em USD** (preço fixo, não conversão dinâmica). Arquitetura é construída para suportar N idiomas no futuro (es, fr, de) sem refactor.

A entrega real é um **roadmap em fases** — algumas tarefas dependem de aprovações externas (Amazon Associates só libera APIs após 3 vendas em 180 dias; eBay Partner Network exige aplicação manual; Stripe Atlas/LLC US fica para quando Fernando se mudar). O plano não trava nesses bloqueios: implementação técnica avança com placeholders, go-live destrava quando aprovações chegam.

---

## Contexto e motivação

**Hoje (2026-04-28):**
- Site 100% em pt-BR (`next-intl` configurado, mas com `locales: ['pt-BR']`).
- Catálogo: ~9k entradas BR (Panini, Rika) + ~6k entradas US (Marvel/DC/Image via GCD). Sobreposição real entre as duas é pequena.
- Receita: marketplace P2P (PIX, comissões) + assinatura BRL (Stripe BR + PIX) + afiliação Amazon BR.
- Infra: Next.js 15 + Express + Prisma/MySQL + Cloudflare R2 + PM2 em cPanel.

**Por que internacionalizar agora:**
- Mercado de quadrinhos americano é ordens de magnitude maior. Mesmo um nicho pequeno gera receita relevante via afiliação.
- Fernando vai morar nos EUA no futuro — preparar o terreno tecnicamente reduz dor depois.
- O catálogo US (6k issues) já existe — está subutilizado servindo só a brasileiro que importa.
- Assinatura em USD com precificação local (`$4.99`, `$9.99`) é receita recorrente que escala melhor que BRL.

**Cenário escolhido (decisão #1, ver tabela abaixo):** **Cenário A** — site disponível em inglês + USD, com afiliados US monetizando. Marketplace P2P continua só BR.

---

## Não-objetivos (fora de escopo desta fase)

Cada item abaixo foi considerado e **deliberadamente excluído** para manter foco. Cada um vira spec separado se/quando relevante.

1. **Marketplace P2P internacional.** Shipping cross-border, customs, KYC, 1099, Stripe Connect US, métodos de pagamento locais. Bloqueia em Fernando se mudar pros EUA.
2. **GDPR e mercado UK/Europa.** Cookie banner opt-in agressivo, DPA, registro ICO. Adiar até validar tração.
3. **Espanhol e demais idiomas.** Arquitetura preparada (decisão #2: opção C), mas só `en-US` neste ciclo.
4. **Refactor work/edition do catálogo.** Modelo "obra com edições por região" (Goodreads-style). v1 usa flag de origem + nome em inglês; v2 fica documentada como evolução.
5. **Tradução automática do catálogo (sinopses, descrições).** A2: títulos originais respeitados; sinopses ficam em pt-BR para edição BR e em inglês para edição US (origem do GCD).
6. **Stripe Atlas / LLC US neste momento.** Fernando recebe USD via Stripe Brasil (com spread); migração para LLC fica documentada como evolução natural.
7. **Geo-bloqueio fino (CCPA opt-out por estado).** CCPA simples no rodapé é suficiente.
8. **App mobile internacionalizado.** Fora do escopo (não há app hoje).

---

## Decisões consolidadas (referência rápida)

| # | Tema | Decisão | Detalhe |
|---|---|---|---|
| 1 | Cenário macro | **A** | Site EN + USD + afiliados US. Marketplace = só BR. |
| 2 | Idiomas | **C** | `en-US` no MVP; arquitetura para N idiomas no futuro. |
| 3 | Catálogo | **D** (B agora, C depois) | Flag de origem + título EN quando existir. Refactor work/edition adiado. |
| 4 | URL strategy | **A** | Subpath `/en/...`. pt-BR mantido sem prefix (URLs antigas preservadas). Modo `as-needed` do `next-intl`. |
| 5 | Detecção de locale | **D** | Híbrido `cf-ipcountry` + `Accept-Language` + cookie `ct_locale`. Cookie tem precedência absoluta. |
| 6 | Moeda | **B** | Preços fixos por moeda. Stripe Products dual (BRL e USD). Sem conversão dinâmica. |
| 7 | Afiliados (modelo) | **A** | Uma `PartnerStore` por país (Amazon BR, Amazon US, eBay US separados). |
| 8 | Tradução UI + catálogo | **A1 + A2** | UI traduzida iterativamente via IA-no-loop (Fernando revisa cada chave). Catálogo não traduzido — títulos originais. |
| 9 | Compliance | **B + D** | CCPA básico no rodapé; geo-bloqueio EU/UK temporário até validar tração. |
| 10 | Pagamentos | **D** | Stripe BR cobrando USD agora; LLC US + Stripe Atlas documentado como migração futura. |
| 11 | Deals/cupons US | **D** (em fases) | Manual no MVP → PA-API/EPN API quando aprovado → scraping educado se justificar. |
| 12 | Homepage + emails | **C1 + A2** | `HomepageSection` ganha campo `locales`; marketplace section escondido para US. Emails: templates duplicados por locale. |

---

## Arquitetura

### 1. Routing e detecção de locale

**`next-intl` em modo `as-needed`:**
- `comicstrunk.com/...` → pt-BR (default, sem prefixo). URLs antigas preservadas.
- `comicstrunk.com/en/...` → en-US.
- Futuro: `comicstrunk.com/es/...`, `/fr/...`, etc. (zero refactor — só adicionar locale ao array `routing.locales`).

**`apps/web/src/i18n/routing.ts`** evolui de:
```ts
locales: ['pt-BR'],
defaultLocale: 'pt-BR',
```
para:
```ts
locales: ['pt-BR', 'en-US'],
defaultLocale: 'pt-BR',
localePrefix: 'as-needed', // mantém pt-BR sem prefixo
```

**Detecção no middleware (Next.js middleware + Cloudflare):**
1. Cookie `ct_locale` existe? → respeita (precedência absoluta).
2. Cabeçalho `cf-ipcountry` indica país anglófono (US, CA, GB, AU, NZ, IE)? **E** `Accept-Language` prefere `en`? → redirect 302 para `/en/...` + grava cookie.
3. Apenas um dos dois sugere `en`? → renderiza locale default + banner sugerindo trocar (não redireciona).
4. Nenhum sugere → pt-BR sem prefixo.

**Cookie `ct_locale`:**
- `Path=/`, `SameSite=Lax`, `Max-Age=31536000` (1 ano), sem `HttpOnly` (frontend pode escrever via switcher).
- Valores: `pt-BR` ou `en-US`.

**Fallback de mensagens:** se `en-US` não tiver uma chave traduzida ainda, cai pra pt-BR (e logamos para `MissingTranslation` warning em dev).

### 2. UI traduzida

**Estrutura de arquivos:**
```
apps/web/src/messages/
├── pt-BR.json   # existente
└── en-US.json   # novo, mirror de pt-BR
```

**Regra existente preservada:** chaves em ASCII, valores podem ter acentos no pt-BR.

**Fluxo de tradução iterativa (decisão A1):**
- Quando uma feature precisa de uma chave nova (ou alteração), o desenvolvedor adiciona a chave em pt-BR.json E em en-US.json.
- Tradução EN é proposta pelo IA no momento (Claude Code), Fernando revisa antes de commit.
- **Não há big-bang de tradução.** O en-US.json começa praticamente vazio e cresce em ordem de prioridade (Fase 2 traduz UI essencial; resto incrementalmente).

**Tooling para detectar chaves faltando:**
- Script `apps/web/scripts/check-i18n-coverage.ts` (novo): compara as duas árvores e lista chaves missing/orphan.
- Pré-commit hook opcional: warn (não block) quando uma chave existe em pt-BR mas não em en-US.

**Componente `LanguageSwitcher`:**
- Em `components/layout/header.tsx` ao lado do `ThemeToggle`.
- Bandeirinha BR / US (ou texto "PT" / "EN").
- Dispara: troca rota + atualiza cookie `ct_locale`.
- Usa `useRouter` do `next-intl`.

### 3. Modelo de moeda + assinatura

**Schema:**
- `User.preferredCurrency` opcional (`BRL` | `USD`). Default derivado de `user.locale`.
- Modelo atual: `Subscription` tem `planType: PlanType` (enum) — preços ficam fora do banco, configurados via Stripe Price IDs. Adicionar mapeamento em config: `apps/api/src/modules/subscriptions/plans.ts` exporta `STRIPE_PRICE_IDS = { BASIC: { BRL: 'price_xxx_brl', USD: 'price_xxx_usd' }, PREMIUM: { ... } }`. Stripe Product é único por plano; cada Product tem múltiplos Prices (um por moeda).

**Stripe:**
- **Conta Stripe BR existente** continua. Cria-se `Price` em USD para cada plano.
- Webhook (`stripe-webhook.routes.ts`) já trata `currency` no payload — verificar e ajustar.
- Conversão de USD para BRL acontece automaticamente no recebimento (Stripe BR aplica spread). Documentar isso no admin.

**Frontend:**
- `formatCurrency(amount, locale)` utility centralizado em `apps/web/src/lib/utils/currency.ts` (criar se não existir). Usa `Intl.NumberFormat` com locale + currency.
- Componentes que hoje hardcodam `R$` (15 arquivos identificados) trocam para `formatCurrency(value, locale, currency)`.
- Marketplace P2P: força `BRL` independente do locale (continua BR-only).

**Migração futura para Stripe US (LLC + Atlas):**
- Fora do escopo desta fase.
- Schema-friendly: campos `userExternalAccountId` e similares já permitem Stripe ID por região.
- Documentado em "Phase 7 — futura" abaixo.

### 4. Afiliados US (Amazon Associates + eBay Partner Network)

**Modelo (decisão #7 — opção A):** uma `PartnerStore` por país. Sem mudança de schema.

**Cadastros novos no admin (Fase 3, depois das aprovações chegarem):**
- `PartnerStore { name: 'Amazon US', slug: 'amazon-us', affiliateTag: '<placeholder>', baseUrl: 'https://www.amazon.com', logoUrl: '...', country: 'US' }` — campo `country` adicionado ao schema (migration).
- `PartnerStore { name: 'eBay US', slug: 'ebay-us', affiliateTag: '<placeholder>', baseUrl: 'https://www.ebay.com', country: 'US' }`.
- Amazon BR e (futuramente) eBay BR já existirão como `country: 'BR'`.

**Migration:**
```sql
ALTER TABLE partner_stores ADD COLUMN country VARCHAR(2) NOT NULL DEFAULT 'BR';
CREATE INDEX idx_partner_stores_country ON partner_stores(country);
```

**`composeDealUrl` evolução:**
- Hoje injeta `?tag=...` genérico. Para eBay precisa de outro formato (campanha + customid).
- Refator: a função consulta `store.country` ou `store.brand` e aplica o template correto.
- eBay: URL canônica é `https://www.ebay.com/itm/<id>?mkcid=1&mkrid=...&campid=<campid>&customid=...`.
- Documentar em `apps/api/src/modules/deals/composers/{amazon,ebay}.ts` (separados por brand).

**Listagem de deals por locale:**
- `listActiveDeals` aceita filtro `country`. Frontend en-US lista apenas `country: 'US'`; frontend pt-BR apenas `country: 'BR'`.
- Algumas ofertas globais (improvável, mas possível) podem usar `country: 'GLOBAL'` ou múltiplas — para v1 mantém simples (1 país por deal).

**Pré-requisitos externos (não-codificáveis):**
- Abrir conta **Amazon Associates US** em `affiliate-program.amazon.com`. Aplicação automática, mas precisa ter URL apontando para conteúdo relevante. Tag fica disponível imediatamente; PA-API só após 3 vendas em 180 dias.
- Aplicar para **eBay Partner Network (EPN)** em `partnernetwork.ebay.com`. Aprovação manual, geralmente leva alguns dias. Exige site com conteúdo decente.

### 5. Catálogo bilíngue (flag de origem + título EN)

**Schema (migration):**
```prisma
model CatalogEntry {
  // ...campos existentes
  origin    Origin?   @default(BR)  // BR | US
  titleEn   String?   @map("title_en")  // título original em inglês quando aplicável

  @@index([origin])
}

enum Origin {
  BR
  US
  // futuro: MX, JP, FR...
}
```

- `origin` derivado do `sourceKey`: `metron:*` e `gcd:*` → US; `rika:*`, `panini:*`, `amazon-br:*` → BR.
- `titleEn`: para entradas vindas do GCD/Metron, usar o título inglês original como `titleEn` E como `title` (já é como está hoje). Para entradas BR (Panini), `titleEn` fica nulo a menos que admin preencha.
- **Backfill script** (one-shot) preenche `origin` em todas as entradas existentes com base em `sourceKey`.

**Apresentação por locale:**
- Frontend en-US: lista entradas filtradas (`origin = 'US'` por padrão; toggle "Show BR editions too" para colecionadores que importam).
- Frontend pt-BR: lista todas (`origin IN ('BR', 'US')`) como hoje, com badge "US edition" nas entradas US.
- Cards com badge de origem (bandeirinha BR/US) — componente `OriginFlag` em `components/ui/origin-flag.tsx`.

**Title display:**
- Locale en-US: prefere `titleEn ?? title`.
- Locale pt-BR: usa `title` direto (mantém comportamento atual).

**Fora de escopo (v2 documentada):** modelo work/edition. Quando o catálogo cruzar 2k+ títulos com sobreposição BR/US relevante, vale o refactor.

### 6. Compliance / legal

**CCPA básico (decisão #9 — opção B):**
- Privacy Policy traduzida para inglês com seção "Your California Privacy Rights" + link "Do Not Sell My Personal Information" no rodapé en-US.
- Endpoint `/api/v1/lgpd/data-deletion` (existente) serve também como CCPA "Right to Delete" — reuso direto.
- Cookie banner: já existe (`apps/web/src/components/features/legal/cookie-consent-banner.tsx`). Traduzir strings para EN — comportamento opt-out continua válido para CCPA (não requer mudança lógica).

**Geo-bloqueio EU/UK (decisão #9 — opção D, temporário):**
- Cloudflare Worker (ou middleware Next.js usando `cf-ipcountry`) bloqueia países EEA + UK.
- Lista: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IS, IE, IT, LV, LI, LT, LU, MT, NL, NO, PL, PT, RO, SK, SI, ES, SE, GB.
- Resposta: HTTP 451 + página estática "Comics Trunk is not available in your region yet."
- Decisão revisada quando GDPR for endereçado.

**Páginas legais:**
- `apps/web/src/app/[locale]/(public)/privacy/page.tsx` existe — adicionar versão EN com seção CCPA. Por usar `[locale]`, basta as strings da página estarem em `en-US.json`.
- Auditar (Fase 2) páginas adjacentes: `/terms`, `/cookies`, `/lgpd`. Criar `/legal/data-rights` como apelido EN para `/lgpd` (rota separada apontando para o mesmo conteúdo, traduzido).

### 7. Homepage por locale

**Schema (migration):**
```prisma
model HomepageSection {
  // campos existentes
  locales Json @default("[\"pt-BR\"]")  // array JSON: ["pt-BR"], ["en-US"], ou ambos

  // sem índice direto sobre Json no MySQL — filtro acontece em memória após query
  // (volume de seções é pequeno, ordem de dezenas, então custo é desprezível)
}
```

MySQL/Prisma não suportam `String[]` nativamente. JSON é o caminho mais simples sem tabela de junção. Para volumes pequenos (HomepageSection ~10-50 rows), filtrar em memória após `findMany` é aceitável.

**Curadoria:**
- Admin cria seções rotuladas por locale.
- Listagem na home filtra por `locale IN locales`.
- `MARKETPLACE_*` sections nunca recebem `en-US` (decisão #12).

**Conteúdo inicial en-US (Fase 3):**
- BANNER_CAROUSEL: 2-3 banners curados (lançamentos Marvel/DC, Black Friday).
- CATALOG_HIGHLIGHTS: top 12 issues GCD com capa boa.
- DEALS_OF_DAY: deals US iniciais cadastrados manualmente.
- FEATURED_COUPONS: cupons Amazon US e eBay quando existirem.

### 8. Emails transacionais bilíngues

**Decisão A2 — templates duplicados.** `apps/api/src/shared/lib/email/templates/`:
```
templates/
├── welcome/
│   ├── pt-BR.html
│   └── en-US.html
├── subscription-confirmed/
│   ├── pt-BR.html
│   └── en-US.html
├── reset-password/
│   ├── pt-BR.html
│   └── en-US.html
└── ...
```

- `sendEmail(to, template, data)` recebe `user.locale` e escolhe a versão correta.
- Subject lines também duplicadas.
- Strings de mídia (botões, links) hardcoded no template — não há `next-intl` no servidor.
- Tradução iterativa: cada email novo nasce com pt-BR; en-US é criado quando Fernando autoriza.

### 9. SEO multi-idioma

**`hreflang` tags em todas as páginas com tradução:**
```html
<link rel="alternate" hreflang="pt-BR" href="https://comicstrunk.com/{path}" />
<link rel="alternate" hreflang="en-US" href="https://comicstrunk.com/en/{path}" />
<link rel="alternate" hreflang="x-default" href="https://comicstrunk.com/{path}" />
```

Componente `HreflangTags` em `apps/web/src/components/seo/hreflang.tsx` (criar). Usa o pathname atual.

**Sitemaps separados:**
- `apps/web/src/app/sitemap.ts` evolui para gerar URLs dos dois locales.
- Ou sitemaps separados: `/sitemap-pt-BR.xml` e `/sitemap-en.xml`, com `sitemap-index.xml` apontando pra ambos.

**`robots.txt`:**
- Liberar `/en/`. Bloquear paths internos (admin, api, etc.) já existentes.

**Metadata por página:**
- `generateMetadata` em cada page lê `locale` do params e retorna title/description traduzidos.

**Google Search Console:**
- Adicionar domínio se ainda não existe.
- Verificar que `comicstrunk.com/en/` é indexável.
- Não criar property separada (mesmo domínio).

---

## Plano de implementação em fases

> Cada fase vira um spec/plan próprio via `writing-plans` skill quando chegar a vez. Aqui é só o roadmap macro.

### Fase 0 — Pré-requisitos externos (Fernando, em paralelo)

**Bloqueia go-live, não bloqueia código.**

- [ ] Abrir conta **Amazon Associates US** (`affiliate-program.amazon.com`). Tag fica disponível na hora; PA-API após 3 vendas em 180 dias.
- [ ] Aplicar para **eBay Partner Network** (`partnernetwork.ebay.com`). Aprovação manual; pode levar 1-2 semanas.
- [ ] (Opcional, futuro) Iniciar pesquisa Stripe Atlas / abrir LLC US.

### Fase 1 — Foundation técnica (1-2 semanas dev)

- Habilitar locale `en-US` no `next-intl` (modo `as-needed`).
- Middleware de detecção (Cloudflare `cf-ipcountry` + `Accept-Language` + cookie `ct_locale`).
- `messages/en-US.json` mirror inicial (vazio, preenchido sob demanda).
- Migrations: `partner_stores.country`, `catalog_entries.origin`, `catalog_entries.title_en`, `homepage_sections.locales`.
- Backfill script: preenche `origin` em entradas existentes via `sourceKey`.
- Componente `LanguageSwitcher` no header.
- `formatCurrency(amount, locale, currency)` utility.
- Script `check-i18n-coverage.ts` (warn keys faltando).

### Fase 2 — Conteúdo crítico (2-3 semanas dev + iteração)

- Traduzir UI essencial para en-US (iterativo, IA-no-loop):
  - Header, footer, navigation
  - Homepage (sem marketplace section)
  - Catalog list + detail
  - Search
  - Scan-capa
  - Auth (login, signup, forgot)
  - Settings, profile básicos
- Traduzir páginas legais (Privacy, Terms, Cookie Policy) com seção CCPA.
- Geo-bloqueio EU/UK via Cloudflare Worker.
- Email templates en-US para: welcome, reset-password, email-verification.

### Fase 3 — Afiliados US (depende de Fase 0 chegar + Fase 2 estar pronto)

- Cadastrar `PartnerStore` Amazon US e eBay US no admin (com tags reais).
- Refator `composeDealUrl` para suportar template por brand (`amazon` vs `ebay`).
- Composers separados: `amazon.ts` (`?tag=`), `ebay.ts` (`?campid=&customid=`).
- Cadastrar 20-30 deals iniciais manualmente.
- HomepageSection en-US curada (sem marketplace, com FEATURED_COUPONS US e CATALOG_HIGHLIGHTS US).
- Email templates en-US para subscription / orders.

### Fase 4 — Assinatura USD

- Criar Stripe Products + Prices em USD (Basic e Premium ou similar).
- Subscription page mostra preço em USD para locale en-US.
- Webhook handle `currency` corretamente (verificar e ajustar).
- Stripe BR cobra USD com spread (UX limitada, mas funcional).

### Fase 5 — SEO + lançamento

- `hreflang` tags em todas as páginas relevantes.
- Sitemap multi-locale.
- `robots.txt` liberando `/en/`.
- Metadata (title, description, OG) por locale.
- Lançamento soft em comunidades anglófonas (subreddits, Discord servers de colecionadores).
- Monitorar via GA4 + Search Console: tráfego US, cliques em deals US, sign-ups en-US.

### Fase 6 — Vitrines automatizadas (futura, dependente de aprovações)

- Integrar Amazon PA-API (após 3 vendas em 180 dias).
- Integrar eBay Finding API (após aprovação EPN).
- Seções "Top Marvel comics on Amazon US" alimentadas automaticamente.
- Scraping educado de SlickDeals/r/comicbookdeals (opcional).

### Fase 7 — Marketplace P2P internacional (bloqueada por mudança pros EUA)

- LLC US + Stripe Atlas + conta bancária americana.
- Stripe Connect com Express accounts.
- Shipping internacional (USPS, integração com EasyPost ou Shippo).
- KYC / 1099 para sellers US.
- Refactor work/edition do catálogo (necessário para listagens cross-region).

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Amazon Associates US recusa aplicação por falta de tráfego | Média | Médio | Lançar com placeholder; apply de novo após Fase 5 com tráfego real. Documentar URL pública e conteúdo no formulário de aplicação. |
| eBay Partner Network demora ou recusa | Média | Médio | Idem. Manter Amazon como receita principal de afiliação até EPN aprovar. |
| UX ruim de Stripe BR cobrando USD (cliente vê "international transaction") | Alta | Baixo-médio | Avisar no checkout que é cobrança internacional. Monitorar churn. Migrar para LLC quando justificar. |
| Tráfego SEO en-US sumido por conteúdo escasso | Alta | Médio | Não competir com Marvel.com/ComicBookHerald. Foco em long-tail (cupons específicos, deals nichados). |
| Usuário BR em viagem detectado como US | Baixa | Baixo | Cookie `ct_locale` + LanguageSwitcher visível resolvem. Banner de sugestão (não redirect forçado) quando heurística é fraca. |
| GDPR fica relevante antes do esperado (UK/EU clica via VPN ou geo-block falha) | Baixa | Alto | Geo-block como camada 1; Privacy Policy contemplando "if you are EU resident, contact us for deletion" como camada 2. |
| Manutenção bilíngue diverge (EN fica desatualizado) | Alta | Médio | Script `check-i18n-coverage.ts` no CI; warn quando chave nova em pt-BR não tem en-US. |
| Curadoria editorial US virar fardo (Fernando sozinho) | Alta | Médio | Fase 6 (vitrines automáticas) reduz dependência manual. Considerar contratar curador freelancer se receita justificar. |

---

## Métricas de sucesso

**3 meses pós-launch:**
- Tráfego en-US ≥ 5% do total.
- Cliques em deals US ≥ 100/mês.
- Pelo menos 1 venda confirmada Amazon Associates US (validação do programa).
- Bounce rate en-US < 70% (sinal de que tradução é compreensível).

**6 meses pós-launch:**
- Receita afiliados US ≥ R$ 200/mês (validação de modelo).
- Pelo menos 5 assinantes USD (validação de pricing).
- Zero incidente CCPA / queixa formal de privacidade.

**12 meses pós-launch:**
- Reavaliar GDPR / desbloqueio EU.
- Reavaliar Stripe Atlas se receita USD ≥ US$500/mês.
- Reavaliar work/edition refactor se sobreposição BR/US do catálogo > 2k títulos.

---

## Glossário e convenções adjacentes

- **locale:** BCP 47 string. Valores aceitos: `pt-BR`, `en-US`. Adicionar locale = adicionar string aqui + arquivo de mensagens.
- **region / origin:** `BR`, `US` (e futuro). País-de-origem de uma `PartnerStore`, `CatalogEntry`, `Deal`, `HomepageSection`.
- **ASCII keys preserved:** chaves em `messages/*.json` continuam ASCII (regra existente). Valores user-facing pt-BR mantêm acentos. Valores en-US naturalmente ASCII.
- **Default behavior:** quando algo não tiver locale específico, default = `pt-BR` (preserva comportamento atual).
- **Marketplace =** sempre BRL, sempre BR-only enquanto Phase 7 não acontecer.
- **Não traduzimos:** títulos de catálogo, nomes de personagens, nomes de séries, autores. Eles são identidade.

---

## Próximos passos imediatos (após aprovação deste spec)

1. **Fernando aprova ou ajusta este spec.**
2. **Gerar plano de implementação detalhado** da **Fase 1** via skill `writing-plans` (cada migration, cada arquivo, cada teste explicitamente listados).
3. **Em paralelo:** Fernando inicia Fase 0 (abrir contas Amazon Associates US e EPN) — essas aprovações tomam tempo de calendário, não bloqueiam código.
4. **Branch:** `feature/i18n-en-us-foundation` para Fase 1. Tag `pre-i18n-2026-04-XX` antes de mergear (para rollback).

---

## Anexos / referências

- next-intl docs: https://next-intl-docs.vercel.app/
- Cloudflare `cf-ipcountry`: https://developers.cloudflare.com/network/ip-geolocation/
- Amazon Associates US: https://affiliate-program.amazon.com/
- Amazon PA-API requirements: https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html
- eBay Partner Network: https://partnernetwork.ebay.com/
- Stripe Atlas: https://stripe.com/atlas
- CCPA overview: https://oag.ca.gov/privacy/ccpa
- BCP 47 language tags: https://www.rfc-editor.org/rfc/bcp/bcp47.txt
