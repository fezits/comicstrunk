/**
 * fix-accents.ts — Fix broken Portuguese accents and special characters in catalog entries.
 *
 * The production database has entries with missing diacritics (e.g. "Edicao" instead of "Edição")
 * and Unicode replacement characters (U+FFFD `�`) that need to be corrected.
 *
 * This script applies safe, known-pattern replacements only — it does not guess.
 *
 * Usage: npx tsx scripts/fix-accents.ts [options]
 *
 *   --dry-run         Show changes without applying them
 *   --batch-size N    Rows per update batch (default: 100)
 *   --limit N         Max entries to process (default: all)
 *   --field <field>   Only fix a specific field: title, description, publisher, imprint, author
 *   --help            Show this help
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(getArg('--batch-size') || '100', 10);
const LIMIT = parseInt(getArg('--limit') || '0', 10) || 0;
const FIELD_FILTER = getArg('--field') || null;
const SHOW_HELP = args.includes('--help');

if (SHOW_HELP) {
  console.log(`
Usage: npx tsx scripts/fix-accents.ts [options]

Options:
  --dry-run         Show changes without applying them
  --batch-size N    Rows per update batch (default: 100)
  --limit N         Max entries to process (default: all)
  --field <field>   Only fix a specific field: title, description, publisher, imprint, author
  --help            Show this help

Examples:
  npx tsx scripts/fix-accents.ts --dry-run
  npx tsx scripts/fix-accents.ts --dry-run --field title
  npx tsx scripts/fix-accents.ts --batch-size 50
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Replacement rules
// ---------------------------------------------------------------------------

/**
 * Each rule is a pair [pattern, replacement].
 * Patterns use word boundaries (\b) where appropriate to avoid partial matches.
 * Rules are applied in order — more specific patterns come first.
 */
const WORD_REPLACEMENTS: [RegExp, string][] = [
  // --- Multi-word phrases (most specific first) ---
  [/\bTurma da Monica\b/g, 'Turma da Mônica'],
  [/\bSuper-herois\b/gi, 'Super-Heróis'],
  [/\bSuper Herois\b/gi, 'Super-Heróis'],

  // --- Words ending in -ção / -ções (from -cao / -coes) ---
  [/\bEdicao\b/g, 'Edição'],
  [/\bEdicoes\b/g, 'Edições'],
  [/\bColecao\b/g, 'Coleção'],
  [/\bColecoes\b/g, 'Coleções'],
  [/\bAcao\b/g, 'Ação'],
  [/\bAcoes\b/g, 'Ações'],
  [/\bSensacao\b/g, 'Sensação'],
  [/\bSensacoes\b/g, 'Sensações'],
  [/\bDestruicao\b/g, 'Destruição'],
  [/\bInvasao\b/g, 'Invasão'],
  [/\bInvasoes\b/g, 'Invasões'],
  [/\bEvolucao\b/g, 'Evolução'],
  [/\bRevolucao\b/g, 'Revolução'],
  [/\bSalvacao\b/g, 'Salvação'],
  [/\bCriacao\b/g, 'Criação'],
  [/\bMaldicao\b/g, 'Maldição'],
  [/\bPerdicao\b/g, 'Perdição'],
  [/\bTraicao\b/g, 'Traição'],
  [/\bRedencao\b/g, 'Redenção'],
  [/\bMissao\b/g, 'Missão'],
  [/\bMissoes\b/g, 'Missões'],
  [/\bExploracao\b/g, 'Exploração'],
  [/\bAbolicao\b/g, 'Abolição'],
  [/\bAparicao\b/g, 'Aparição'],
  [/\bAssuncao\b/g, 'Assunção'],
  [/\bFundacao\b/g, 'Fundação'],
  [/\bLegiao\b/g, 'Legião'],
  [/\bNacao\b/g, 'Nação'],
  [/\bNacoes\b/g, 'Nações'],
  [/\bOperacao\b/g, 'Operação'],
  [/\bOperacoes\b/g, 'Operações'],
  [/\bPaixao\b/g, 'Paixão'],
  [/\bPrisao\b/g, 'Prisão'],
  [/\bProducao\b/g, 'Produção'],
  [/\bProtecao\b/g, 'Proteção'],
  [/\bResurreicao\b/g, 'Ressurreição'],
  [/\bSituacao\b/g, 'Situação'],
  [/\bTransicao\b/g, 'Transição'],
  [/\bUniao\b/g, 'União'],
  [/\bVinganca\b/g, 'Vingança'],
  [/\bEsperanca\b/g, 'Esperança'],
  [/\bLembranca\b/g, 'Lembrança'],
  [/\bMudanca\b/g, 'Mudança'],
  [/\bAlianca\b/g, 'Aliança'],
  [/\bConfianca\b/g, 'Confiança'],
  [/\bHeranca\b/g, 'Herança'],

  // --- Words ending in -ça / -ço ---
  [/\bJustica\b/g, 'Justiça'],
  [/\bRenascenca\b/g, 'Renascença'],
  [/\bAmeaca\b/g, 'Ameaça'],
  [/\bForca\b/g, 'Força'],
  [/\bPraca\b/g, 'Praça'],
  [/\bCabeca\b/g, 'Cabeça'],
  [/\bComeco\b/g, 'Começo'],
  [/\bPedaco\b/g, 'Pedaço'],
  [/\bCoracao\b/g, 'Coração'],
  [/\bLaco\b/g, 'Laço'],
  [/\bBraco\b/g, 'Braço'],
  [/\bEspaco\b/g, 'Espaço'],
  [/\bPalacio\b/g, 'Palácio'],

  // --- Words with í ---
  [/\bInicio\b/g, 'Início'],
  [/\bHerois\b/g, 'Heróis'],
  [/\bImpossivel\b/g, 'Impossível'],
  [/\bTerrivel\b/g, 'Terrível'],
  [/\bIncrivel\b/g, 'Incrível'],
  [/\bVisivel\b/g, 'Visível'],
  [/\bInvisivel\b/g, 'Invisível'],
  [/\bInvencivel\b/g, 'Invencível'],
  [/\bIndestrutivel\b/g, 'Indestrutível'],
  [/\bImprevisivel\b/g, 'Imprevisível'],
  [/\bVeiculos\b/g, 'Veículos'],
  [/\bVeiculo\b/g, 'Veículo'],

  // --- Words with ú ---
  [/\bNumero\b/g, 'Número'],
  [/\bNumeros\b/g, 'Números'],
  [/\bUnico\b/g, 'Único'],
  [/\bUltimo\b/g, 'Último'],
  [/\bUltima\b/g, 'Última'],
  [/\bMusica\b/g, 'Música'],
  [/\bPublico\b/g, 'Público'],
  [/\bTumulo\b/g, 'Túmulo'],
  [/\bFuria\b/g, 'Fúria'],

  // --- Words with ê / â / ô ---
  [/\bMonica\b/g, 'Mônica'],
  [/\bCronicas\b/g, 'Crônicas'],
  [/\bCronica\b/g, 'Crônica'],
  [/\bEletronico\b/g, 'Eletrônico'],
  [/\bDemonio\b/g, 'Demônio'],
  [/\bDemonios\b/g, 'Demônios'],
  [/\bFenomeno\b/g, 'Fenômeno'],
  [/\bAtomica\b/g, 'Atômica'],
  [/\bAtomico\b/g, 'Atômico'],
  [/\bAngelica\b/g, 'Angélica'],
  [/\bCiencia\b/g, 'Ciência'],
  [/\bCiencias\b/g, 'Ciências'],
  [/\bPresenca\b/g, 'Presença'],
  [/\bAusencia\b/g, 'Ausência'],
  [/\bSequencia\b/g, 'Sequência'],
  [/\bFrequencia\b/g, 'Frequência'],
  [/\bConsequencia\b/g, 'Consequência'],
  [/\bExistencia\b/g, 'Existência'],
  [/\bResistencia\b/g, 'Resistência'],
  [/\bViolencia\b/g, 'Violência'],
  [/\bPotencia\b/g, 'Potência'],
  [/\bEssencia\b/g, 'Essência'],
  [/\bInfluencia\b/g, 'Influência'],
  [/\bEmergencia\b/g, 'Emergência'],
  [/\bReferencia\b/g, 'Referência'],
  [/\bExperiencia\b/g, 'Experiência'],
  [/\bDiferenca\b/g, 'Diferença'],

  // --- Words with é ---
  [/\bMagica\b/g, 'Mágica'],
  [/\bMagico\b/g, 'Mágico'],
  [/\bFantastico\b/g, 'Fantástico'],
  [/\bFantastica\b/g, 'Fantástica'],
  [/\bClassico\b/g, 'Clássico'],
  [/\bClassica\b/g, 'Clássica'],
  [/\bClassicos\b/g, 'Clássicos'],
  [/\bGalactico\b/g, 'Galáctico'],
  [/\bGalactica\b/g, 'Galáctica'],
  [/\bCosmico\b/g, 'Cósmico'],
  [/\bCosmica\b/g, 'Cósmica'],
  [/\bTragico\b/g, 'Trágico'],
  [/\bTragica\b/g, 'Trágica'],
  [/\bEpico\b/g, 'Épico'],
  [/\bEpica\b/g, 'Épica'],
  [/\bMisterio\b/g, 'Mistério'],
  [/\bMisterios\b/g, 'Mistérios'],
  // "Misteriosa" has no accent needed — intentionally not listed
  [/\bSeculo\b/g, 'Século'],
  [/\bSeculos\b/g, 'Séculos'],
  [/\bExercito\b/g, 'Exército'],
  [/\bExercitos\b/g, 'Exércitos'],
  [/\bGenio\b/g, 'Gênio'],
  [/\bGenios\b/g, 'Gênios'],
  [/\bGenero\b/g, 'Gênero'],
  [/\bGeneros\b/g, 'Gêneros'],
  // "Origem" has no accent needed — intentionally not listed
  [/\bHeroi\b/g, 'Herói'],
  [/\bDemencia\b/g, 'Demência'],
  [/\bDecada\b/g, 'Década'],
  [/\bDecadas\b/g, 'Décadas'],
  [/\bTecnica\b/g, 'Técnica'],
  [/\bTecnicas\b/g, 'Técnicas'],

  // --- Words with ã ---
  [/\bOrfao\b/g, 'Órfão'],
  [/\bOrfaos\b/g, 'Órfãos'],
  [/\bIrmao\b/g, 'Irmão'],
  [/\bIrmaos\b/g, 'Irmãos'],
  [/\bMao\b/g, 'Mão'],
  [/\bMaos\b/g, 'Mãos'],
  [/\bVilao\b/g, 'Vilão'],
  [/\bVilaos\b/g, 'Vilãos'],
  [/\bViloes\b/g, 'Vilões'],
  [/\bCampeao\b/g, 'Campeão'],
  [/\bCampeoes\b/g, 'Campeões'],
  [/\bDragao\b/g, 'Dragão'],
  [/\bDragoes\b/g, 'Dragões'],
  [/\bEscuridao\b/g, 'Escuridão'],
  [/\bSolidao\b/g, 'Solidão'],
  [/\bIlusao\b/g, 'Ilusão'],
  [/\bIlusoes\b/g, 'Ilusões'],
  [/\bExplosao\b/g, 'Explosão'],
  [/\bExplosoes\b/g, 'Explosões'],
  [/\bDimensao\b/g, 'Dimensão'],
  [/\bDimensoes\b/g, 'Dimensões'],
  [/\bExtincao\b/g, 'Extinção'],
  [/\bConexao\b/g, 'Conexão'],
  [/\bConexoes\b/g, 'Conexões'],
  [/\bMansao\b/g, 'Mansão'],
  [/\bVisao\b/g, 'Visão'],
  [/\bVisoes\b/g, 'Visões'],
  [/\bConfusao\b/g, 'Confusão'],
  [/\bConclusao\b/g, 'Conclusão'],
  [/\bDecisao\b/g, 'Decisão'],
  [/\bOcasiao\b/g, 'Ocasião'],
  [/\bPermissao\b/g, 'Permissão'],
  [/\bProfissao\b/g, 'Profissão'],
  [/\bEmocao\b/g, 'Emoção'],
  [/\bEmocoes\b/g, 'Emoções'],

  // --- Words with à ---
  [/\bAs vezes\b/g, 'Às vezes'],

  // --- Unicode replacement character (U+FFFD) ---
  // In Panini titles this is almost always an em-dash (–) used as separator
  // e.g. "Parte 7 � Steel Ball Run" → "Parte 7 – Steel Ball Run"
  [/\uFFFD/g, '–'],
];

// Fields to process on CatalogEntry
const CATALOG_FIELDS = ['title', 'description', 'publisher', 'imprint', 'author'] as const;
type CatalogField = (typeof CATALOG_FIELDS)[number];

// Fields to process on Series
const SERIES_FIELDS = ['title', 'description'] as const;
type SeriesField = (typeof SERIES_FIELDS)[number];

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

interface ChangeRecord {
  id: string;
  table: string;
  field: string;
  before: string;
  after: string;
}

function applyReplacements(text: string): string {
  let result = text;
  for (const [pattern, replacement] of WORD_REPLACEMENTS) {
    // Reset lastIndex for global regexps
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

async function processCatalogEntries(): Promise<ChangeRecord[]> {
  const changes: ChangeRecord[] = [];

  const fieldsToProcess: CatalogField[] = FIELD_FILTER
    ? (CATALOG_FIELDS.filter((f) => f === FIELD_FILTER) as CatalogField[])
    : [...CATALOG_FIELDS];

  if (fieldsToProcess.length === 0 && FIELD_FILTER) {
    console.log(`  Field "${FIELD_FILTER}" is not a catalog_entries field, skipping.`);
    return changes;
  }

  // Count total
  const totalCount = await prisma.catalogEntry.count();
  console.log(`  Total catalog entries: ${totalCount}`);

  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.catalogEntry.findMany({
      select: { id: true, title: true, description: true, publisher: true, imprint: true, author: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const entry of batch) {
      const updates: Partial<Record<CatalogField, string>> = {};

      for (const field of fieldsToProcess) {
        const value = entry[field];
        if (typeof value !== 'string' || value.length === 0) continue;

        const fixed = applyReplacements(value);
        if (fixed !== value) {
          updates[field] = fixed;
          changes.push({
            id: entry.id,
            table: 'catalog_entries',
            field,
            before: value.length > 120 ? value.substring(0, 120) + '...' : value,
            after: fixed.length > 120 ? fixed.substring(0, 120) + '...' : fixed,
          });
        }
      }

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: updates,
        });
      }
    }

    processed += batch.length;
    cursor = batch[batch.length - 1].id;

    if (processed % 500 === 0 || processed === totalCount) {
      process.stdout.write(`\r  Processed ${processed}/${totalCount} catalog entries...`);
    }

    if (LIMIT > 0 && processed >= LIMIT) break;
  }

  console.log(`\r  Processed ${processed}/${totalCount} catalog entries.          `);
  return changes;
}

async function processSeriesEntries(): Promise<ChangeRecord[]> {
  const changes: ChangeRecord[] = [];

  // If a specific catalog field was requested that doesn't apply to series, skip
  if (FIELD_FILTER && !SERIES_FIELDS.includes(FIELD_FILTER as SeriesField)) {
    return changes;
  }

  const fieldsToProcess: SeriesField[] = FIELD_FILTER
    ? (SERIES_FIELDS.filter((f) => f === FIELD_FILTER) as SeriesField[])
    : [...SERIES_FIELDS];

  const totalCount = await prisma.series.count();
  console.log(`  Total series: ${totalCount}`);

  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.series.findMany({
      select: { id: true, title: true, description: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const entry of batch) {
      const updates: Partial<Record<SeriesField, string>> = {};

      for (const field of fieldsToProcess) {
        const value = entry[field];
        if (typeof value !== 'string' || value.length === 0) continue;

        const fixed = applyReplacements(value);
        if (fixed !== value) {
          updates[field] = fixed;
          changes.push({
            id: entry.id,
            table: 'series',
            field,
            before: value.length > 120 ? value.substring(0, 120) + '...' : value,
            after: fixed.length > 120 ? fixed.substring(0, 120) + '...' : fixed,
          });
        }
      }

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        await prisma.series.update({
          where: { id: entry.id },
          data: updates,
        });
      }
    }

    processed += batch.length;
    cursor = batch[batch.length - 1].id;
  }

  console.log(`  Processed ${processed}/${totalCount} series.`);
  return changes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Fix Portuguese Accents ===`);
  console.log(`  Mode:       ${DRY_RUN ? 'DRY RUN (no changes will be saved)' : 'LIVE (changes will be applied)'}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Limit:      ${LIMIT || 'none'}`);
  console.log(`  Field:      ${FIELD_FILTER || 'all'}`);
  console.log(`  Rules:      ${WORD_REPLACEMENTS.length} replacement patterns loaded`);
  console.log('');

  const allChanges: ChangeRecord[] = [];

  // --- Catalog Entries ---
  console.log('[1/2] Processing catalog_entries...');
  const catalogChanges = await processCatalogEntries();
  allChanges.push(...catalogChanges);

  // --- Series ---
  console.log('[2/2] Processing series...');
  const seriesChanges = await processSeriesEntries();
  allChanges.push(...seriesChanges);

  // --- Summary ---
  console.log('\n=== Summary ===');
  console.log(`  Total records scanned: catalog_entries + series`);
  console.log(`  Total fields with changes: ${allChanges.length}`);

  if (allChanges.length > 0) {
    // Group by table and field
    const byTableField = new Map<string, number>();
    for (const c of allChanges) {
      const key = `${c.table}.${c.field}`;
      byTableField.set(key, (byTableField.get(key) || 0) + 1);
    }

    console.log('\n  Changes by table.field:');
    for (const [key, count] of [...byTableField.entries()].sort()) {
      console.log(`    ${key}: ${count}`);
    }

    // Show sample changes (up to 30)
    const samplesToShow = Math.min(allChanges.length, 30);
    console.log(`\n  Sample changes (showing ${samplesToShow} of ${allChanges.length}):`);
    for (let i = 0; i < samplesToShow; i++) {
      const c = allChanges[i];
      console.log(`    [${c.table}.${c.field}] id=${c.id}`);
      console.log(`      - ${c.before}`);
      console.log(`      + ${c.after}`);
    }
    if (allChanges.length > samplesToShow) {
      console.log(`    ... and ${allChanges.length - samplesToShow} more changes`);
    }
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN complete. No changes were saved to the database.');
    console.log('  Run without --dry-run to apply changes.');
  } else {
    console.log(`\n  DONE. ${allChanges.length} field(s) updated in the database.`);
  }

  console.log('');
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
