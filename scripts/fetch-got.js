async function run() {
  const resp = await fetch('https://www.rika.com.br/api/catalog_system/pub/products/search?ft=guerra+dos+tronos&_from=0&_to=49');
  const data = await resp.json();
  const hqs = data.filter(p => p.productName.startsWith('Guerra dos Tronos - Volume'));

  console.log('Found ' + hqs.length + ' HQ volumes:\n');

  const entries = [];
  for (const p of hqs) {
    const sku = p.items[0];
    const img = sku.images[0] ? sku.images[0].imageUrl.split('?')[0] : 'NONE';
    const desc = (p.description || '').replace(/<[^>]*>/g, '').trim();
    const dateMatch = desc.match(/publica..o:\s*(\d+)\/(\d+)/);
    const pageMatch = desc.match(/(\d+)\s*p.ginas/);

    const entry = {
      id: p.productId,
      title: p.productName,
      publisher: p.brand,
      year: dateMatch ? parseInt(dateMatch[2]) : null,
      month: dateMatch ? parseInt(dateMatch[1]) : null,
      pages: pageMatch ? parseInt(pageMatch[1]) : null,
      img: img,
      sourceKey: 'rika:' + p.productId,
    };
    entries.push(entry);

    console.log(entry.title);
    console.log('  Publisher: ' + entry.publisher);
    console.log('  Date: ' + (entry.year ? entry.month + '/' + entry.year : 'N/A'));
    console.log('  Pages: ' + (entry.pages || 'N/A'));
    console.log('  Image: ' + entry.img);
    console.log('  SourceKey: ' + entry.sourceKey);
    console.log('');
  }

  // Check for duplicates
  const sourceKeys = entries.map(e => e.sourceKey);
  console.log('Checking duplicates in production...');
  const checkResp = await fetch('https://api.comicstrunk.com/api/v1/catalog?title=Guerra+dos+Tronos&limit=10');
  const existing = await checkResp.json();
  console.log('Existing in catalog with "Guerra dos Tronos": ' + existing.pagination.total);
}

run().catch(e => console.error(e));
