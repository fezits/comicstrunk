# Phase 10 — Admin, Legal, LGPD e Produção: Guia de Verificação

## Pré-requisitos
1. API rodando: `pnpm --filter api dev` (porta 3001)
2. Web rodando: `pnpm --filter web dev` (porta 3000)
3. Seed data: `pnpm --filter api db:seed` (cria documentos legais e dados base)

## 1. Documentos Legais

### 1.1 Páginas públicas
- Acesse `/terms` → **Esperado**: Termos de Uso exibidos com versão e data
- Acesse `/privacy` → **Esperado**: Política de Privacidade
- Acesse `/seller-terms` → **Esperado**: Termos do Vendedor
- Acesse `/policies` → **Esperado**: Hub com links para todas as políticas
- Acesse `/policies/payment`, `/policies/returns`, `/policies/shipping`, `/policies/cancellation`, `/policies/cookies`
- **Esperado**: Cada página mostra o conteúdo do documento correspondente

### 1.2 Aceitação obrigatória
- Faça login como usuário que NÃO aceitou os termos
- **Esperado**: Modal de aceitação aparece (Termos de Uso)
- Marque "Li e aceito" + clique "Confirmar"
- **Esperado**: Próximo documento obrigatório aparece (Privacidade)
- Aceite todos → **Esperado**: Navegação normal liberada

### 1.3 Re-aceitação
- Como admin, crie nova versão de um documento obrigatório
- Login como usuário que já aceitou a versão anterior
- **Esperado**: Modal aparece novamente para a nova versão

### 1.4 Cookie consent
- Acesse o site pela primeira vez (ou limpe localStorage)
- **Esperado**: Banner de cookies no rodapé
- Clique "Aceitar" → **Esperado**: Banner desaparece, não reaparece ao navegar

### 1.5 Admin - Gerenciar documentos
- Acesse `/admin/legal`
- **Esperado**: Tabela agrupada por tipo com versão atual
- Clique "Novo Documento" → crie documento com tipo, conteúdo, data de vigência
- **Esperado**: Documento criado com versão incrementada
- Clique em um tipo → **Esperado**: Histórico de versões

## 2. LGPD

### 2.1 Página de direitos
- Login como usuário, acesse `/lgpd`
- **Esperado**: 4 cards (Acessar Dados, Corrigir Dados, Portabilidade, Excluir Conta)
- **Esperado**: Tabela de histórico de solicitações abaixo

### 2.2 Exportar dados
- Clique "Exportar Dados" ou "Exportar JSON"
- **Esperado**: Download de arquivo JSON com todos os dados pessoais
- Verifique o JSON: profile, collection, orders, reviews, etc.
- **Esperado**: NÃO contém passwordHash ou tokens

### 2.3 Solicitar correção
- Clique "Solicitar Correção"
- Preencha detalhes no textarea
- **Esperado**: Solicitação criada, aparece na tabela com status "Pendente"

### 2.4 Excluir conta
- Clique "Excluir Conta"
- **Esperado**: Dialog com 5 consequências listadas
- Digite seu email para confirmar
- **Esperado**: Se email correto, botão "Excluir" fica habilitado
- Clique "Excluir Minha Conta Permanentemente"
- **Esperado**: Solicitação criada, logout, redirecionado à homepage
- (A exclusão real acontece após 30 dias via cron às 4:30 AM)

### 2.5 Admin - Gerenciar solicitações
- Acesse `/admin/lgpd`
- **Esperado**: Tabela com solicitações, filtro por status
- Solicitações de exclusão destacadas em vermelho
- Ações: Processar, Concluir, Rejeitar (com motivo)

## 3. Formulário de Contato

### 3.1 Enviar mensagem
- Acesse `/contact` (sem login necessário)
- Preencha: Nome, Email, Categoria (Sugestão), Assunto, Mensagem (min 10 chars)
- Clique "Enviar Mensagem"
- **Esperado**: Tela de sucesso com "Mensagem enviada com sucesso!" e "48 horas úteis"

### 3.2 Rate limiting
- Envie 5 mensagens rapidamente
- Na 6ª tentativa: **Esperado**: Toast "Muitas mensagens enviadas. Tente novamente mais tarde."

### 3.3 Validação
- Tente enviar sem preencher campos obrigatórios
- **Esperado**: Mensagens de erro nos campos

### 3.4 Admin - Gerenciar mensagens
- Acesse `/admin/contact`
- **Esperado**: Tabela com mensagens, filtros por categoria/lida/resolvida
- Clique para expandir e ver mensagem completa
- Marque como lida, resolvida
- Delete com confirmação

## 4. Dashboard Admin

### 4.1 Página principal
- Acesse `/admin`
- **Esperado**: 8 cards KPI:
  - Usuários totais, Novos este mês
  - Pedidos hoje, Receita do mês
  - Catálogo aprovado, Aprovações pendentes
  - Disputas ativas, Mensagens não lidas
- Links rápidos para todas as seções admin

### 4.2 Gerenciamento de usuários
- Acesse `/admin/users`
- **Esperado**: Tabela com busca por nome/email, filtro por plano
- Busque por nome → **Esperado**: Lista filtrada
- Clique em um usuário → **Esperado**: Página de detalhes com stats
- Altere o plano de um usuário → **Esperado**: Plano atualizado
- Suspenda um usuário → **Esperado**: Dialog com textarea para motivo, confirmação
- **Esperado**: Admin não pode alterar próprio plano nem se suspender

## 5. Navegação e Links

### 5.1 Footer/Sidebar
- **Esperado**: Links para Termos, Privacidade, Políticas no rodapé do sidebar
- **Esperado**: Links também no mobile nav

### 5.2 Admin nav
- **Esperado**: Novos itens no menu admin: Documentos Legais, LGPD, Contato

### 5.3 Account nav
- **Esperado**: Link "Privacidade (LGPD)" no menu do colecionador

### 5.4 Contato
- **Esperado**: Link "Contato" na navegação pública

## 6. API Endpoints (para testes via curl)

```bash
# === DOCUMENTOS LEGAIS ===

# Último documento por tipo
curl http://localhost:3001/api/v1/legal/latest/TERMS_OF_USE

# Aceitar documento
curl -X POST http://localhost:3001/api/v1/legal/accept \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<DOC_ID>"}'

# Documentos pendentes
curl http://localhost:3001/api/v1/legal/pending \
  -H "Authorization: Bearer <TOKEN>"

# Admin: criar documento
curl -X POST http://localhost:3001/api/v1/legal/admin \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"TERMS_OF_USE","content":"Novos termos...","dateOfEffect":"2026-04-01","isMandatory":true}'

# === LGPD ===

# Exportar dados
curl http://localhost:3001/api/v1/lgpd/export \
  -H "Authorization: Bearer <TOKEN>" -o meus-dados.json

# Solicitar exclusão
curl -X POST http://localhost:3001/api/v1/lgpd/delete-account \
  -H "Authorization: Bearer <TOKEN>"

# Solicitar correção
curl -X POST http://localhost:3001/api/v1/lgpd/requests \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"CORRECTION","details":"Meu nome está incorreto, deveria ser João Silva"}'

# Admin: listar solicitações
curl http://localhost:3001/api/v1/lgpd/admin/requests \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# === CONTATO ===

# Enviar mensagem
curl -X POST http://localhost:3001/api/v1/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"João","email":"joao@email.com","category":"SUGGESTION","subject":"Sugestão de melhoria","message":"Gostaria de sugerir uma funcionalidade de wishlists para facilitar o acompanhamento de lançamentos."}'

# Admin: listar mensagens
curl http://localhost:3001/api/v1/contact/admin/list \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Admin: marcar como lida
curl -X PUT http://localhost:3001/api/v1/contact/admin/<ID>/read \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# === ADMIN DASHBOARD ===

# Métricas
curl http://localhost:3001/api/v1/admin/dashboard \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Listar usuários
curl "http://localhost:3001/api/v1/admin/users?search=joao&page=1&limit=20" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Alterar plano
curl -X PUT http://localhost:3001/api/v1/admin/users/<ID>/role \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"SUBSCRIBER"}'

# Suspender usuário
curl -X POST http://localhost:3001/api/v1/admin/users/<ID>/suspend \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Comportamento inadequado no marketplace conforme denúncias recebidas"}'
```

## Resumo dos Arquivos

### Contracts
- `packages/contracts/src/legal.ts` — Schemas documentos legais
- `packages/contracts/src/lgpd.ts` — Schemas solicitações LGPD
- `packages/contracts/src/contact.ts` — Schemas formulário de contato
- `packages/contracts/src/admin.ts` — Schemas gestão de usuários

### API (Backend)
- `apps/api/src/modules/legal/` — Legal service + routes (9 endpoints)
- `apps/api/src/modules/lgpd/` — LGPD service + routes (8 endpoints)
- `apps/api/src/modules/contact/` — Contact service + routes (6 endpoints)
- `apps/api/src/modules/admin/` — Admin service + routes (6 endpoints)

### Web (Frontend)
- `apps/web/src/lib/api/` — 6 API clients (legal, lgpd, contact, admin, admin-contact, admin-legal, admin-lgpd)
- `apps/web/src/components/features/legal/` — 5 componentes (document page, acceptance modal/gate, cookie consent)
- `apps/web/src/components/features/lgpd/` — 4 componentes (rights page, export, deletion, correction)
- `apps/web/src/components/features/contact/` — 2 componentes (form, success)
- `apps/web/src/components/features/admin/` — 6 componentes (dashboard, users, legal, lgpd, contact)
- 9 rotas de política pública + 6 rotas admin + 1 contato + 1 LGPD

### Modificados
- `packages/contracts/src/index.ts` — Exports legal, lgpd, contact, admin
- `apps/api/src/create-app.ts` — Registro de 4 módulos de rotas
- `apps/api/prisma/seed.ts` — Seed documentos legais (8 tipos)
- `apps/api/src/shared/cron/index.ts` — Cron exclusão de conta (4:30 AM)
- Layouts: root (cookie consent), collector/seller/orders (acceptance gate)
- Nav config + traduções
- Sidebar + mobile nav (footer links)
