// Substitui paths absolutos Windows nos *_client-reference-manifest.js do
// build standalone do Next.js por paths Linux equivalentes do servidor.
//
// O Next 15 grava `D:\\Projetos\\comicstrunk\\node_modules\\...` como chave
// no React Client Manifest. No deploy Linux, Node nao consegue resolver
// essas chaves e a pagina explode com:
//   "Could not find the module ... in the React Client Manifest"
//
// Fix: troca o prefixo Windows por /home/.../comicstrunk.com/ e converte
// backslashes restantes em forward slashes apenas nas chaves que comecavam
// por D:\\Projetos\\comicstrunk\\.

const fs = require('fs');
const path = require('path');

const STANDALONE = path.join(__dirname, '..', 'apps', 'web', '.next', 'standalone');
const PROD_PREFIX = '/home/ferna5257/applications/comicstrunk.com';

// Padroes a substituir. Ordem importa: prefixo primeiro (com escape JSON
// duplo) e dentro do match desfaz os \\ remanescentes.
const WIN_PREFIX_ESCAPED = 'D:\\\\Projetos\\\\comicstrunk\\\\';

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes(WIN_PREFIX_ESCAPED)) return false;

  // Substituicao em duas fases:
  // 1) cada caminho Windows comeca por "D:\\Projetos\\comicstrunk\\..."
  //    e termina em uma string ".js" (ou .json). Match completo para nao
  //    pegar "\\\\" fora desses caminhos.
  // 2) dentro do match, troca \\\\ por / e converte o prefixo.
  content = content.replace(
    /D:\\\\Projetos\\\\comicstrunk\\\\[^"']*?\.(?:js|json)/g,
    (m) => {
      const linuxRest = m
        .slice(WIN_PREFIX_ESCAPED.length)
        .replace(/\\\\/g, '/');
      return `${PROD_PREFIX}/${linuxRest}`;
    },
  );

  fs.writeFileSync(file, content);
  return true;
}

function walk(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += walk(full);
    } else if (
      entry.name.endsWith('client-reference-manifest.js') ||
      entry.name === 'middleware-manifest.json' ||
      entry.name === 'next-font-manifest.js'
    ) {
      if (patchFile(full)) count++;
    }
  }
  return count;
}

if (!fs.existsSync(STANDALONE)) {
  console.error(`standalone nao encontrado em ${STANDALONE}`);
  process.exit(1);
}

const total = walk(path.join(STANDALONE, 'apps', 'web', '.next', 'server'));
console.log(`fix-manifest-paths: ${total} arquivos patchados`);
