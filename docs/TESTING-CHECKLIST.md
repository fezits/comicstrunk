# Comics Trunk - Checklist de Testes

## Testes automatizados (Playwright/Vitest)

Rodar localmente:
```bash
pnpm --filter api test          # Vitest - testes de API
pnpm --filter e2e test          # Playwright - testes E2E (precisa de dev server rodando)
```

## Testes manuais em producao

### Publico (sem login)
| Pagina | URL | O que testar |
|--------|-----|-------------|
| Homepage | https://comicstrunk.com/pt-BR | Carrega, imagens das secoes, links funcionam |
| Catalogo | https://comicstrunk.com/pt-BR/catalog | Lista gibis com capas, busca por titulo, filtros de publisher/categoria/ano |
| Detalhe do gibi | https://comicstrunk.com/pt-BR/catalog/{id} | Capa aparece, informacoes corretas, avaliacoes sem NaN, acentos corretos |
| Series | https://comicstrunk.com/pt-BR/series | Lista series, clique abre detalhe |
| Detalhe da serie | https://comicstrunk.com/pt-BR/series/{id} | Edicoes da serie listadas com capas |
| Marketplace | https://comicstrunk.com/pt-BR/marketplace | Lista anuncios |
| Ofertas | https://comicstrunk.com/pt-BR/deals | Lista ofertas/promocoes |
| Contato | https://comicstrunk.com/pt-BR/contact | Formulario envia mensagem |
| Termos | https://comicstrunk.com/pt-BR/terms | Texto carrega |
| Privacidade | https://comicstrunk.com/pt-BR/privacy | Texto carrega |
| Politicas | https://comicstrunk.com/pt-BR/policies | Links para sub-politicas |

### Auth
| Pagina | URL | O que testar |
|--------|-----|-------------|
| Login | https://comicstrunk.com/pt-BR/login | Login com email/senha, erro em credenciais invalidas |
| Cadastro | https://comicstrunk.com/pt-BR/signup | Cria conta, validacao de campos |
| Esqueci senha | https://comicstrunk.com/pt-BR/forgot-password | Envia email de reset |

### Colecionador (logado)
| Pagina | URL | O que testar |
|--------|-----|-------------|
| Minha colecao | /pt-BR/collection | Lista items, filtros, contagem |
| Adicionar item | /pt-BR/collection/add | Busca gibi e adiciona a colecao |
| Detalhe item | /pt-BR/collection/{id} | Editar, marcar como lido, preco pago |
| Progresso series | /pt-BR/collection/series-progress | Barra de progresso, edicoes faltantes |
| Favoritos | /pt-BR/favorites | Lista favoritos, toggle funciona |
| Checkout | /pt-BR/checkout | Fluxo de compra |
| Enderecos | /pt-BR/addresses | CRUD de enderecos |
| Notificacoes | /pt-BR/notifications | Lista, marca como lida |
| Preferencias notif | /pt-BR/notifications/preferences | Toggle canais |
| Historico pagamentos | /pt-BR/payments/history | Lista pagamentos |
| Assinatura | /pt-BR/subscription | Plano atual, upgrade/cancel |
| LGPD | /pt-BR/lgpd | Solicitar exportacao/exclusao de dados |
| Pedidos | /pt-BR/orders | Lista pedidos como comprador |
| Detalhe pedido | /pt-BR/orders/{id} | Status, items, tracking |
| Disputas | /pt-BR/disputes | Lista disputas |
| Nova disputa | /pt-BR/disputes/new | Formulario de abertura |

### Vendedor (logado como vendedor)
| Pagina | URL | O que testar |
|--------|-----|-------------|
| Pedidos vendedor | /pt-BR/seller/orders | Lista pedidos recebidos |
| Detalhe pedido | /pt-BR/seller/orders/{id} | Atualizar status do item |
| Disputas vendedor | /pt-BR/seller/disputes | Responder disputas |
| Contas bancarias | /pt-BR/seller/banking | CRUD contas para recebimento |

### Admin (logado como admin)
| Pagina | URL | O que testar |
|--------|-----|-------------|
| Dashboard | /pt-BR/admin | Metricas, graficos |
| Catalogo admin | /pt-BR/admin/catalog | Lista todas entries, aprovar/rejeitar |
| Novo gibi | /pt-BR/admin/catalog/new | Formulario de criacao |
| Editar gibi | /pt-BR/admin/catalog/{id}/edit | Editar campos, upload de capa |
| Importar CSV | /pt-BR/admin/catalog/import | Upload CSV, progresso |
| Usuarios | /pt-BR/admin/users | Lista, alterar roles, suspender |
| Detalhe usuario | /pt-BR/admin/users/{id} | Perfil completo |
| Categorias | /pt-BR/admin/content/categories | CRUD categorias |
| Series | /pt-BR/admin/content/series | CRUD series |
| Personagens | /pt-BR/admin/content/characters | CRUD personagens |
| Tags | /pt-BR/admin/content/tags | CRUD tags |
| Ofertas | /pt-BR/admin/deals | CRUD ofertas com affiliate links |
| Homepage | /pt-BR/admin/homepage | Configurar secoes da home |
| Pagamentos | /pt-BR/admin/payments | Aprovar/rejeitar pagamentos |
| Comissoes | /pt-BR/admin/commission | Configurar taxas |
| Assinaturas | /pt-BR/admin/subscriptions | Gerenciar planos |
| Disputas | /pt-BR/admin/disputes | Mediar disputas |
| Contato | /pt-BR/admin/contact | Responder mensagens |
| Legal | /pt-BR/admin/legal | Gerenciar documentos legais |
| LGPD | /pt-BR/admin/lgpd | Aprovar/negar solicitacoes |

### API (testar via curl)
```bash
# Catalogo
curl -s https://api.comicstrunk.com/api/v1/catalog?limit=5
curl -s https://api.comicstrunk.com/api/v1/catalog?title=batman&limit=3

# Categorias
curl -s https://api.comicstrunk.com/api/v1/categories

# Series
curl -s https://api.comicstrunk.com/api/v1/series?limit=5

# Imagem
curl -sI https://api.comicstrunk.com/uploads/covers/panini-ACBKA008.jpg

# Health check basico
curl -s -o /dev/null -w "%{http_code}" https://comicstrunk.com/pt-BR
curl -s -o /dev/null -w "%{http_code}" https://api.comicstrunk.com/api/v1/catalog
```

### Verificacoes visuais
- [ ] Capas de gibis aparecem (nao quebradas)
- [ ] Avaliacoes mostram estrelas (sem NaN)
- [ ] Acentos corretos nos labels (Catalogo, Colecao, Avaliacao, etc)
- [ ] Acentos corretos nos titulos dos gibis
- [ ] Tema escuro/claro funciona
- [ ] Responsivo no celular
- [ ] Menu lateral abre/fecha no mobile
