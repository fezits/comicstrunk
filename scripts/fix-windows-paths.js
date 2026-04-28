// Pos-build: normaliza TODOS os paths absolutos Windows nos artefatos
// gerados pelo `next build` no Windows. Sem isso, o deploy Linux quebra
// porque o React Server Components manifest e o webpack module registry
// fazem lookup pelo path baked no bundle, que vira "D:\\Projetos\\..." no
// Windows e nao resolve em /home/.../comicstrunk.com no servidor.
//
// Estrategia: substituir CONSISTENTEMENTE em TODOS os arquivos relevantes
// (manifests + page.js + chunks) o prefixo Windows pelo mesmo prefixo
// sintetico, convertendo backslashes em forward slashes. O lookup eh
// puramente match de string, entao basta as duas pontas usarem a mesma
// forma — o caminho nao precisa existir fisicamente.
//
// Roda APOS fix-standalone.js. Idempotente (rodar 2x nao quebra).

const fs = require('fs');
const path = require('path');

const STANDALONE = path.join(__dirname, '..', 'apps', 'web', '.next', 'standalone');

// Forma canonica que substitui o prefixo Windows. Pode ser qualquer string;
// o que importa eh ser usada nos DOIS lados da match (manifest + module id).
const CANONICAL_PREFIX = '/comicstrunk';

// Pega `D:\\Projetos\\comicstrunk\\...` (com escape JSON) ate o proximo
// delimitador (aspa, espaco, virgula). Inclui paths COM e SEM extensao —
// alguns campos do Next (entryCSSFiles, entryFiles) usam o caminho do
// modulo sem .js no final.
// Para nos delimitadores reais que separam strings JS/JSON: aspas, virgula,
// espaco em branco. Inclui "#" pq Next usa "<path>#<export>" como chave
// (ex: NextIntlClientProvider.js#default). NAO inclui ":" porque "D:" eh o
// proprio prefixo do drive Windows.
const WIN_PATH_RE = /D:\\\\Projetos\\\\comicstrunk\\\\([^"'`\s,]*)/g;

function transformWinToCanonical(_match, capturedRest) {
  const linuxRest = capturedRest.replace(/\\\\/g, '/');
  return `${CANONICAL_PREFIX}/${linuxRest}`;
}

function patchFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const next = content.replace(WIN_PATH_RE, transformWinToCanonical);
  if (next === content) return false;
  fs.writeFileSync(file, next);
  return true;
}

function walk(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Pula caches que nao vao pra producao
      if (entry.name === 'cache' || entry.name === 'trace') continue;
      count += walk(full);
    } else if (
      entry.name.endsWith('.js') ||
      entry.name.endsWith('.json') ||
      entry.name.endsWith('.mjs') ||
      entry.name.endsWith('.cjs')
    ) {
      try {
        if (patchFile(full)) count++;
      } catch (e) {
        console.warn(`falhou em ${full}: ${e.message}`);
      }
    }
  }
  return count;
}

if (!fs.existsSync(STANDALONE)) {
  console.error(`standalone nao encontrado em ${STANDALONE}`);
  console.error('Rode `next build` + `node scripts/fix-standalone.js` antes deste script.');
  process.exit(1);
}

// Walk no .next/ inteiro do standalone — walk() ja pula cache/ e trace/
const NEXT_DIR = path.join(STANDALONE, 'apps', 'web', '.next');
const total = fs.existsSync(NEXT_DIR) ? walk(NEXT_DIR) : 0;

console.log(`fix-windows-paths: ${total} arquivos com paths Windows normalizados.`);
