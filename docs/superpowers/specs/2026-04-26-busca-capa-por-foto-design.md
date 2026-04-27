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

### Fase 2 — Produção: CLIP via Cloudflare Workers AI + cosine local

**Objetivo:** elevar precisão para ~90%+ em capas legíveis e cobrir capas onde OCR falha (estilizadas, mangás, capas sem texto grande). Permanecer dentro do ecossistema Cloudflare que o projeto já usa (R2). Sem stack nova.

**Como funciona:**

1. **Job offline** (script Node em `scripts/`): para cada `CatalogEntry` com capa, baixa imagem do R2, envia ao **Cloudflare Workers AI** (`@cf/openai/clip-vit-base-patch32`), recebe embedding de 512 floats. Salva em coluna nova `catalog_entries.cover_embedding` (`MEDIUMBLOB`, ~1 KB por linha em Float16).
   - 27k capas × 1 chamada = 27k neurons. Free tier diário cobre. Roda em ~30 min.
   - Idempotente: pula se `cover_embedding_hash` (sha do arquivo) bate.
2. **Endpoint runtime** `POST /api/v1/catalog/recognize`:
   - Recebe `multipart/form-data` com a foto (compressão prévia no cliente: 600 px width, JPEG 80 — mesma regra que `downloadCover` usa).
   - API repassa pro Cloudflare Workers AI → recebe embedding da foto.
   - **Brute-force cosine similarity em Node** contra todas as 27k–500k linhas com `cover_embedding NOT NULL`. Em Node, usando `Float32Array` + loop simples, 100k vetores rodam em ~30–60 ms numa CPU média.
   - Para acelerar e reduzir uso de RAM, embeddings ficam **em cache em memória** no processo da API (carregados na startup). 100k × 1 KB = 100 MB — limite no cPanel, mas o Fernando já planeja sair pra VPS quando o tráfego crescer.
   - Retorna top 8 candidatos com score.
3. **Reranking opcional** (atrás de feature flag): top 5 candidatos passam por OCR no servidor (Tesseract Node) ou Claude Haiku 4.5 que confirma número/título. Custo extra ínfimo.
4. Frontend muda 1 linha: chama `/recognize` em vez de `/search-by-text`. UX igual à Fase 1.

**Componentes novos:**

- Migration: `catalog_entries.cover_embedding` (MEDIUMBLOB) + `cover_embedding_hash` (CHAR(64)).
- `scripts/generate-cover-embeddings.js` — gera embeddings em batch via Workers AI.
- `apps/api/src/shared/lib/cloudflare-ai.ts` — cliente fino para Workers AI.
- `apps/api/src/shared/lib/embedding-cache.ts` — carrega todos embeddings na memória, expõe `findSimilar(embedding, topK)`.
- `apps/api/src/modules/catalog/cover-recognize.routes.ts` + `cover-recognize.service.ts`.
- Hook no `catalog.service.ts`: ao criar/atualizar `coverImageUrl`, enfileira regeneração de embedding (fire-and-forget).

**Custo:**

- Workers AI: ~R$ 8–15/mês em volume B (15k scans + ~500 embeddings novos/mês de catálogo crescendo).
- R2: já existe, capas já estão lá.
- Banco: `MEDIUMBLOB` x 100k linhas ≈ 100 MB — trivial no MySQL atual.
- **Sem Python, sem Qdrant, sem VPS adicional.**

**Limitações conhecidas:**

- 100 MB em memória do processo Node. No cPanel atual (1 GB compartilhada) é arriscado — esperar VPS antes de ligar Fase 2 em produção, ou usar streaming/mmap.
- Catálogo > 500k capas precisa repensar: brute-force cosine vira > 200 ms. Aí entra banco vetorial (não antes).

**Critério para promover à Fase 3:**
- Catálogo > 200k entradas; **OU**
- Precisão observada (taxa de top-1 ser escolhido) abaixo de 75% — sinaliza que CLIP genérico não basta para o estilo das capas brasileiras.

---

### Fase 3 — Refinamento: fine-tune CLIP + híbrido OCR+CLIP

**Objetivo:** levar precisão para 95%+ em todas as categorias, incluindo capas estilizadas e mangás.

**Como funciona:**

1. **Fine-tuning de CLIP** com o próprio dataset:
   - Usa logs da Fase 1+2 (`cover_scan_logs`) — temos pares `(foto_real_do_usuario, capa_oficial_do_catalogo)`.
   - Treino em Google Colab grátis (T4) — 2–4 h.
   - Modelo fine-tuned vai pra Hugging Face / R2 e é servido via Hugging Face Inference Endpoint dedicado (custo: ~$0.06/h só quando idle, ~$1/h ativo) **ou** convertido para ONNX e carregado via `onnxruntime-node` direto na API.
2. **Híbrido OCR + CLIP**: pipeline em paralelo:
   - OCR extrai texto → query textual gera ranking A.
   - CLIP gera embedding → similaridade gera ranking B.
   - Score final = combinação ponderada (peso aprendido a partir dos logs). Capa com texto claro confia em OCR; capa estilizada confia em CLIP.
3. Possíveis adições conforme necessidade:
   - Detecção de variantes de capa (capas A/B/C do mesmo número) — exige metadado novo no catálogo.
   - "Capas similares" como feature de descoberta no detalhe do produto.

**Componentes novos:**

- `scripts/train-clip-finetune.py` (Colab notebook + script reproduzível).
- Migração de embeddings: regerar todos os 100k+ com modelo fine-tuned.
- Lógica de score combinado em `cover-recognize.service.ts`.

**Custo:**

- Fine-tune: zero, só tempo.
- Hospedar modelo fine-tuned: R$ 0 se ONNX local, R$ 30–80/mês se HF Inference dedicado.
- Total provável: R$ 10–80/mês dependendo de escolha de hospedagem.

---

## 4. Resumo de custos por fase

| Fase | Custo recorrente | Esforço (dev) | Precisão esperada |
|---|---|---|---|
| **1 — MVP OCR + texto** | R$ 0 | ~2 dias | ~70% em capas legíveis |
| **2 — Workers AI + cosine** | R$ 10–20/mês | ~5–7 dias | ~88–92% geral |
| **3 — Fine-tune + híbrido** | R$ 10–80/mês | ~1–2 semanas | ~95%+ |

---

## 5. Decisões arquiteturais explícitas

1. **Sem Python no stack.** Decisão: o ganho de "ecosistema ML em Python" não compensa dobrar a superfície de manutenção. Cloudflare Workers AI resolve inferência. Fine-tuning é ato isolado em Colab.
2. **Sem banco vetorial dedicado** (Qdrant/Pinecone/Weaviate) **enquanto < 500k capas**. Brute-force cosine em Node sobre embeddings em memória é O(n) e fica < 100 ms para o nosso volume real. Adicionar Qdrant é sempre uma evolução possível, mas começar com isso é over-engineering.
3. **OCR no browser na Fase 1, no servidor na Fase 2.** Razão: Fase 1 não tem servidor de inferência; cliente é grátis. Fase 2 já tem Cloudflare AI; rodar OCR no Node fica natural e dá pra reranking.
4. **Embeddings em coluna MySQL, não em arquivo.** Sincronização com criação/edição de `CatalogEntry` fica trivial (mesmo trigger de qualquer outro campo).
5. **Capa sempre passa por compressão antes de enviar pro modelo** (600 px, JPEG 80) — vale tanto cliente quanto servidor. Mesma regra que já existe pro upload de capa no projeto.
6. **Logging desde a Fase 1** (`cover_scan_logs`). Sem log, Fase 3 (fine-tuning) fica inviável depois. Custo de espaço é desprezível (~1 KB por scan, exclui blob da foto).

---

## 6. Alternativas consideradas e descartadas

### CLIP no browser com embeddings pré-computados (zero custo total)

- **Por que descartado:** primeiro acesso baixa ~50–100 MB de modelo + ~55 MB de embeddings (Float16, 27k capas). Em mobile 4G é UX ruim. Quando catálogo crescer pra 100k+, embeddings viram 200 MB+ — não escala. Era um máximo local que existia só pra cumprir restrição "zero custo recorrente". Aceitar R$ 10–20/mês na Fase 2 elimina o problema.

### Python microservice (FastAPI) + Qdrant + VPS

- **Por que descartado:** dobra superfície operacional (deploy, monitoramento, dois stacks) sem ganho real para o tamanho atual de catálogo. Cloudflare Workers AI faz CLIP igualmente bem. Brute-force cosine substitui Qdrant até 500k vetores. Reconsiderar quando catálogo crescer ordens de magnitude.

### Vision API genérica (Claude Sonnet 4.6 / GPT-4o) extraindo metadados

- **Por que descartado:** custo ~R$ 0,05–0,15 por scan = R$ 750–2.250/mês em volume B. Era a abordagem da memória antiga; o Fernando explicitamente pediu cenários mais baratos. Útil apenas como reranker eventual de top-N na Fase 3, não como motor principal.

### Google Cloud Vision / AWS Rekognition

- **Por que descartado:** free tier estourável (1k–5k/mês), depende de provedor adicional, não traz vantagem sobre Cloudflare Workers AI no nosso volume.

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
2. **Login obrigatório?** Recomendação: sim, para evitar abuso — mas avaliar liberar para anônimo num botão público no header (chamariz).
3. **Limite de scans por usuário/dia?** Sugestão: 30/dia/usuário na Fase 1 (zero custo, mas evita abuso). Configurável por env var.
4. **Permissão de armazenar a foto** (para fine-tuning Fase 3): checkbox opt-in no scanner ("ajude a melhorar a busca"). Sem isso, foto é descartada após processamento.

Estas perguntas ficam para o início da escrita do plano de implementação (writing-plans).

---

## 9. Referências

- Memória: `project_cover_recognition.md` (abordagem original, agora superada por este documento)
- Memória: `project_cover_architecture.md` (R2, resolveCover)
- Memória: `project_meilisearch.md` (Meilisearch chega antes de Fase 1, integra na busca textual)
- Memória: `project_cpanel_limits.md` (RAM 1 GB — bloqueador para Fase 2 antes da migração de servidor)
- Cloudflare Workers AI / CLIP: modelo `@cf/openai/clip-vit-base-patch32`
- Tesseract.js: https://github.com/naptha/tesseract.js
