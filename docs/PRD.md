# Comics Trunk — Product Requirements Document

**Versão:** 3.0
**Data:** 2026-02-21
**Status:** Aprovado para desenvolvimento

---

## 1. Visão e Problema

### O problema

Colecionadores de quadrinhos no Brasil enfrentam um mercado fragmentado. Não existe uma plataforma dedicada onde possam, ao mesmo tempo, **catalogar** sua coleção pessoal, **comprar e vender** exemplares entre si com segurança e **acompanhar** séries, gastos e leituras. As alternativas atuais são grupos em redes sociais (sem garantia, sem organização), marketplaces genéricos (que não entendem o universo dos quadrinhos) ou planilhas pessoais (sem comunidade).

### A solução

**Comics Trunk** é uma plataforma especializada em quadrinhos (gibis, HQs, mangás) que unifica gestão de coleção, marketplace entre colecionadores e comunidade em um único lugar. A plataforma atua como intermediária nas transações, garantindo transparência com comissões claras e sistema de avaliações.

### Proposta de valor

- Um **catálogo curado** e centralizado de quadrinhos, mantido pela comunidade e aprovado pela equipe editorial
- **Marketplace seguro** entre colecionadores, com reserva de itens no carrinho (evita conflitos de estoque), rastreamento de envio e sistema de avaliações
- **Gestão completa de coleção** pessoal: o que tenho, o que li, quanto gastei, quais séries estou acompanhando
- **Comunidade**: avaliações, comentários, favoritos, metas de leitura, timelines
- **Ofertas e cupons com links de afiliado**: curadoria de promoções de lojas parceiras (Amazon, Mercado Livre, eBay, Panini, Shopee) com links de afiliado — principal fonte de receita da plataforma
- **Planos de assinatura**: benefícios progressivos (mais espaço, menos comissão) — receita complementar para cobrir custos operacionais
- **Informação**: miniblog com novidades, feed de notícias do universo de quadrinhos

### Modelo de receita

| Fonte | Prioridade | Descrição |
|-------|-----------|-----------|
| **Links de afiliado** | Principal | Comissão sobre vendas realizadas via links de afiliado (Amazon Associates, Mercado Livre, eBay Partner Network, etc.) |
| **Comissões sobre vendas** | Secundária | Percentual sobre vendas entre usuários no marketplace |
| **Assinaturas** | Complementar | Planos pagos para cobrir custos operacionais |

---

## 2. Usuários-Alvo

### Persona 1: O Colecionador (primário)

- **Quem:** Pessoa que coleciona quadrinhos e quer organizar sua coleção digitalmente
- **Motivação:** Saber exatamente o que tem, acompanhar séries, encontrar edições que faltam
- **Comportamento:** Adiciona exemplares à coleção, marca como lidos, acompanha progresso de séries, define metas de leitura e compras
- **Necessidades:** Catálogo completo, import/export de coleção, rastreamento de séries, relatórios de gastos, timelines

### Persona 2: O Comprador/Vendedor (primário)

- **Quem:** Colecionador que também quer comprar ou vender exemplares
- **Motivação:** Encontrar quadrinhos que procura a bom preço, vender duplicatas ou itens que não quer mais
- **Comportamento:** Navega catálogo, filtra por personagem/editora/série, adiciona ao carrinho, finaliza compra; lista exemplares à venda com preço
- **Necessidades:** Busca eficiente, carrinho com reserva, pagamento seguro (PIX e cartão), rastreamento de envio, avaliações de vendedores

### Persona 3: O Administrador

- **Quem:** Equipe que opera a plataforma
- **Motivação:** Manter catálogo curado, configurar regras de negócio, acompanhar métricas
- **Comportamento:** Aprova/rejeita catálogos, configura comissões e planos, publica conteúdo no blog, gerencia ofertas de terceiros, acompanha dashboard
- **Necessidades:** Dashboard com métricas, gestão de catálogo, configuração de comissões e planos, gestão de conteúdo, painel de pagamentos devidos

---

## 3. Métricas de Sucesso

| Métrica | Descrição | Meta inicial |
|---------|-----------|-------------|
| Usuários cadastrados | Total de contas criadas | 500 em 3 meses |
| Coleções ativas | Usuários com ≥ 10 itens na coleção | 30% dos cadastrados |
| Transações/mês | Vendas completadas no marketplace | 50/mês no 3º mês |
| Taxa de conversão | Visitantes → cadastro | ≥ 5% |
| Assinantes pagos | Usuários em plano BASIC+ | 10% dos ativos |
| NPS | Satisfação do usuário | ≥ 40 |
| Taxa de conclusão de pedido | Carrinho → pagamento confirmado | ≥ 60% |
| Cliques em afiliados/mês | Cliques em links de afiliado nas ofertas | 1000/mês no 3º mês |

---

## 4. Requisitos Funcionais

### 4.1 Autenticação e Perfil de Usuário

O usuário deve poder se cadastrar com email e senha, fazer login e gerenciar seu perfil. O sistema deve suportar recuperação de senha por email.

**Requisitos:**
- Cadastro com nome, email e senha (com requisitos mínimos de complexidade)
- Login seguro com proteção contra tentativas excessivas
- Recuperação de senha por email com link temporário
- Perfil com avatar, informações pessoais e links sociais
- Três níveis de acesso: Usuário comum, Assinante e Administrador

### 4.2 Catálogo de Quadrinhos

O catálogo é o coração da plataforma — um banco de dados curado de todos os quadrinhos disponíveis. Ele é mantido pela equipe admin e serve de base para coleções e vendas.

**Requisitos:**
- Cada quadrinho no catálogo tem: título, autor, editora, selo, código de barras, imagem de capa, descrição
- Quadrinhos podem pertencer a uma **série** (com volume e número de edição)
- Quadrinhos são classificados por **categorias** (ex: super-herói, mangá, terror) e **tags** livres
- Quadrinhos são associados a **personagens/heróis** (ex: Batman, Homem-Aranha)
- Novos itens passam por **aprovação editorial** antes de aparecer no catálogo público
- O administrador pode aprovar ou rejeitar com motivo
- **Busca** com filtros combinados: editora, personagem, série, categoria, faixa de preço, condição, ano de publicação
- Ordenação por preço, data, avaliação e título
- Todas as listagens paginadas
- **Avaliação média** exibida em cada catálogo (1 a 5 estrelas)
- **Import em lote** via CSV para o administrador cadastrar muitos itens de uma vez
- **Export** dos dados do catálogo em CSV

### 4.3 Coleção Pessoal

Cada usuário gerencia sua própria coleção de exemplares físicos. A coleção é vinculada ao catálogo: o usuário seleciona um quadrinho do catálogo e registra que possui aquele exemplar.

**Requisitos:**
- Adicionar exemplares à coleção, informando: quantidade, preço que pagou, condição (Novo, Muito Bom, Bom, Regular, Ruim), notas pessoais
- Marcar exemplar como **lido** (com data de leitura)
- Marcar exemplar como **à venda** (define preço de venda; comissão é calculada automaticamente)
- Upload de fotos do exemplar
- Acompanhar **progresso por série** (ex: "Tenho 15 de 42 edições da série X")
- **Import de coleção** via CSV: o usuário faz upload de um arquivo com seus quadrinhos, e o sistema associa ao catálogo
- **Export de coleção** em CSV
- **Template CSV** disponível para download, facilitando o preenchimento
- Relatório de importação: quantos foram importados, quantos falharam, motivo das falhas
- **Limites por plano de assinatura** (ver seção 4.8)

### 4.4 Carrinho de Compras

O carrinho tem uma mecânica especial: como cada exemplar é único (diferente de e-commerce tradicional), ao adicionar um item ao carrinho, ele fica **reservado** temporariamente para aquele comprador.

**Requisitos:**
- Ao adicionar ao carrinho, o exemplar fica reservado por **24 horas** (ninguém mais pode comprá-lo nesse período)
- Máximo de 50 itens por carrinho
- O carrinho persiste entre sessões (o usuário pode voltar depois)
- Reservas expiradas são automaticamente liberadas
- Carrinhos completamente abandonados são limpos após 7 dias
- O usuário **não pode** comprar seu próprio exemplar
- Cada exemplar só pode estar em um carrinho por vez

### 4.5 Pedidos

O sistema de pedidos suporta compras de quadrinhos físicos, assinaturas de plano, ou ambos em um único pedido.

**Tipos de pedido:**
- **Quadrinhos apenas** — exige endereço de entrega e método de frete
- **Assinatura apenas** — não exige endereço
- **Misto** — quadrinhos + assinatura no mesmo pedido

**Fluxo do pedido:**
1. Pendente → 2. Pago → 3. Em processamento → 4. Enviado → 5. Entregue → 6. Concluído

Também pode ser cancelado ou disputado em qualquer etapa.

**Requisitos:**
- Cada pedido recebe um número único identificável (ex: ORD-20260221-A1B2C3)
- Os preços são **fotografados** no momento da compra (não mudam depois)
- Um pedido pode conter itens de **múltiplos vendedores** (cada vendedor envia o seu separadamente)
- Cada item tem rastreamento individual de envio
- Pedidos sem envio após 7 dias são automaticamente cancelados
- Pagamentos expiram: PIX em 24h, cartão em 1h

### 4.6 Pagamentos

**Métodos aceitos:**
- **PIX** — pagamento instantâneo brasileiro, com QR Code e código copia-e-cola
- **Cartão de crédito** — via processador de pagamento externo (Stripe)

**Requisitos:**
- Pagamento PIX exibe QR Code real e verifica status automaticamente até confirmar
- Pagamento por cartão redireciona para checkout seguro externo
- Confirmação de pagamento é processada automaticamente via webhook
- Suporte a reembolsos (total ou parcial)
- Histórico completo de pagamentos acessível ao usuário

**Disputas e chargebacks:**

A plataforma atua como intermediária e precisa de um fluxo claro para resolver problemas entre comprador e vendedor.

- O comprador pode abrir uma **disputa** em até 7 dias após a entrega (ou 30 dias se o item não foi entregue), pelos seguintes motivos:
  - Item não recebido
  - Item diferente do anunciado (condição, edição, etc.)
  - Item danificado no transporte
  - Item não enviado dentro do prazo
- **Fluxo de resolução:**
  1. **Disputa aberta** — comprador descreve o problema com evidências (fotos)
  2. **Resposta do vendedor** — vendedor tem 48h para responder com sua versão
  3. **Mediação** — se não houver acordo, o admin avalia evidências e decide
  4. **Resolução** — reembolso total, reembolso parcial, ou disputa encerrada sem reembolso
- O reembolso, quando aprovado, é feito pelo **mesmo método de pagamento** original
- Para PIX: reembolso via transferência da plataforma para o comprador (requer dados bancários do comprador)
- Status da disputa: ABERTA → EM_MEDIACAO → RESOLVIDA_REEMBOLSO / RESOLVIDA_SEM_REEMBOLSO / CANCELADA
- Histórico de disputas acessível ao comprador, vendedor e admin
- Vendedores com alta taxa de disputas recebem alerta e podem ter a conta suspensa
- Todas as decisões de mediação são registradas com justificativa

### 4.7 Comissões

A plataforma cobra uma comissão sobre cada venda realizada entre usuários. Essa é uma fonte de receita secundária, complementar aos links de afiliado.

**Regras:**
- A comissão é um percentual sobre o preço de venda, pago pelo vendedor
- O percentual varia conforme o plano de assinatura do vendedor:
  - **FREE:** 10%
  - **BASIC:** 8%
  - **STANDARD:** 5%
  - **PREMIUM:** 2%
- Os percentuais são configuráveis pelo administrador
- Valores mínimos e máximos de comissão podem ser definidos
- A comissão é calculada e exibida ao vendedor **em tempo real** quando ele define o preço de venda (mostra: "Você receberá R$ X líquido")
- O valor da comissão é registrado no momento da compra (imutável para auditoria)
- O administrador tem um dashboard de comissões com totais, por período, por plano

### 4.8 Planos de Assinatura

A plataforma oferece planos com benefícios progressivos. O plano FREE é o padrão para todos os usuários.

**Planos:**

| Plano | Preço | Limite de coleção | Comissão sobre vendas | Benefícios |
|-------|-------|-------------------|-----------------------|-----------|
| **FREE** | Gratuito | 50 quadrinhos | 10% | Acesso básico |
| **BASIC** | Configurável | 200 quadrinhos | 8% | Comissão reduzida |
| **STANDARD** | Configurável | 500 quadrinhos | 5% | Mais espaço + extras |
| **PREMIUM** | Configurável | Ilimitado | 2% | Acesso completo |

**Requisitos:**
- Pagamento recorrente via Stripe (mensal, trimestral, semestral ou anual)
- Período de trial configurável
- Upgrade entre planos a qualquer momento
- Cancelamento marca para encerrar no fim do período pago (não imediato)
- Após cancelamento efetivo, o usuário volta para o plano FREE automaticamente
- Notificação em caso de falha de pagamento
- Enforcement automático: ao atingir o limite de coleção, o sistema bloqueia a adição de novos exemplares com mensagem clara (quantos tem, qual o limite, sugestão de upgrade)

### 4.9 Envio e Endereços

**Requisitos:**
- O usuário cadastra múltiplos endereços de entrega, com um marcado como padrão
- Campos: rua, número, complemento, bairro, cidade, estado, CEP
- Métodos de envio configuráveis pelo admin: PAC, SEDEX, Retirada local, etc.
- Cálculo de frete baseado no método + destino
- O vendedor atualiza o código de rastreamento e transportadora para cada item
- O comprador é notificado sobre atualizações de envio

### 4.10 Avaliações e Comunidade

**Requisitos:**
- **Avaliação de catálogo:** qualquer usuário pode dar nota de 1 a 5 estrelas e escrever uma review textual (uma avaliação por usuário por catálogo)
- **Avaliação de vendedor:** após uma compra concluída, o comprador pode avaliar o vendedor (1 a 5 estrelas + review). Só quem comprou pode avaliar.
- A média de avaliação é calculada e exibida no catálogo e no perfil do vendedor
- **Comentários:** qualquer catálogo pode receber comentários, com suporte a respostas (um nível de aninhamento)
- **Likes** em comentários
- **Favoritos:** o usuário pode favoritar catálogos e acessar sua lista de favoritos

### 4.11 Notificações

O sistema de notificações deve ser **amplo e altamente configurável**, entregando informações relevantes ao usuário no momento certo, sem ser intrusivo.

**Canais de entrega:**
- **In-app:** ícone de sino com badge de não-lidas, dropdown com preview, página completa de notificações
- **Email:** emails transacionais e resumos periódicos (digest)
- **Web Push:** notificações do navegador mesmo com a plataforma fechada

**Categorias de notificação:**
- **Compras:** venda realizada, pedido criado, status atualizado, pagamento confirmado/falhou/pendente, carrinho expirando
- **Envio:** item enviado, entregue, rastreamento atualizado
- **Catálogo:** aprovado, rejeitado, preço reduzido em favorito, nova edição em série acompanhada
- **Social:** novo comentário, resposta, like, avaliação recebida
- **Trocas:** proposta recebida/aceita/rejeitada, nova mensagem, troca concluída
- **Metas:** meta atingida, meta expirando
- **Assinatura:** renovada, expirando, cancelada, pagamento falhou
- **Ofertas:** nova oferta na categoria favorita
- **Sistema:** boas-vindas, reset de senha, conta cancelada
- **Admin:** novo usuário cadastrado, catálogo pendente, nova mensagem de contato, conta cancelada por usuário

**Entrega em tempo real:** as notificações in-app devem chegar instantaneamente (sem necessidade de recarregar a página)

**Preferências do usuário (granulares):**
- Toggle por canal (in-app / email / push) para cada **categoria**
- Frequência configurável por categoria: imediato, resumo diário ou resumo semanal
- Quiet hours: horário configurável em que push e email não são enviados (ex: 22h às 8h)
- Link de descadastro em todos os emails

**Admin:**
- Templates de email editáveis (assunto e corpo com variáveis dinâmicas)
- Toggle global on/off por tipo de notificação
- Envio de notificação em massa (broadcast) para todos, por plano ou por nível de acesso
- Analytics: notificações enviadas, abertas, clicadas, por tipo e período

### 4.12 Emails Transacionais

**Tipos de email:**
- Boas-vindas ao se cadastrar
- Confirmação de pagamento com detalhes do pedido
- Lembrete de pagamento pendente (PIX expirando)
- Pagamento falhou — com link para tentar novamente
- Notificação de envio com código de rastreamento
- Notificação de venda para o vendedor
- Link de reset de senha (expira em 1h)
- Assinatura renovada
- Assinatura expirando em 7 dias
- Assinatura cancelada (com lista do que perde)
- Novo usuário cadastrado (para admin)
- Confirmação de cancelamento de conta
- Resumo diário (notificações agrupadas por categoria)
- Resumo semanal

**Requisitos:**
- Todos os emails com layout visual responsivo e consistente
- Retry automático em caso de falha de envio
- Registro de cada envio com status e métricas (aberto, clicado)
- Respeitar preferências do usuário

### 4.13 Administração

O painel administrativo é a central de operações da plataforma.

**Requisitos:**
- **Dashboard** com métricas em tempo real: total de usuários, vendas, receita, itens pendentes de aprovação
- Gráficos de vendas e cadastros por período
- **Gestão de catálogo:** aprovar/rejeitar com motivo, listar pendentes/aprovados/rejeitados
- **Gestão de usuários:** lista paginada com busca e filtros
- **Gestão de conteúdo:** categorias, tags, personagens/heróis, séries — CRUD completo
- **Configuração de comissões:** editar percentuais por plano, definir mín/máx, preview de impacto
- **Gestão de planos:** criar/editar/desativar planos de assinatura
- **Configuração de emails:** toggle on/off por tipo, editar templates
- **Gestão de políticas:** termos de pagamento, privacidade, devolução, etc. (editor de texto)
- **Painel de contatos:** mensagens recebidas via formulário de contato, marcar como lido/resolvido
- **Pagamentos devidos:** vendedores com valores pendentes de repasse
- **Dashboard de comissões:** total arrecadado, por período, por plano, lista de transações
- **Import em lote:** upload de CSV para cadastrar quadrinhos no catálogo em massa
- Confirmação obrigatória para ações destrutivas

### 4.14 Internacionalização (i18n)

A plataforma deve ser **multilíngue desde a primeira versão**, com arquitetura preparada para adição fácil de novos idiomas.

**Requisitos:**
- Idioma na v1: **Português (pt-BR)**
- Arquitetura extensível: adicionar um novo idioma deve exigir apenas um novo arquivo de tradução, sem alteração de código
- Todas as mensagens da interface, mensagens de erro e emails em português
- Conteúdo gerado pelo admin (blog, políticas) não precisa ser traduzido automaticamente — é responsabilidade do admin publicar nas línguas desejadas

### 4.15 Séries e Acompanhamento

**Requisitos:**
- Cada série tem: título, descrição, total de edições
- Catálogos vinculados a séries com indicação de volume e número da edição
- Página de listagem de séries com busca
- Página de detalhes da série mostrando todas as edições
- Progresso do usuário na série (ex: "15 de 42 edições") — visível quando logado
- Página dedicada de progresso de séries: todas as séries que o usuário coleciona, com barras de progresso e indicação de edições faltantes
- Link para buscar edições faltantes no catálogo

### 4.16 Ofertas com Links de Afiliado (receita principal)

A plataforma gera receita através de **links de afiliado** de lojas parceiras. O admin faz curadoria de ofertas, cupons e promoções de quadrinhos disponíveis em lojas externas (Amazon, Mercado Livre, eBay, Panini, Shopee, etc.) e publica com links que contêm tags de afiliado. Quando um usuário clica e compra na loja parceira, a plataforma recebe comissão.

**Programas de afiliado suportados:**
- Amazon Associates (tag de afiliado na URL)
- Mercado Livre Programa de Afiliados
- eBay Partner Network
- Outros programas compatíveis (configurável pelo admin)

**Requisitos:**
- O admin cadastra ofertas com:
  - Cupom: código, loja, descrição, percentual/valor de desconto, validade, **link com tag de afiliado**
  - Promoção: título, descrição, loja, banner, **link com tag de afiliado**, data início/fim, categoria (HQ, Mangá, Colecionável)
- Cada loja tem sua **tag de afiliado** configurada no painel admin (ex: `?tag=comicstrunk-20` para Amazon)
- Links são gerados automaticamente com a tag correta ao cadastrar a oferta
- Página dedicada **/deals** com todas as ofertas ativas
- Filtro por loja, categoria, validade
- Ordenação: mais recentes, maior desconto, expirando em breve
- **Destaque na homepage** (seção "Ofertas do Dia") — visibilidade máxima para gerar cliques
- Expiração automática de ofertas vencidas
- Notificação opcional para usuários quando nova oferta é publicada em categoria de interesse

**Tracking e analytics (admin):**
- Contagem de cliques por oferta, por loja, por categoria, por período
- Dashboard de afiliados: cliques totais, estimativa de conversão, receita estimada por loja
- Relatório de ofertas mais clicadas
- Identificação de quais categorias/lojas geram mais engajamento
- Export de dados para cruzar com relatórios dos programas de afiliado

### 4.17 Relatórios e Timelines do Usuário

**Requisitos:**
- **Relatório de gastos:** total por período (mês, trimestre, ano), gráfico ao longo do tempo, breakdown por editora/categoria/série
- **Timeline de compras:** visualização cronológica de todas as compras, incluindo imagem, preço, data, vendedor
- **Timeline de leituras:** visualização cronológica de quadrinhos marcados como lidos, com data de leitura e capa
- **Registrar compras externas:** formulário para registrar compras feitas fora da plataforma (loja física, banca, etc.) — para ter um histórico completo de gastos
- Filtros por período, editora, série, categoria em todas as views
- Export em CSV/PDF

### 4.18 Metas de Compras e Leituras

**Requisitos:**
- Definir metas pessoais:
  - "Ler X quadrinhos até [data]"
  - "Gastar no máximo R$ X por mês"
  - "Completar a série [nome]"
- Tipos de meta: leitura (quantidade), gasto (valor máximo), coleção (completar série)
- Progresso visual (barra de progresso com percentual)
- Notificação quando meta é atingida ou está próxima de expirar
- Histórico de metas: atingidas, não atingidas, em andamento
- Widget de metas no dashboard do usuário

### 4.19 Homepage e Miniblog

**Requisitos:**
- **Homepage pública** com seções gerenciáveis pelo admin:
  - Banner principal (carousel de imagens com link)
  - Destaques (últimos quadrinhos aprovados no catálogo)
  - Promoções ativas (cards com link)
  - Cupons de desconto em destaque
  - Posts recentes do blog
- Ordem e visibilidade das seções configuráveis pelo admin
- **Miniblog do admin:**
  - Criar, editar e publicar posts (título, texto rico/markdown, imagem de capa, tags)
  - Posts podem ser rascunho ou publicados
  - Agendamento de publicação
  - Categorias de post: notícia, novidade, dica, promoção
  - Lista de posts paginada em /blog e na homepage
  - Cada post acessível por URL amigável (slug)
  - SEO: meta description, Open Graph tags

### 4.20 News Feed

**Requisitos:**
- Agregação de conteúdo de fontes externas: Twitter/X, YouTube, Instagram, feeds RSS
- Admin gerencia as fontes (adicionar, remover, ativar/desativar)
- Exibição com embeds nativos (vídeos do YouTube, tweets, posts do Instagram)
- Cache de conteúdo para evitar excesso de requisições externas

### 4.21 Sistema de Trocas

**Status:** Feature futura (fora do MVP)

- Propor troca de exemplares entre usuários
- Chat/mensagens por troca
- Aceitar, rejeitar, concluir ou cancelar
- Avaliação após troca concluída

### 4.22 Contato

**Requisitos:**
- Formulário público para envio de mensagens (sugestão, problema, parceria, outro)
- Proteção contra spam (limite de envios por hora)
- Painel admin para gerenciar mensagens recebidas (marcar como lido, resolvido)

### 4.23 Dados Bancários do Vendedor

**Requisitos:**
- O vendedor cadastra seus dados bancários para recebimento dos valores de vendas
- Campos: banco, agência, conta, CPF, titular, tipo (corrente/poupança)
- Múltiplas contas com uma marcada como principal
- Admin visualiza dados para processamento de pagamentos devidos

### 4.24 Termos Legais e Políticas

A plataforma exige termos legais bem estruturados, acessíveis e versionados. O usuário deve aceitar os termos para usar o serviço, e ser notificado quando houver atualizações relevantes.

**Documentos obrigatórios:**

| Documento | Conteúdo principal | Aceite obrigatório |
|-----------|-------------------|-------------------|
| **Termos de Uso** | Regras gerais de uso da plataforma, direitos e deveres do usuário, condições de suspensão/banimento | Sim, no cadastro |
| **Política de Privacidade** | Coleta, uso e proteção de dados pessoais. Conformidade LGPD: direito de acesso, correção, exclusão, portabilidade | Sim, no cadastro |
| **Termos do Vendedor** | Obrigações do vendedor, responsabilidade sobre estado do item, prazos de envio, acordo de comissão, consequências de descumprimento | Sim, ao listar primeiro item à venda |
| **Política de Pagamento** | Métodos aceitos, prazos de processamento, comissões cobradas, cronograma de repasse ao vendedor | Informativo |
| **Política de Devolução e Reembolso** | Condições para devolução, prazos, fluxo de disputa, responsabilidades de frete na devolução | Informativo |
| **Política de Envio** | Métodos disponíveis, prazos estimados, responsabilidade por extravio/dano no transporte | Informativo |
| **Política de Cancelamento de Conta** | Como cancelar, o que acontece com dados e coleção, prazos de exclusão, valores pendentes | Informativo |
| **Política de Cookies** | Tipos de cookies utilizados, finalidade, como desativar | Banner de consentimento |

**Requisitos:**
- Cada documento tem **versionamento** (v1.0, v1.1, etc.) com data de vigência
- Versões anteriores ficam acessíveis ao usuário (histórico)
- Ao atualizar termos que exigem aceite, o usuário é **notificado** e deve aceitar a nova versão no próximo login
- Termos de Uso e Política de Privacidade devem ser aceitos **antes** de concluir o cadastro (checkbox obrigatório)
- Termos do Vendedor devem ser aceitos **antes** de listar o primeiro exemplar à venda
- Todos os documentos acessíveis via footer e via página dedicada (/legal ou /policies)
- Admin pode editar os documentos via painel (editor de texto)
- Registro de aceite: data, versão aceita, IP do usuário (para auditoria)
- Link para política de privacidade e termos de uso no formulário de cadastro

**Conformidade LGPD:**
- O usuário pode solicitar: acesso a seus dados, correção, exclusão (direito ao esquecimento), portabilidade (export)
- Cancelamento de conta exclui dados pessoais em até 30 dias (exceto dados necessários para obrigações legais/fiscais)
- Dados de transações são mantidos por 5 anos (obrigação fiscal), mas anonimizados
- Consentimento explícito para comunicações de marketing (separado do aceite de termos)

---

## 5. Requisitos Não-Funcionais

### 5.1 Responsividade

**REQUISITO CRÍTICO.** Toda página e componente DEVE funcionar perfeitamente em mobile, tablet e desktop. Nenhuma feature pode ser entregue sem estar responsiva.

- **Mobile (< 768px):** layout de coluna única, menu oculto com hamburger, touch targets mínimos de 44x44px, tabelas viram cards empilhados, modais ocupam tela inteira
- **Tablet (768-1023px):** 2 colunas, menu toggle com overlay
- **Desktop (1024px+):** menu lateral fixo, 3-4 colunas em grids, hover states

### 5.2 Performance

- Páginas carregam em no máximo 3 segundos em conexão 3G
- Imagens otimizadas com lazy loading
- Listagens paginadas (nunca carregar tudo de uma vez)
- Componentes pesados (gráficos, admin) carregados sob demanda

### 5.3 Segurança

- Autenticação segura com tokens de curta duração e refresh tokens
- Proteção contra ataques comuns (injeção, XSS, CSRF, brute force)
- Senhas criptografadas com hash forte
- Validação de todos os inputs do usuário
- Dados sensíveis nunca expostos em logs ou respostas
- HTTPS obrigatório em produção
- Webhook de pagamento com verificação de assinatura
- Conformidade com LGPD (dados pessoais protegidos, possibilidade de cancelar conta)

### 5.7 Proteção contra Fraude (v2)

> **Nota:** Este módulo fica fora do MVP. No MVP, a proteção é manual (admin monitora transações). A implementação automatizada entra na v2, quando o volume de transações PIX justificar.

- **Limites para contas novas:** contas com menos de 7 dias têm limite de valor e quantidade de transações por dia
- **Verificação de conta:** vendedores precisam confirmar email e cadastrar dados bancários antes de receber repasses
- **Velocidade de transação:** alerta automático se um usuário fizer muitas compras/vendas em curto período
- **Detecção de padrões suspeitos:** compras repetidas entre mesmas contas, valores atípicos, uso de múltiplas contas pelo mesmo dispositivo
- **Score de confiança do vendedor:** baseado em tempo de conta, avaliações, disputas e volume de vendas
- **Bloqueio preventivo:** transações suspeitas ficam retidas para análise do admin antes de liberar o repasse ao vendedor
- **PIX específico:** verificação de titularidade (CPF do pagador vs CPF da conta), limite de valor por transação para contas não verificadas
- **Painel de fraude (admin):** lista de transações sinalizadas, motivo do alerta, ações (liberar, bloquear, suspender conta)
- **Log de auditoria:** todas as ações de bloqueio/liberação registradas com justificativa

### 5.4 Disponibilidade e Confiabilidade

- Monitoramento com health checks automáticos
- Backups diários do banco de dados
- Recuperação automatizada em caso de falha de processo
- Operações críticas (criação de pedido, pagamento) são atômicas — tudo ou nada

### 5.5 Internacionalização

- Interface em Português (pt-BR) na v1
- Arquitetura extensível para novos idiomas sem alteração de código
- Moeda: BRL

### 5.6 Acessibilidade

- Contraste adequado em ambos os temas (escuro e claro)
- Navegação por teclado nas principais funcionalidades
- Semântica HTML correta
- Labels em formulários

---

## 6. Regras de Negócio

### RN01 — Reserva de carrinho
Ao adicionar um exemplar ao carrinho, ele fica reservado por 24 horas. Ninguém mais pode comprá-lo nesse período. Após 24h sem checkout, a reserva é liberada automaticamente.

### RN02 — Exemplar único
Cada exemplar físico é único. Diferente de e-commerce tradicional, não existe "estoque" — cada Comic é um item individual de um vendedor específico.

### RN03 — Proibição de autocompra
O usuário não pode comprar seu próprio exemplar.

### RN04 — Snapshot de preços
No momento da criação do pedido, todos os preços (valor original, comissão, valor líquido do vendedor) são registrados de forma imutável. Mudanças posteriores nos preços ou comissões não afetam pedidos existentes.

### RN05 — Comissão por plano
A comissão sobre vendas varia conforme o plano do vendedor no momento da venda: FREE 10%, BASIC 8%, STANDARD 5%, PREMIUM 2%. Percentuais configuráveis pelo admin.

### RN06 — Downgrade automático
Quando uma assinatura é cancelada ou o pagamento falha definitivamente, o usuário volta para o plano FREE automaticamente ao fim do período pago.

### RN07 — Limites de coleção
Cada plano tem um limite de quadrinhos na coleção. Ao atingir o limite, o usuário é impedido de adicionar novos exemplares e recebe sugestão de upgrade. Os exemplares existentes não são removidos.

### RN08 — Aprovação editorial
Todo catálogo novo passa por aprovação antes de ficar visível publicamente. O admin pode aprovar ou rejeitar com motivo justificado.

### RN09 — Cancelamento de pedido por inatividade
Se o vendedor não enviar o item em até 7 dias após o pagamento, o item do pedido é automaticamente cancelado.

### RN10 — Avaliação de vendedor vinculada a transação
Só pode avaliar um vendedor quem completou uma compra com ele. Uma avaliação por transação.

### RN11 — Uma avaliação por catálogo por usuário
Cada usuário pode avaliar cada catálogo apenas uma vez (pode editar depois).

### RN12 — Expiração de ofertas de terceiros
Cupons e promoções com data de validade expirada são automaticamente ocultados.

### RN13 — Quiet hours de notificação
Durante o horário configurado de silêncio, notificações push e email são retidas e entregues ao sair do período. Notificações in-app continuam sendo entregues normalmente.

### RN14 — Idempotência em webhooks
Eventos de webhook recebidos com ID já processado são ignorados (previne processamento duplicado).

### RN15 — Prazo de disputa
O comprador pode abrir uma disputa em até 7 dias após a confirmação de entrega, ou 30 dias se o item não foi entregue. Fora desse prazo, a transação é considerada encerrada.

### RN16 — Retenção de repasse em disputa
Enquanto houver uma disputa aberta sobre um item, o valor correspondente fica retido e não é repassado ao vendedor até a resolução.

### RN17 — Aceite de termos obrigatório
O usuário deve aceitar os Termos de Uso e a Política de Privacidade para concluir o cadastro. O vendedor deve aceitar os Termos do Vendedor antes de listar seu primeiro item à venda. Ao atualizar termos que exigem aceite, o usuário deve aceitar a nova versão no próximo login.

### RN18 — Retenção de dados fiscais
Dados de transações financeiras são mantidos por 5 anos após a transação (obrigação fiscal), mesmo que o usuário cancele a conta. Os dados pessoais são anonimizados, mas os registros fiscais permanecem.

### RN19 — Transparência em links de afiliado
Toda página que exibe ofertas com links de afiliado deve conter aviso claro de que a plataforma pode receber comissão por compras realizadas através dos links (conformidade CONAR/FTC).

---

## 7. Design e Experiência

### 7.1 Tema Visual

Suporte a **tema escuro e claro**, com toggle acessível em todas as páginas. O tema escuro é o padrão. A escolha do usuário é persistida entre sessões.

- **Tema escuro (padrão):** paleta baseada em tons de cinza escuro com acentos em roxo e azul
- **Tema claro:** paleta baseada em tons claros com os mesmos acentos de cor
- Gradientes purple-to-blue nos elementos principais em ambos os temas

### 7.2 Estrutura de Layout

- **Páginas autenticadas:** Menu lateral fixo (desktop) ou oculto com hamburger (mobile), header com título da página e ações, área de conteúdo principal, footer com informações do sistema
- **Páginas públicas** (login, cadastro): card centralizado com fundo gradiente, sem menu lateral

### 7.3 Navegação

Menu lateral organizado em seções:
- **Principal:** Buscar, Séries, Notícias, Dashboard, Minha Coleção, Favoritos, Progresso de Séries, Adicionar Gibi, Contato
- **Comunidade/Vendas:** Minha Assinatura, Dados Bancários, Dashboard de Vendas, Histórico de Vendas, Meus Pedidos, Minhas Compras
- **Admin** (visível apenas para administradores): Gestão completa de catálogo, usuários, configurações, relatórios, conteúdo

### 7.4 Feedback Visual

- Toasts para ações rápidas (sucesso, erro, informação)
- Skeletons de loading durante carregamento
- Confirmação modal para ações destrutivas
- Badges coloridos para status (planos, pedidos, aprovação)
- Estrelas para avaliações
- Barras de progresso para séries e metas

---

## 8. Definição do MVP

O MVP entrega o **core de valor** da plataforma: gerenciar coleção, comprar/vender quadrinhos e monetizar via links de afiliado. Features complementares (notícias, trocas, metas, relatórios avançados) ficam para versões futuras.

### Incluído no MVP

**Fundação:**
- Autenticação completa (cadastro, login, recuperação de senha)
- Layout responsivo com tema escuro e claro (toggle)
- Internacionalização (PT, extensível para novos idiomas)

**Catálogo e Coleção (core):**
- Catálogo completo com busca, filtros, paginação e aprovação editorial
- Coleção pessoal com add/edit/remove, status de leitura
- Import/Export de coleção via CSV
- Séries, categorias, tags, personagens
- Páginas de séries com progresso

**E-Commerce (parcial):**
- Carrinho com reserva de 24h
- Criação de pedido unificado
- **Pagamento PIX** (foco principal para o mercado brasileiro)
- Tracking de envio
- Comissões calculadas automaticamente
- Gestão de endereços

> **Nota sobre cartão de crédito:** A integração com Stripe para cartão fica fora do MVP. O PIX cobre a grande maioria dos pagamentos no Brasil. O cartão será adicionado logo em seguida.

**Assinaturas (mínimo):**
- Um plano pago (BASIC) além do FREE — suficiente para validar a monetização
- Compra e cancelamento de plano via Stripe
- Enforcement de limites de coleção

**Social (mínimo):**
- Avaliações de catálogo e vendedor (estrelas + review)
- Favoritos
- Comentários nos catálogos

**Notificações (mínimo):**
- Notificações in-app (bell icon com dropdown)
- Emails transacionais essenciais: boas-vindas, confirmação de pagamento, notificação de envio, notificação de venda, reset de senha
- Preferências simples (on/off por tipo)

> **Nota:** SSE (real-time), Web Push, digest, quiet hours e analytics ficam fora do MVP. O MVP usa polling simples para notificações.

**Admin (mínimo):**
- Dashboard básico com métricas principais
- Aprovação/rejeição de catálogos
- Gestão de usuários, categorias, séries, personagens
- Configuração de comissões e planos

**Ofertas e Afiliados (receita principal):**
- Cadastro de ofertas com links de afiliado (Amazon, Mercado Livre, eBay, etc.)
- Configuração de tags de afiliado por loja no painel admin
- Página **/deals** com listagem, filtros por loja/categoria e expiração automática
- Dashboard de cliques e métricas de afiliados (admin)

**Homepage:**
- Homepage pública com seções: banner, destaques do catálogo, **ofertas do dia** (afiliados), cupons em destaque
- Ordem e visibilidade das seções configuráveis pelo admin

**Legal:**
- Termos de Uso, Política de Privacidade, Termos do Vendedor (aceite obrigatório)
- Demais políticas (pagamento, devolução, envio, cancelamento, cookies)
- Fluxo de disputas entre comprador e vendedor com mediação do admin
- Conformidade LGPD básica (exclusão de conta, acesso a dados)

**Produção:**
- Deploy básico com HTTPS e monitoramento
- Backups automáticos

### Fora do MVP (próximas versões)

- Pagamento por cartão de crédito (Stripe)
- Planos STANDARD e PREMIUM
- Notificações real-time (SSE), Web Push, digest, quiet hours, analytics
- Miniblog do admin
- News feed (agregação de notícias externas)
- Sistema de trocas
- Relatórios de gastos e timelines
- Metas de compras e leituras
- Dashboard avançado do usuário com gráficos
- Proteção automatizada contra fraude (limites, score, bloqueio preventivo, painel de fraude)
- Swagger/documentação da API
- Testes de performance (carga)

### Sequência pós-MVP

1. **Cartão de crédito + planos completos** — desbloqueio de receita adicional
2. **Miniblog do admin** — conteúdo editorial, SEO, engajamento
3. **Proteção contra fraude** — limites automáticos, score de confiança, painel de fraude
4. **Notificações avançadas** — real-time, push, digest, preferências granulares
5. **Relatórios, timelines, metas** — retenção e valor para o colecionador
6. **News feed e trocas** — comunidade
7. **Polish** — performance, Swagger, cobertura completa de testes

---

## 9. Fora de Escopo (não planejado)

- App mobile nativo (iOS/Android)
- Marketplace de produtos físicos que não sejam quadrinhos
- Sistema de leilão
- Chat em tempo real entre usuários (fora do contexto de trocas)
- Integração com redes sociais para login (Google, Facebook, Apple)
- Multi-tenancy (múltiplas lojas)
- Tradução automática de conteúdo gerado pelo admin (blog, políticas)
- Logística própria (a plataforma não faz envio, apenas conecta comprador e vendedor)

---

## 10. Visão Futura

Features de alto valor estratégico planejadas para além das versões iniciais:

### Reconhecimento de quadrinhos por IA

O usuário aponta a câmera do celular para um quadrinho e o sistema identifica automaticamente do que se trata, preenchendo os dados do catálogo.

**Modalidades:**
- **Reconhecimento por imagem da capa:** a IA compara a foto com o banco de capas do catálogo e sugere o quadrinho correspondente
- **Leitura de código de barras / ISBN:** a câmera lê o código de barras e busca no catálogo

**Benefícios:**
- Agiliza drasticamente o cadastro de coleções grandes (dezenas/centenas de exemplares)
- Reduz erros de digitação e cadastros duplicados
- Experiência diferenciada que nenhuma plataforma concorrente oferece no Brasil

**Pré-requisitos:** catálogo robusto com imagens de capa de alta qualidade e códigos de barras cadastrados.

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| **Catálogo** | Registro único de um quadrinho na plataforma (título, autor, editora). Funciona como o "produto" |
| **Exemplar (Comic)** | Uma cópia física de um quadrinho pertencente a um usuário. Vinculado a um catálogo |
| **Série** | Agrupamento de catálogos em uma série editorial (ex: "Turma da Mônica Jovem") |
| **Herói/Personagem** | Personagem de quadrinhos associado a catálogos (ex: Batman, Goku) |
| **Comissão** | Percentual cobrado pela plataforma sobre o valor de cada venda |
| **Reserva** | Bloqueio temporário de um exemplar no carrinho por 24 horas |
| **Plano** | Nível de assinatura (FREE, BASIC, STANDARD, PREMIUM) com benefícios escalonados |
| **Tier** | Sinônimo de plano/nível de assinatura |
| **Snapshot** | Cópia dos valores no momento da compra, imutável após criação |
| **Digest** | Resumo periódico (diário ou semanal) agrupando múltiplas notificações |
| **Quiet hours** | Período configurável em que push e email não são enviados |
| **Oferta de terceiro** | Cupom ou promoção de loja externa (Mercado Livre, Amazon, etc.) curada pelo admin |
| **Compra externa** | Compra registrada manualmente pelo usuário, feita fora da plataforma |
| **Disputa** | Contestação aberta pelo comprador sobre um item de pedido (não recebido, diferente do anunciado, etc.) |
| **Chargeback** | Estorno de pagamento iniciado pelo comprador ou pela plataforma após resolução de disputa |
| **Mediação** | Etapa em que o admin avalia evidências de comprador e vendedor para decidir uma disputa |
| **Link de afiliado** | URL de loja parceira contendo tag de rastreamento que credita comissão à plataforma por vendas originadas no clique |
| **Tag de afiliado** | Identificador único da plataforma nos programas de afiliado (ex: `?tag=comicstrunk-20` na Amazon) |

---

## Referências

- **Padrões de código:** [PATTERNS.md](PATTERNS.md) — como construir cada feature

---

**Documento mantido por:** Equipe Comics Trunk
**Última atualização:** 2026-02-21
**Versão:** 3.0
