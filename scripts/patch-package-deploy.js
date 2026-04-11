const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const outFile = process.argv[3];

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'));
pkg.dependencies['@comicstrunk/contracts'] = 'file:./contracts.tgz';
// prisma CLI necessário para `prisma generate` no servidor
if (pkg.devDependencies && pkg.devDependencies['prisma']) {
  pkg.dependencies['prisma'] = pkg.devDependencies['prisma'];
}
fs.writeFileSync(outFile, JSON.stringify(pkg, null, 2));
console.log('OK');
