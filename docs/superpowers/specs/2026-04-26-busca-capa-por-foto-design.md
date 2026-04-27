# Busca de capa por foto — Design

**Data:** 2026-04-26
**Status:** Aprovado para escrita de plano
**Autor:** Fernando + Claude

---

## 1. Visão e objetivo

Permitir que o usuário **fotografe a capa de um gibi/HQ/mangá** e o Comics Trunk identifique qual edição é, devolvendo o item do catálogo (ou candidatos) para que ele adicione à coleção, marque na wishlist, ou compre no marketplace.

Restrição central definida com o Fernando: **zero custo recorrente no MVP**, evoluindo para custo baixo e previsível (≤ R$ 20/mês) em produção quando a feature provar adoção.

### Três sub-problemas, uma feature

A "busca por foto" engloba três coisas conceitualmente distintas:

1. **Identificação exata** — "qual edição é essa capa?" (Shazam de capa)
2. **Busca por similaridade** — "que capas se parecem com essa?"
3. **Extração de metadados** — "qual o título, editora, número que aparece na capa?"

A arquitetura é desenhada para cobrir **(1)** primeiro, com **(3)** como meio para (1) no MVP, e **(2)** desbloqueado naturalmente pela Fase 2.

---

## 2. Escopo

### Em escopo

- Endpoint API que recebe foto e devolve candidatos do catálogo ranqueados.
- Página/modal frontend para tirar foto (mobile) ou enviar arquivo (desktop) e selecionar o candidato correto.
- Integração com fluxo de "adicionar à coleção" (após confirmar o match).
- Logging do scan (foto, top-N candidatos, escolha final do usuário) para alimentar futura medida de precisão e fine-tuning.

### Fora de escopo (por ora)

- Detecção de variantes de capa (variant covers do mesmo número).
- Detecção de estado de conservação (CGC-like grading).
- Modo "scan contínuo via câmera" (vídeo). Foto única basta para validar.
- Identificar gibis fora do catálogo atual (será mencionado como "não encontrado", não buscamos external lookup automático nesta versão).

---

## 3. Estratégia em três fases

A feature é construída em fases com **portões claros** entre elas, para evitar over-engineering.

### Fase 1 — MVP: OCR no browser + busca textual fuzzy

**Objetivo:** entregar valor em ~2 dias, custo zero, validar se a feature é usada.

**Como funciona:**

1. Usuário abre `/scan-capa` (ou modal "Buscar por foto" do botão de adicionar à coleção).
2. Tira foto / faz upload no `<input type="file" accept="image/*" capture="environment">`.
3. **Tesseract.js** (carregado on-demand, ~10–15 MB cacheado após 1ª visita) roda OCR direto no browser e extrai todo texto detectado.
4. Cliente faz parsing leve: tenta isolar "número da edição" via regex (`#?\d{1,4}` próximo do topo), restante vai como query livre.
5. Cliente chama `POST /api/v1/catalog/search-by-text` (endpoint novo) com `{ rawText, ocrTokens, candidateNumber }`.
6. API faz busca fuzzy contra `catalog_entries`:
   - Versão A (imediata): `WHERE title LIKE %tok1% OR title LIKE %tok2% ...` + score por hits, com boost para `editionNumber` exato.
   - Versão B (quando Meilisearch estiver no ar — já está na fila do Fernando): query híbrida no índice `catalog`.
7. API devolve top 8 candidatos com `coverUrl` resolvido via `resolveCover()`.
8. Frontend mostra grid de candidatos. Usuário toca o correto → vai pro fluxo "adicionar à coleção" pré-preenchido. Se nenhum bate, oferece busca manual.

**Componentes novos:**

- `apps/web/src/app/[locale]/(collector)/scan-capa/page.tsx` (página dedicada).
- `apps/web/src/components/features/catalog/cover-photo-scanner.tsx` (componente reutilizável — vai entrar no botão "Adicionar à coleção" também).
- Worker Tesseract.js inicializado lazy.
- `apps/api/src/modules/catalog/cover-search.routes.ts` + `cover-search.service.ts` (endpoint `POST /catalog/search-by-text`).
- Tabela `cover_scan_logs` (id, userId, rawText, ocrTokens, candidatesShown JSON, chosenCatalogEntryId nullable, createdAt) — alimenta análise futura.

**Custo:** R$ 0 recorrente. OCR roda no cliente, busca usa MySQL existente (ou Meilisearch quando subir).

**Limitações conhecidas:**

- OCR ruim em capas estilizadas (mangá com kanji + título estilizado), bordas cortadas, foto torta, reflexo.
- Sem busca visual: capa muito conhecida sem texto legível na foto não acha.
- Mitigação: sempre oferecer "buscar manualmente" como fallback em qualquer tela do scanner.

**Critério para promover à Fase 2:**
- ≥ 30 scans/dia de média em 2 semanas consecutivas; **OU**
- Taxa de "nenhum candidato escolhido" > 40% (sinal de que OCR não basta).

---

### Fase 2 — Produção: VLM (Llama 3.2 Vision) via Cloudflare Workers AI

> **Atualização (2026-04-27):** A spec original desta fase apontava `@cf/openai/clip-vit-base-patch32` como motor. Verificação direta em 2026-04-27 confirmou que esse modelo **foi removido do catálogo da Cloudflare Workers AI** (HTTP 403 "This account is not allowed to access this model" para todas as contas). A arquitetura foi revisada para usar **`@cf/meta/llama-3.2-11b-vision-instruct`** — VLM (Vision-Language Model) que continua no catálogo, em GA. Em vez de busca por similaridade visual via embeddings, agora o modelo *lê e descreve a capa em texto estruturado*, alimentando busca textual robusta. Validado com chamada real em 2026-04-27 (capa do Spider-Man do Open Library): identificou título, editora e autores com confidence "alta" em formato JSON. Custo medido: ~R$ 0,00075 por scan.

**Objetivo:** elevar precisão para ~90%+ em capas estilizadas, mangás, e capas onde Tesseract falha. Permanecer no ecossistema Cloudflare. Sem stack nova.

**Como funciona:**

1. **Cliente** comprime a foto (max 800px width, JPEG quality 80) e codifica em base64 (`data:image/jpeg;base64,...`).
2. **Cliente** chama o novo endpoint `POST /api/v1/cover-scan/recognize` com `{ imageBase64 }`.
3. **API** monta payload pro Workers AI:
   ```json
   {
     "messages": [{
       "role": "user",
       "content": [
         {"type": "text", "text": "<system + prompt estruturado>"},
         {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
       ]
     }],
     "max_tokens": 400
   }
   ```
4. **Workers AI** retorna JSON estruturado (em string dentro do `result.response`) tipo:
   ```json
   {
     "title": "Transmetropolitan",
     "issue_number": 1,
     "publisher": "Panini",
     "authors": ["Warren Ellis", "Darick Robertson"],
     "series": "Transmetropolitan",
     "language": "pt-BR",
     "confidence": "alta",
     "ocr_text": "todo texto visível na capa..."
   }
   ```
5. **API** parsea o JSON, normaliza tokens (title + series + authors + ocr_text), chama `searchByText` (já existente da Fase 1) com tokens enriquecidos + `editionNumber=issue_number`.
6. **API** retorna top 8 candidatos como hoje. Reusa `cover_scan_logs`, rate limit, endpoint `/choose`.

**Por que isso resolve capas estilizadas (Transmetropolitan etc.):**

- Llama 3.2 Vision é um VLM moderno (11B params, GA) — vê a imagem inteira como ser humano vê: arte, estilo, texto pequeno, créditos no canto, tudo.
- Para gibis famosos (Marvel/DC/Image), o modelo já tem conhecimento prévio — identifica direto pelo visual.
- Para gibis brasileiros menos famosos, ele pelo menos **lê todo texto da capa de forma confiável** (muito melhor que Tesseract puro), alimentando busca textual.

**Componentes novos:**

- `apps/api/src/shared/lib/cloudflare-ai.ts` — cliente fino para Workers AI (autoriza, monta payload, parsea JSON da resposta).
- `apps/api/src/modules/cover-scan/cover-recognize.service.ts` — orquestra: chama Workers AI → parseia JSON → reutiliza `searchByText` da Fase 1 com input enriquecido.
- `apps/api/src/modules/cover-scan/cover-scan.routes.ts` — adiciona rota `POST /recognize` (mantém `POST /search` da Fase 1 como fallback).
- Variáveis env: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (token com permissão `Workers AI: Read + Edit`).
- Frontend `cover-photo-scanner.tsx` reescrito: remove Tesseract.js, comprime imagem no canvas, envia base64 pra `/recognize`. Fluxo de UI igual.
- Remove dependência `tesseract.js` do `apps/web/package.json`.

**Custo (medido em chamada real):**

- 1 scan = ~1.700 tokens input ($0,049/M = $0,000083) + ~100 tokens output ($0,68/M = $0,000068) ≈ **$0,00015 por scan**.
- Volume B (15k/mês): **~R$ 11/mês**. Pico de 30k/mês: ~R$ 22/mês.
- **Sem Python, sem Qdrant, sem VPS adicional, sem job de embeddings, sem coluna BLOB.**
- R2 segue como está.
- Aviso operacional: a primeira chamada de uma conta nova tem que enviar `{"prompt":"agree"}` ao endpoint do Llama 3.2 Vision para aceitar a licença Meta — passo único, já feito na conta atual em 2026-04-27.

**Limitações conhecidas:**

- VLM custa por scan (não é "infinitamente grátis" como CLIP+free tier seria). Para volumes muito altos (>1M/mês) reavaliar.
- Llama 3.2 Vision **não roda no EU** (cláusula da licença Meta). Comics Trunk é Brasil — sem problema.
- Responde melhor em inglês para títulos clássicos. Prompt em português força output em pt-BR — testar com várias capas brasileiras na execução.
- Llama pode "alucinar" um título plausível para capa muito ambígua — `confidence` no output ajuda a filtrar; também sempre retorna top N candidatos do catálogo, não confia 100% no que o VLM disse.

**Critério para promover à Fase 3:**
- Taxa de top-1 escolhido < 75% após 200+ scans logados; **OU**
- Custo mensal estourar R$ 50 (sinal de que volume cresceu — vale otimizar com fine-tune e cache de prompt).

---

### Fase 3 — Refinamento (futuro, só se Fase 2 não bastar)

**Objetivo:** se a Fase 2 (Llama Vision) ficar abaixo de 75% de top-1 após 200+ scans, ou se o custo virar problema, refinar com técnicas adicionais.

**Direções possíveis (a decidir conforme dados reais):**

1. **Cache de prompt** no Cloudflare AI Gateway: requisições com prompts repetidos pagam menos. Prompt sistema fica idêntico — só a imagem muda. Reduz custo ~30%.
2. **Reranking LLM**: pegar top 8 candidatos do Llama Vision e passar por Claude Haiku 4.5 com lista dos candidatos pra escolher o melhor (~R$ 0,002 extra por scan).
3. **Embeddings reais (CLIP via outro provedor)**: se busca visual pura virar essencial, integrar Hugging Face ou self-host onnxruntime-node (requer migração pra VPS).
4. **Fine-tuning** de modelo open-source com pares `(foto_real_do_usuario, capa_oficial_do_catalogo)` capturados nos logs `cover_scan_logs` (precisa opt-in do user pra guardar foto).
5. **Variantes de capa**: detectar A/B/C do mesmo número — exige metadado novo no catálogo.
6. **"Capas similares"** como feature de descoberta no detalhe do produto.

**Critério para iniciar:** Fase 2 em produção há ≥4 semanas, métricas de sucesso/falha coletadas, decisão tomada com dados reais.

---

## 4. Resumo de custos por fase

| Fase | Custo recorrente | Esforço (dev) | Precisão esperada | Status |
|---|---|---|---|---|
| **1 — MVP OCR + texto** | R$ 0 | ~2 dias | ~70% em capas legíveis | ✅ Implementada (Tesseract.js); falha em capas estilizadas |
| **2 — Llama 3.2 Vision (Workers AI)** | ~R$ 11/mês | ~3–4 dias | ~88–92% geral | 🚧 Em planejamento (substituiu CLIP+CF que foi removido) |
| **3 — Refinamento** | a definir | ~1–2 semanas | ~95%+ | Futuro, conforme métricas |

---

## 5. Decisões arquiteturais explícitas

1. **Sem Python no stack.** Workers AI faz inferência. Treinos futuros (se vierem) são atos isolados em Colab.
2. **Sem busca vetorial em DB.** Em vez de embeddings + similaridade coseno, usamos VLM (Llama Vision) que descreve a capa em texto, e reusamos a busca textual da Fase 1 (já existente). Mais simples, equivale na prática para nosso domínio (gibis com algum texto e identidade visual reconhecível).
3. **OCR no browser na Fase 1, removido na Fase 2.** Llama Vision faz OCR muito melhor que Tesseract.js, e como o servidor já está envolvido (chama Workers AI), o cliente fica leve: só comprime e envia base64.
4. **Compressão sempre antes de enviar pro modelo** (max 800 px width, JPEG quality 80). Reduz tokens consumidos pelo Llama Vision (~1.700 → ~1.200 por scan) sem prejudicar identificação. Mesma regra que já existe pra upload no projeto.
5. **Logging desde a Fase 1** (`cover_scan_logs`). Mesma tabela serve as duas fases — só os campos `rawText` e `ocrTokens` mudam de semântica (na Fase 2 viram o JSON do Llama e tokens enriquecidos).
6. **Endpoint `/recognize` novo, separado do `/search`.** Mantém a Fase 1 acessível como fallback se Workers AI estiver indisponível ou se quisermos comparar resultados. Frontend chama `/recognize`; se erro 5xx, oferece "tentar busca por OCR (mais simples)" que cai no `/search`.
7. **Token Cloudflare com permissão Workers AI Read+Edit**, sem outras permissões (princípio de menor privilégio). Token vive em env var, nunca commitado.

---

## 6. Alternativas consideradas e descartadas

### CLIP via Cloudflare Workers AI (`@cf/openai/clip-vit-base-patch32`)

- **Era a arquitetura original da Fase 2** quando esta spec foi escrita.
- **Por que abandonado em 2026-04-27:** o modelo foi **removido do catálogo público da Cloudflare**. Verificado direto via API: HTTP 403 "This account is not allowed to access this model". Modelo não existe mais. Llama 3.2 Vision substituiu como motor.

### CLIP no browser com embeddings pré-computados (zero custo total)

- **Por que descartado:** primeiro acesso baixa ~50–100 MB de modelo + ~55 MB de embeddings (Float16, 27k capas). Em mobile 4G é UX ruim. Quando catálogo crescer pra 100k+, embeddings viram 200 MB+ — não escala.

### Python microservice (FastAPI) + Qdrant + VPS

- **Por que descartado:** dobra superfície operacional (deploy, monitoramento, dois stacks) sem ganho real. Llama Vision atende bem o caso de uso, e fica tudo dentro do ecossistema Cloudflare que já usamos.

### Hugging Face Inference API com CLIP

- **Por que descartado:** free tier limitado com cold start de ~20s (UX ruim). Pagar custa similar ao Llama Vision na CF, mas adiciona provedor novo. Sem ganho que justifique.

### Anthropic Claude Haiku 4.5 ou OpenAI GPT-4o-mini com vision

- **Por que descartado como motor principal:** ~R$ 50–150/mês no volume B. Mais caro que Llama Vision (~R$ 11/mês) sem ganho proporcional para identificação de capas — Llama 3.2 Vision (11B) é suficientemente capaz e moderno.
- **Mantido como opção futura** para reranking dos top N candidatos na Fase 3 se a precisão do Llama Vision sozinho não bastar.

### Self-host CLIP via onnxruntime-node

- **Por que descartado:** requer ~1–2 GB RAM extra, incompatível com cPanel atual (1 GB compartilhada). Migrar pra VPS adiciona R$ 25–50/mês de infra + manutenção. Não vale enquanto Llama Vision via CF resolve.

### Google Cloud Vision / AWS Rekognition

- **Por que descartado:** free tier estourável, depende de provedor novo, sem ganho sobre Cloudflare Workers AI no nosso volume.

---

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Tesseract.js trava em foto grande | Comprimir no cliente antes (600 px max). Limitar tamanho. |
| OCR vaza dados do usuário pro servidor desnecessariamente | Fica no cliente. Só `rawText + tokens` chega ao servidor — não a foto. |
| Cloudflare Workers AI quebra free tier no pico | Monitorar; cair pra fila de retry com backoff. Custo de overflow é baixo (~$0,0001/req). |
| Embedding em memória estoura RAM do cPanel | Não ligar Fase 2 em produção até VPS / aumento de plano. Documentado no critério de promoção. |
| Capa com placeholder Rika ("IMAGEM INDISPONÍVEL") gera embedding inútil | Filtrar `coverFileName` cujo hash bate com placeholders conhecidos antes de gerar embedding. |
| Foto do usuário inclui múltiplas capas (estante) | Out of scope para v1. Documentar como "tire foto de uma capa por vez". |
| Privacidade da foto enviada | Não armazenar a foto no servidor por padrão. Logar apenas metadata + texto OCR + escolha. Consentimento opcional para guardar foto em prol de fine-tuning futuro. |

---

## 8. Decisões em aberto (resolver antes do plano de implementação)

1. **Onde plugar o entry point no frontend:** página dedicada `/scan-capa`, ou só botão dentro do modal "Adicionar à coleção"? **Provável: ambos**, mas plano fala isso.
2. ~~**Login obrigatório?**~~ **DECIDIDO (2026-04-27): SIM, login obrigatório.** Endpoint atrás de `authenticate` middleware. Reduz abuso; evita custo em chamadas anônimas mesmo no MVP zero-custo (no caso de Fase 2 com Workers AI).
3. ~~**Limite de scans por usuário/dia?**~~ **DECIDIDO (2026-04-27): 30/dia/usuário.** Configurável por env var (`COVER_SCAN_DAILY_LIMIT=30`). Implementar em rate-limiter middleware no endpoint, contando entradas em `cover_scan_logs` na janela de 24h.
4. **Permissão de armazenar a foto** (para fine-tuning Fase 3): checkbox opt-in no scanner ("ajude a melhorar a busca"). Sem isso, foto é descartada após processamento.

Decisão 4 fica para o plano de implementação (writing-plans).

---

## 9. Referências

- Memória: `project_cover_recognition.md` (abordagem original, agora superada por este documento)
- Memória: `project_cover_architecture.md` (R2, resolveCover)
- Memória: `project_meilisearch.md` (Meilisearch chega antes de Fase 1, integra na busca textual)
- Memória: `project_cpanel_limits.md` (RAM 1 GB — bloqueador para Fase 2 antes da migração de servidor)
- Cloudflare Workers AI / CLIP: modelo `@cf/openai/clip-vit-base-patch32`
- Tesseract.js: https://github.com/naptha/tesseract.js
