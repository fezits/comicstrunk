# Próximos passos do Comics Trunk

Lista curada das frentes maiores que estão **planejadas ou pendentes**, com link para o spec correspondente. Cada item aqui é um movimento estratégico — não tarefa de dia-a-dia. Atualizar à medida que specs novos forem criados ou os existentes forem encerrados.

---

## Em design (spec criado, aguardando aprovação ou implementação)

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

- **Meilisearch** — busca fuzzy do catálogo. Plano em [`docs/PLAN-MEILISEARCH.md`](../PLAN-MEILISEARCH.md).
- **Refactor work/edition do catálogo** — modelo "obra com edições por região". Documentado como evolução natural no spec de internacionalização. Disparador: catálogo cruzar 2k+ títulos com sobreposição BR/US relevante.
- **Marketplace P2P internacional** — bloqueado por mudança de Fernando pros EUA + LLC US. Documentado como Phase 7 do spec de internacionalização.
- **App mobile** — fora do escopo atual.
- **Vitrines automatizadas Amazon PA-API + eBay Finding API** — Phase 6 do spec de internacionalização. Bloqueada por aprovações dos programas.
- **GDPR / mercado UK/EU** — adiado até validar tração no mercado US.
