const fs = require('fs');
const f = '/home/ferna5257/applications/api.comicstrunk.com/scripts/fetch-missing-covers.ts';
let c = fs.readFileSync(f, 'utf8');

// Replace the CloudFront regex with a simpler version that doesn't use quotes in character class
c = c.replace(
  /html\.match\(\/https\?.*?cloudfront.*?S897.*?\*\/\)/g,
  'html.match(/https?:\\/\\/d14d9vp3wdof84\\.cloudfront\\.net\\/image\\/\\S+-S897\\S*/)'
);

c = c.replace(
  /html\.match\(\/https\?.*?cloudfront.*?\\s\]\+\/\)/g,
  'html.match(/https?:\\/\\/d14d9vp3wdof84\\.cloudfront\\.net\\/image\\/\\S+/)'
);

fs.writeFileSync(f, c);

// Verify
const after = fs.readFileSync(f, 'utf8');
const matches = after.match(/cloudfront.*match/g);
console.log('Regex occurrences:', matches?.length || 0);
matches?.forEach(m => console.log(' ', m.substring(0, 60)));
console.log('Done');
