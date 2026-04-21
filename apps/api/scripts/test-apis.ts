async function main() {
  // Test Rika VTEX API
  try {
    const r = await fetch(
      "https://www.rika.com.br/api/catalog_system/pub/products/search/Super-herois?_from=0&_to=1&O=OrderByReleaseDateDESC",
      { signal: AbortSignal.timeout(15000) }
    );
    console.log("Rika status:", r.status);
    console.log("Rika total:", r.headers.get("resources"));
    const data = await r.json();
    console.log("Rika sample:", data[0]?.productName?.substring(0, 60));
  } catch (e: any) {
    console.log("Rika error:", e.message);
  }

  // Test Panini GraphQL API
  try {
    const query = `{ products(search: "marvel", pageSize: 1, currentPage: 1) { total_count items { name sku } } }`;
    const p = await fetch("https://panini.com.br/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Store: "default" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });
    console.log("Panini status:", p.status);
    const pd = await p.json();
    console.log("Panini total:", pd.data?.products?.total_count);
    console.log("Panini sample:", pd.data?.products?.items?.[0]?.name?.substring(0, 60));
  } catch (e: any) {
    console.log("Panini error:", e.message);
  }
}
main();
