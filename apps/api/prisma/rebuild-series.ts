/**
 * Rebuild series from catalog entry titles.
 * Extracts real series names by stripping edition numbers, volume indicators,
 * special edition suffixes, etc.
 * 
 * Derives: name, publisher, startYear, endYear, totalEditions
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractSeriesName(title: string): string {
  let cleaned = title
    // Remove edition numbers: # 01, # 123, #01
    .replace(/\s*#\s*\d+.*$/, '')
    // Remove Vol. X, Vol X
    .replace(/\s*Vol\.?\s*\d+.*$/i, '')
    // Remove Nº XX, n° XX, nº XX
    .replace(/\s*[Nn][ºo°]\s*\d+.*$/, '')
    // Remove "- COM O BRINDE ORIGINAL" and similar suffixes
    .replace(/\s*-\s*COM O BRINDE.*$/i, '')
    .replace(/\s*-\s*AUTOGRAFADO.*$/i, '')
    .replace(/\s*-\s*CAPA VARIANTE.*$/i, '')
    .replace(/\s*-\s*Edi[çc][ãa]o\s*(Especial|Limitada|de Luxo|Definitiva|de Colecionador).*$/i, '')
    // Remove trailing parenthetical info like (2024), (Capa Dura)
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s*\(Capa\s.*\)\s*$/i, '')
    // Trim trailing dashes and spaces
    .replace(/[\s-]+$/, '')
    .trim();
  
  return cleaned;
}

function parseYear(pubDate: string | null | undefined): number | null {
  if (!pubDate) return null;
  // Format: "M/YYYY" or "MM/YYYY" or just "YYYY"
  const match = pubDate.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

interface SeriesData {
  name: string;
  publisher: string | null;
  startYear: number | null;
  endYear: number | null;
  count: number;
  entryIds: string[];
}

async function main() {
  console.log('=== Rebuild Series from Titles ===\n');

  // Fetch all catalog entries
  const entries = await prisma.catalogEntry.findMany({
    select: {
      id: true,
      title: true,
      publisher: true,
      publishYear: true,
      publishMonth: true,
      barcode: true,
    },
    where: { approvalStatus: 'APPROVED' },
  });
  console.log(`Total entries: ${entries.length}`);

  // Group by extracted series name + publisher
  const seriesMap = new Map<string, SeriesData>();

  for (const entry of entries) {
    const seriesName = extractSeriesName(entry.title);
    if (seriesName.length < 3) continue;

    // Key by name + publisher to distinguish same-name series from different publishers
    const publisher = entry.publisher || 'Unknown';
    const key = `${seriesName}|||${publisher}`;

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        name: seriesName,
        publisher,
        startYear: null,
        endYear: null,
        count: 0,
        entryIds: [],
      });
    }

    const series = seriesMap.get(key)!;
    series.count++;
    series.entryIds.push(entry.id);

    const year = entry.publishYear;
    if (year) {
      if (!series.startYear || year < series.startYear) series.startYear = year;
      if (!series.endYear || year > series.endYear) series.endYear = year;
    }
  }

  console.log(`Unique series extracted: ${seriesMap.size}`);

  // Filter: keep series with 2+ editions (single entries are probably standalone)
  const validSeries = Array.from(seriesMap.values()).filter(s => s.count >= 2);
  const standaloneSeries = Array.from(seriesMap.values()).filter(s => s.count === 1);
  console.log(`Series with 2+ editions: ${validSeries.length}`);
  console.log(`Standalone entries (1 edition): ${standaloneSeries.length}`);

  // Sort by count descending
  validSeries.sort((a, b) => b.count - a.count);

  // Show top 30
  console.log('\nTop 30 series:');
  validSeries.slice(0, 30).forEach(s => {
    const years = s.startYear ? `${s.startYear}-${s.endYear}` : '?';
    console.log(`  ${s.count}\t${years}\t${s.publisher}\t${s.name}`);
  });

  // Delete old series associations and series
  console.log('\n--- Cleaning old series ---');
  
  // First, unlink all entries from old series
  const unlinked = await prisma.catalogEntry.updateMany({
    where: { seriesId: { not: null } },
    data: { seriesId: null },
  });
  console.log(`Unlinked ${unlinked.count} entries from old series`);

  // Delete old series
  const deleted = await prisma.series.deleteMany({});
  console.log(`Deleted ${deleted.count} old series`);

  // Create new series and link entries
  console.log('\n--- Creating new series ---');
  let created = 0;
  let linked = 0;

  for (let i = 0; i < validSeries.length; i++) {
    const s = validSeries[i];
    
    // Build description with publisher and years
    const parts: string[] = [];
    if (s.publisher && s.publisher !== 'Unknown') parts.push(`Editora: ${s.publisher}`);
    if (s.startYear) {
      parts.push(s.startYear === s.endYear ? `Ano: ${s.startYear}` : `Período: ${s.startYear}-${s.endYear}`);
    }
    parts.push(`${s.count} edições`);

    const series = await prisma.series.create({
      data: {
        title: s.publisher && s.publisher !== 'Unknown' 
          ? `${s.name} (${s.publisher})`
          : s.name,
        description: parts.join(' • '),
        totalEditions: s.count,
      },
    });
    created++;

    // Link entries to this series in batches
    for (let j = 0; j < s.entryIds.length; j += 200) {
      const batch = s.entryIds.slice(j, j + 200);
      await prisma.catalogEntry.updateMany({
        where: { id: { in: batch } },
        data: { seriesId: series.id },
      });
      linked += batch.length;
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  Progress: ${i + 1}/${validSeries.length} series, ${linked} entries linked`);
    }
  }

  // For standalone entries, create individual series only if title is long enough
  console.log('\n--- Creating standalone series ---');
  let standaloneCreated = 0;
  for (const s of standaloneSeries) {
    if (s.name.length < 10) continue; // Skip very short names
    
    const parts: string[] = [];
    if (s.publisher && s.publisher !== 'Unknown') parts.push(`Editora: ${s.publisher}`);
    if (s.startYear) parts.push(`Ano: ${s.startYear}`);
    parts.push('1 edição');

    const series = await prisma.series.create({
      data: {
        title: s.publisher && s.publisher !== 'Unknown'
          ? `${s.name} (${s.publisher})`
          : s.name,
        description: parts.join(' • '),
        totalEditions: 1,
      },
    });
    
    await prisma.catalogEntry.updateMany({
      where: { id: { in: s.entryIds } },
      data: { seriesId: series.id },
    });
    standaloneCreated++;
    linked += s.entryIds.length;
  }

  console.log(`\n=== DONE ===`);
  console.log(`Series created: ${created} (multi-edition) + ${standaloneCreated} (standalone) = ${created + standaloneCreated}`);
  console.log(`Entries linked: ${linked}`);
  console.log(`Entries without series: ${entries.length - linked}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
