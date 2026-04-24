# Linha do Tempo de Leitura — Design Spec

**Data:** 2026-04-23
**Status:** Aprovado

## Objetivo

Página dedicada que mostra os gibis lidos do usuário organizados cronologicamente numa timeline horizontal interativa, com zoom semântico e filtros.

## Acesso

- Item próprio no menu lateral: "Linha do Tempo" (ícone: `Clock` ou `CalendarDays`)
- Rota: `/collection/timeline`
- Requer autenticação

## Fonte de dados

- Campo `readAt` (DateTime) do `CollectionItem` — timestamp de quando o gibi foi marcado como lido
- Apenas itens com `isRead = true` e `readAt IS NOT NULL`

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Linha do Tempo                           [Zoom: - Ano Mês +]  │
│                                                                 │
│  Filtros: [Editora ▼]  [Personagem ▼]  [Série ▼]              │
│                                                                 │
│  Gibis lidos: 342    Período: Jan 2024 — Abr 2026              │
│                                                                 │
│         2024              2025              2026                 │
│  ────────┼─────────────────┼─────────────────┼────────          │
│          │                 │              ┌──┤                   │
│         [📖]             [📖][📖]       [📖][📖]               │
│         [📖]             [📖]           [📖][📖]               │
│                          [📖]           [📖]                    │
│                                                                 │
│  ◀ arrastar pra navegar ▶                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Níveis de zoom (semântico)

### Nível 1 — Visão por anos
- Eixo: `2024`, `2025`, `2026`
- Cada ano mostra as capas empilhadas verticalmente acima do ponto
- Clique no ano → zoom pro nível 2

### Nível 2 — Visão por meses (dentro de um ano)
- Eixo: `Jan`, `Fev`, `Mar`, ... `Dez` do ano selecionado
- Riscos mensais no eixo, capas de cada mês saem pra cima
- Clique no mês → zoom pro nível 3
- Botão voltar → volta pro nível 1

### Nível 3 — Visão por dias (dentro de um mês)
- Eixo: `1`, `2`, `3`, ... `30/31` do mês selecionado
- Cada dia com gibis lidos mostra as capas
- Clique na capa → vai pra página de detalhe do gibi
- Botão voltar → volta pro nível 2

## Interações

### Capas
- **Miniatura** — capa pequena (~40x60px) posicionada verticalmente acima do ponto no eixo
- **Mouse over** — tooltip com título do gibi
- **Clique** — navega pra `/catalog/{slug}` (detalhe do gibi)
- Quando há muitas capas num ponto, empilham verticalmente com scroll ou limita a N visíveis + badge "+12"

### Navegação
- Scroll horizontal ou drag pra mover no tempo
- Botões `+`/`-` ou botões `Ano`/`Mês` pra mudar nível de zoom
- Ao clicar num ponto do eixo (ano/mês), faz zoom in

### Filtros
- **Editora** — dropdown multi-select com editoras do usuário
- **Personagem** — dropdown multi-select (personagens dos gibis lidos)
- **Série** — dropdown multi-select
- Ao aplicar filtro, capas que não batem desaparecem
- Contadores e período atualizam
- Filtros vêm dos dados da coleção do usuário (não precisa buscar todo o catálogo)

## API

### Endpoint novo: `GET /collection/timeline`

**Query params:**
- `year` (opcional) — filtrar por ano específico
- `month` (opcional) — filtrar por mês (requer year)
- `publisher` (opcional) — filtrar por editora
- `seriesId` (opcional) — filtrar por série
- `characterId` (opcional) — filtrar por personagem

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totalRead": 342,
    "periodStart": "2024-01-15",
    "periodEnd": "2026-04-22",
    "groups": [
      {
        "key": "2024",
        "label": "2024",
        "count": 120,
        "items": [
          {
            "id": "cmo...",
            "title": "Batman Year One",
            "slug": "batman-year-one",
            "coverImageUrl": "https://covers.comicstrunk.com/covers/...",
            "publisher": "DC Comics",
            "readAt": "2024-03-15T10:30:00Z"
          }
        ]
      }
    ]
  }
}
```

**Agrupamento:**
- Sem `year`: agrupa por ano
- Com `year`: agrupa por mês (Jan-Dez daquele ano)
- Com `year` + `month`: agrupa por dia (1-31 daquele mês)

## Componentes frontend

### Página
- `apps/web/src/app/[locale]/(collector)/collection/timeline/page.tsx`

### Componentes
- `ReadingTimeline` — componente principal com filtros + timeline
- `TimelineAxis` — eixo horizontal com pontos e labels
- `TimelinePoint` — ponto no eixo com capas empilhadas acima
- `TimelineCover` — miniatura da capa com tooltip (hover) e link (click)
- `TimelineFilters` — barra de filtros (editora, personagem, série)
- `TimelineZoomControls` — botões de zoom (Ano/Mês/Dia, +/-)

Todos em `apps/web/src/components/features/collection/timeline/`

### Sem dependências externas
- Layout com CSS flexbox/grid
- Scroll horizontal com `overflow-x: auto`
- Zoom com re-render (muda o groupBy e refetch)
- Tooltips com CSS `:hover` + `position: absolute`
- Animações com CSS transitions

## Menu lateral

Adicionar em `nav-config.ts` no grupo "MINHA COLEÇÃO":
```
{ titleKey: 'nav.timeline', href: '/collection/timeline', icon: CalendarDays }
```

## Limitações

- Se o usuário nunca marcou gibis como lidos, mostra estado vazio com CTA "Marque gibis como lidos pra ver sua linha do tempo"
- `readAt` só existe pra gibis marcados via app (importações CSV/XLSX podem não ter data real)
- Máximo de capas visíveis por ponto: 20 (com badge "+N" pro restante)
