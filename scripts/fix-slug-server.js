const fs = require('fs');
const f = '/home/ferna5257/applications/api.comicstrunk.com/scripts/fetch-missing-covers.ts';
let c = fs.readFileSync(f, 'utf8');

// Remove broken lines from previous sed attempts
c = c.replace(/\s*\.replace\(\/Fffd\/g.*\n/g, '\n');

// Replace the titleToSlug function entirely
const oldFunc = /function titleToSlug\(title: string\): string \{[\s\S]*?collapse multiple hyphens\n\}/;
const newFunc = `function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '') // remove accents
    .replace(/\\ufffd/g, '')            // remove replacement character
    .replace(/['\\'\\x60]/g, '')         // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')      // non-alphanumeric to hyphen
    .replace(/^-|-$/g, '')            // trim hyphens
    .replace(/-+/g, '-');             // collapse multiple hyphens
}`;

c = c.replace(oldFunc, newFunc);
fs.writeFileSync(f, c);
console.log('Fixed titleToSlug');
