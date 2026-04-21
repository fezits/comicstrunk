---
phase: 04-marketplace-and-orders
verified: 2026-02-27
status: pending_human_verification
score: 7/7 plans executed
re_verification: false
gaps: []
human_verification:
  - test: "Abrir /pt-BR/marketplace e verificar que a pagina de listagem carrega com filtros de condicao, preco, e busca"
    expected: "Pagina mostra cards de itens a venda (se houver dados), filtros funcionais, toggle grid/lista"
    why_human: "Requer dados reais no marketplace e verificacao visual do layout"
  - test: "Abrir /pt-BR/marketplace/[id] de um item a venda e verificar detalhes + transparencia de comissao"
    expected: "Mostra titulo, capa, preco, condicao, vendedor, comissao da plataforma e valor que o vendedor recebe"
    why_human: "Transparencia de comissao requer calculo real via API"
  - test: "Logado como comprador, adicionar item ao carrinho e verificar sidebar com countdown"
    expected: "Icone do carrinho no header mostra badge com contagem, sidebar abre com item e timer de 24h"
    why_human: "Countdown em tempo real e integracao CartProvider requerem verificacao visual"
  - test: "Completar fluxo de checkout: selecionar/criar endereco, revisar pedido, finalizar"
    expected: "Endereco com mascara de CEP funcional, itens agrupados por vendedor, pedido criado com sucesso"
    why_human: "Fluxo completo end-to-end com criacao de pedido no banco"
  - test: "Abrir /pt-BR/orders e verificar historico de pedidos com filtro de status"
    expected: "Lista de pedidos com paginacao, dropdown de filtro por status funcionando"
    why_human: "Requer pedido real no banco para verificar listagem"
  - test: "Abrir /pt-BR/orders/[id] e verificar timeline de status + rastreio por item"
    expected: "Timeline vertical mostra progresso do pedido, itens agrupados por vendedor com status individual"
    why_human: "Timeline visual e agrupamento multi-vendedor requerem inspecao"
  - test: "Logado como vendedor, abrir /pt-BR/seller/orders e verificar dashboard"
    expected: "Lista de pedidos contendo itens do vendedor, badge 'Aguardando envio' em itens PROCESSING"
    why_human: "Filtragem por vendedor e badges requerem dados reais"
  - test: "No detalhe do pedido do vendedor, preencher formulario de rastreio e submeter"
    expected: "Formulario aceita codigo + transportadora, submissao atualiza status para SHIPPED"
    why_human: "Integracao com API de tracking requer teste end-to-end"
---

# Phase 04: Marketplace and Orders — O que foi entregue e como testar

**Fase:** Marketplace e Pedidos (Phase 04)
**Data:** 2026-02-27
**Status:** Todos os 7 planos executados, aguardando verificacao humana
**PR:** #87

---

## O que foi entregue

### Backend (4 planos)

#### 04-01: Fundacao do Marketplace
- **Schemas Zod** em `packages/contracts/` para cart, orders, shipping, commission, marketplace
- **API de Comissao** (`/api/v1/commission`): CRUD de configuracao de taxas, preview de comissao por preco, auto-seed de configuracao padrao
- **API do Marketplace** (`/api/v1/marketplace`): busca publica de itens a venda com filtros (condicao, preco, vendedor, publisher, personagem), detalhe de listagem
- **Cron Jobs**: expiracao de carrinho (24h), auto-completar pedidos entregues, cancelar pedidos pendentes (72h)
- **Gerador de numero de pedido**: formato `ORD-YYYYMMDD-XXXXXX`

#### 04-02: API do Carrinho
- **5 endpoints** em `/api/v1/cart`: adicionar, listar, resumo, remover, limpar
- **Reserva atomica** via Prisma `$transaction` — previne double-sell de itens fisicos unicos
- **Regras**: expiracao em 24h, limite de 50 itens, bloqueio de auto-compra
- **remainingMs** no response para countdown no frontend

#### 04-03: Shipping e Enderecos
- **12 endpoints** em `/api/v1/shipping`: CRUD de enderecos, CRUD de metodos de envio, atualizacao de tracking
- **Endereco padrao**: auto-promocao quando o padrao e deletado
- **Tracking**: so permite atualizar quando item esta em PROCESSING

#### 04-04: API de Pedidos
- **7 endpoints** em `/api/v1/orders`: criar pedido, listar comprador/vendedor, detalhe, cancelar, atualizar status de item
- **State machine**: `PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED` com branches `CANCELLED`/`DISPUTED`
- **Fluxo atomico** cart→order: valida carrinho, cria pedido com snapshot de precos/comissao/endereco, limpa carrinho
- **syncOrderStatus**: auto-promove pedido para COMPLETED quando todos os itens chegam ao estado terminal

### Frontend (3 planos)

#### 04-05: UI do Marketplace
- **Pagina de browse** (`/marketplace`): grid/lista, filtros (condicao, preco, publisher, personagem), busca com debounce, paginacao
- **Detalhe da listagem** (`/marketplace/[id]`): capa, preco, condicao, transparencia de comissao, botao "Adicionar ao Carrinho"
- **Perfil do vendedor** (`/seller/[id]`): listagens ativas, membro desde, placeholder de avaliacoes
- **5 modulos API client**: marketplace.ts, cart.ts, shipping.ts, orders.ts, commission.ts

#### 04-06: Cart e Checkout
- **CartProvider** context: estado compartilhado `cartCount` com atualizacoes otimistas (increment/decrement)
- **Cart sidebar** (Sheet do shadcn): abre pelo icone no header, mostra itens com countdown de 24h (amarelo < 1h, vermelho expirado)
- **Checkout** (`/checkout`): 3 secoes — revisao do carrinho, selecao de endereco, resumo do pedido
- **Formulario de endereco**: mascara de CEP (XXXXX-XXX), dropdown de estados brasileiros, validacao Zod
- **Order review**: itens agrupados por vendedor, subtotais por grupo, aviso "Cada vendedor envia separadamente"

#### 04-07: UI de Pedidos (Comprador e Vendedor)
- **Historico do comprador** (`/orders`): lista com paginacao, filtro por status (dropdown)
- **Detalhe do pedido** (`/orders/[id]`): timeline vertical de status, itens agrupados por vendedor com status individual, link de rastreio Correios, botao cancelar com dialogo de confirmacao
- **Dashboard do vendedor** (`/seller/orders`): pedidos contendo itens do vendedor, badge "Aguardando envio"
- **Detalhe do vendedor** (`/seller/orders/[id]`): so mostra itens do vendedor, resumo financeiro (preco, comissao, valor liquido)
- **Formulario de rastreio**: codigo + select de transportadora (Correios PAC/SEDEX, Jadlog, Total Express, Loggi, Outro)
- **Todas as traducoes PT-BR** via next-intl

---

## Como testar

### Pre-requisitos

1. **Banco de dados**: MySQL rodando com dados seed
   ```bash
   pnpm --filter api db:seed
   ```

2. **Servidor API**:
   ```bash
   pnpm --filter api dev
   ```

3. **Frontend**:
   ```bash
   pnpm --filter web dev
   ```

4. **Build completo** (verificar compilacao):
   ```bash
   pnpm build
   ```

### Fluxos de teste

#### 1. Marketplace (publico, sem login)
1. Acesse `http://localhost:3000/pt-BR/marketplace`
2. Verifique que a pagina carrega com filtros laterais
3. Teste filtros: condicao, faixa de preco, busca por texto
4. Alterne entre grid e lista
5. Clique em um item → deve abrir detalhe com preco, condicao, vendedor

#### 2. Carrinho (logado como comprador)
1. Faca login como `user@test.com` / `Test1234`
2. No detalhe de um item do marketplace, clique "Adicionar ao Carrinho"
3. Verifique que o badge no header atualiza instantaneamente
4. Clique no icone do carrinho → sidebar abre mostrando o item com countdown
5. Remova o item → badge decrementa
6. Adicione novamente e clique "Finalizar Compra"

#### 3. Checkout
1. Na pagina de checkout, verifique as 3 secoes: revisao, endereco, resumo
2. Clique "Adicionar novo endereco" → preencha com CEP valido (ex: 01001-000)
3. Selecione o endereco criado
4. Verifique agrupamento por vendedor no resumo
5. Clique "Finalizar Pedido" → deve criar pedido e redirecionar para detalhe

#### 4. Pedidos do comprador
1. Acesse `http://localhost:3000/pt-BR/orders`
2. Verifique lista de pedidos com status badge
3. Use o dropdown para filtrar por status
4. Clique em um pedido → pagina de detalhe com timeline vertical
5. Verifique itens agrupados por vendedor com status individual
6. Se o pedido estiver PENDING/PAID, o botao "Cancelar Pedido" deve aparecer

#### 5. Pedidos do vendedor
1. Faca login como o vendedor que listou itens
2. Acesse `http://localhost:3000/pt-BR/seller/orders`
3. Verifique lista de pedidos com seus itens
4. Clique em um pedido → mostra apenas seus itens + resumo financeiro
5. Para itens em PROCESSING: preencha o formulario de rastreio (codigo + transportadora)
6. Submeta → item deve mudar para SHIPPED

#### 6. Rastreio
1. No detalhe do pedido do comprador, itens SHIPPED devem mostrar codigo de rastreio
2. Se a transportadora for Correios, deve ter link "Rastrear Pacote" apontando para rastreamento.correios.com.br

### API endpoints para teste direto (curl/Postman)

```bash
# Marketplace (publico)
GET http://localhost:3001/api/v1/marketplace
GET http://localhost:3001/api/v1/marketplace?condition=NEW&minPrice=10&maxPrice=100
GET http://localhost:3001/api/v1/marketplace/:id

# Cart (autenticado)
POST http://localhost:3001/api/v1/cart          # { collectionItemId }
GET  http://localhost:3001/api/v1/cart
GET  http://localhost:3001/api/v1/cart/summary
DELETE http://localhost:3001/api/v1/cart/:id
DELETE http://localhost:3001/api/v1/cart

# Shipping (autenticado)
POST http://localhost:3001/api/v1/shipping/addresses
GET  http://localhost:3001/api/v1/shipping/addresses
PATCH http://localhost:3001/api/v1/shipping/tracking/:orderItemId

# Orders (autenticado)
POST http://localhost:3001/api/v1/orders          # { shippingAddressId }
GET  http://localhost:3001/api/v1/orders/buyer
GET  http://localhost:3001/api/v1/orders/seller
GET  http://localhost:3001/api/v1/orders/:id
PATCH http://localhost:3001/api/v1/orders/:id/cancel

# Commission (publico/admin)
GET  http://localhost:3001/api/v1/commission/preview?price=50
```

---

## Arquivos criados/modificados

### Backend (apps/api)
| Arquivo | Descricao |
|---------|-----------|
| `src/modules/commission/commission.service.ts` | CRUD de configuracao de taxas, preview de comissao |
| `src/modules/commission/commission.routes.ts` | Rotas da API de comissao |
| `src/modules/marketplace/marketplace.service.ts` | Busca publica de itens, detalhe de listagem |
| `src/modules/marketplace/marketplace.routes.ts` | Rotas publicas do marketplace |
| `src/modules/cart/cart.service.ts` | CRUD do carrinho com reserva atomica |
| `src/modules/cart/cart.routes.ts` | 5 endpoints do carrinho |
| `src/modules/shipping/shipping.service.ts` | Enderecos, metodos de envio, tracking |
| `src/modules/shipping/shipping.routes.ts` | 12 endpoints de shipping |
| `src/modules/orders/orders.service.ts` | Criacao de pedidos, listagem, status, cancelamento |
| `src/modules/orders/orders.routes.ts` | 7 endpoints de pedidos |
| `src/shared/cron/index.ts` | 3 cron jobs (cart expiry, auto-complete, cancel pending) |
| `src/shared/lib/order-number.ts` | Gerador ORD-YYYYMMDD-XXXXXX |
| `src/shared/lib/order-state-machine.ts` | Transicoes validas de status |
| `src/shared/lib/currency.ts` | Utilitario roundCurrency |

### Contratos (packages/contracts)
| Arquivo | Descricao |
|---------|-----------|
| `src/cart.ts` | Schemas Zod + tipos do carrinho |
| `src/orders.ts` | Schemas Zod + tipos de pedidos |
| `src/shipping.ts` | Schemas Zod + tipos de shipping |
| `src/commission.ts` | Schemas Zod + tipos de comissao |
| `src/marketplace.ts` | Schemas Zod + tipos do marketplace |

### Frontend (apps/web)
| Arquivo | Descricao |
|---------|-----------|
| `src/lib/api/marketplace.ts` | Client API do marketplace |
| `src/lib/api/cart.ts` | Client API do carrinho |
| `src/lib/api/shipping.ts` | Client API de shipping |
| `src/lib/api/orders.ts` | Client API de pedidos |
| `src/lib/api/commission.ts` | Client API de comissao |
| `src/components/features/marketplace/marketplace-listing-page.tsx` | Pagina de browse |
| `src/components/features/marketplace/marketplace-card.tsx` | Card grid/lista |
| `src/components/features/marketplace/marketplace-filters.tsx` | Painel de filtros |
| `src/components/features/marketplace/listing-detail.tsx` | Detalhe do item |
| `src/contexts/cart-context.tsx` | CartProvider com estado compartilhado |
| `src/components/features/cart/cart-sidebar.tsx` | Sidebar do carrinho |
| `src/components/features/cart/cart-countdown.tsx` | Countdown de 24h |
| `src/components/features/cart/cart-item-card.tsx` | Card de item do carrinho |
| `src/components/features/cart/cart-summary.tsx` | Resumo + total |
| `src/components/features/checkout/checkout-page.tsx` | Pagina de checkout |
| `src/components/features/checkout/address-selector.tsx` | Selecao de endereco |
| `src/components/features/checkout/address-form.tsx` | Formulario de endereco |
| `src/components/features/checkout/order-review.tsx` | Revisao multi-vendedor |
| `src/components/features/orders/order-status-badge.tsx` | Badge de status |
| `src/components/features/orders/order-status-timeline.tsx` | Timeline vertical |
| `src/components/features/orders/buyer-orders-page.tsx` | Historico do comprador |
| `src/components/features/orders/order-detail-page.tsx` | Detalhe do pedido |
| `src/components/features/orders/seller-orders-page.tsx` | Dashboard do vendedor |
| `src/components/features/orders/seller-order-detail.tsx` | Detalhe vendedor |
| `src/components/features/orders/tracking-form.tsx` | Formulario de rastreio |

### Rotas de pagina
| Rota | Pagina |
|------|--------|
| `/marketplace` | Browse de itens a venda |
| `/marketplace/[id]` | Detalhe da listagem |
| `/seller/[id]` | Perfil publico do vendedor |
| `/checkout` | Fluxo de checkout |
| `/addresses` | Gerenciamento de enderecos |
| `/orders` | Historico de pedidos (comprador) |
| `/orders/[id]` | Detalhe do pedido (comprador) |
| `/seller/orders` | Dashboard de pedidos (vendedor) |
| `/seller/orders/[id]` | Detalhe do pedido (vendedor) |
