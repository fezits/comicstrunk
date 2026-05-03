# Próximos passos do Comics Trunk

Lista curada das frentes maiores que estão **planejadas ou pendentes**, com link para o spec correspondente. Cada item aqui é um movimento estratégico — não tarefa de dia-a-dia. Atualizar à medida que specs novos forem criados ou os existentes forem encerrados.

---

## Em design (spec criado, aguardando aprovação ou implementação)

### scan-capa: edição de texto antes da busca

- **Status:** Spec aprovado por Fernando em 2026-05-02. Aguardando plano de implementação via `writing-plans`.
- **Spec:** [`specs/2026-05-02-scan-capa-edit-before-search-design.md`](specs/2026-05-02-scan-capa-edit-before-search-design.md)
- **TL;DR:** Quebrar `/cover-scan/recognize` em duas etapas — extração (VLM) → edição → busca. Usuário pode corrigir os 5 campos do VLM (`title`, `issueNumber`, `publisher`, `series`, `ocrText`) e adicionar termos extras antes de buscar. Buscas iterativas (não chama VLM de novo). Cada busca re-pinga Metron + Rika. Migration aditiva em `cover_scan_logs` (`search_attempts INT`).
- **Próximo passo:** plano de implementação detalhado via `writing-plans` (TDD strict).

### Dedup do catálogo: persistir decisões via sourceKey + bloquear reimport — IMPLEMENTADO (em soak)

- **Status:** Implementado e deployado em 2026-05-02. Em soak period — aguardando 2-3 dias para confirmar que cron das 4h não trouxe duplicatas dispensadas de volta. Após soak: drop `dismissed_duplicates_legacy` (Fernando autoriza).
- **Spec:** [`specs/2026-04-30-dedup-source-key-persist-design.md`](specs/2026-04-30-dedup-source-key-persist-design.md)
- **TL;DR:** Mudou persistência das decisões de `/admin/duplicates` de id (volátil) para sourceKey (estável). Adicionou `removed_source_keys` (blacklist) consultada por sync-catalog e cover-import.

### 🌎 Internacionalização — inglês + USD + afiliados US

- **Status:** Spec criado em 2026-04-28, aguardando revisão de Fernando.
- **Spec:** [`specs/2026-04-28-internacionalizacao-ingles-usd-design.md`](specs/2026-04-28-internacionalizacao-ingles-usd-design.md)
- **TL;DR:** Abrir o site para o mercado anglófono (`en-US` como primeira variação). Monetização internacional via Amazon Associates US + eBay Partner Network. Marketplace P2P **continua só BR** (até Fernando se mudar pros EUA). Plano em 7 fases — algumas dependem de aprovações externas (Amazon, eBay) que não bloqueiam código.
- **Bloqueios externos a iniciar em paralelo:** abrir conta Amazon Associates US, aplicar para eBay Partner Network.
- **Próximo passo:** após aprovação do spec, gerar plano de implementação da Fase 1 via `writing-plans`.

---

## Em implementação ativa

_(nada por enquanto — preencher quando uma fase de algum spec começar)_

---

## Specs anteriores (referência histórica)

- [Pix estático para pagamentos (2026-04-17)](specs/2026-04-17-pix-static-payment.md) — implementado.
- [Reading timeline / linha do tempo de leitura (2026-04-23)](specs/2026-04-23-reading-timeline-design.md)
- [Busca de capa por foto (2026-04-26)](specs/2026-04-26-busca-capa-por-foto-design.md) — implementado nas 3 fases (VLM + textual + federated external sources).

---

## Ideias rastreadas (sem spec ainda)

Lista informal — quando uma destas ganhar prioridade, vira spec via skill `brainstorming`.

- **Esconder prefixos "rika"/"panini"/"gcd" das URLs públicas de capas.** Hoje os arquivos de capa no R2 são `rika-{id}.jpg`, `panini-{sku}.jpg` — visíveis pra qualquer usuário que inspecione devtools. Renomear pra hash/cuid neutro. ~9k arquivos no R2 + atualização do `coverFileName` no banco + cuidado com cache do CDN. Disparador: Fernando confirmou em 2026-04-30 que o vazamento incomoda.
- **Repensar cron das 4h.** Hoje importa automaticamente novidades de Rika + Panini, atualiza preços e baixa capas. Avaliar se faz mais sentido virar import manual com curadoria do admin (mais controle, menos surpresa). Disparador: Fernando levantou a pergunta "qual a razão dele entrar?".
- **Meilisearch** — busca fuzzy do catálogo. Plano em [`docs/PLAN-MEILISEARCH.md`](../PLAN-MEILISEARCH.md).
- **Refactor work/edition do catálogo** — modelo "obra com edições por região". Documentado como evolução natural no spec de internacionalização. Disparador: catálogo cruzar 2k+ títulos com sobreposição BR/US relevante.
- **Marketplace P2P internacional** — bloqueado por mudança de Fernando pros EUA + LLC US. Documentado como Phase 7 do spec de internacionalização.
- **App mobile** — fora do escopo atual.
- **Vitrines automatizadas Amazon PA-API + eBay Finding API** — Phase 6 do spec de internacionalização. Bloqueada por aprovações dos programas.
- **GDPR / mercado UK/EU** — adiado até validar tração no mercado US.
