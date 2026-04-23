// Fetch DC and Marvel comics from Grand Comics Database (GCD) API
// GCD is a free, public comic database - https://www.comics.org/api/
// Focus on classic/important series and recent issues

const fs = require('fs');
const path = require('path');

const DELAY_MS = 1500;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Key series to fetch (GCD series IDs found via search)
const SERIES_TO_FETCH = [
  // DC Classics & Key series
  { name: 'Detective Comics', publisher: 'DC Comics', searchName: 'detective comics', gcdPublisher: 'dc' },
  { name: 'Action Comics', publisher: 'DC Comics', searchName: 'action comics', gcdPublisher: 'dc' },
  { name: 'Batman', publisher: 'DC Comics', searchName: 'batman', gcdPublisher: 'dc' },
  { name: 'Superman', publisher: 'DC Comics', searchName: 'superman', gcdPublisher: 'dc' },
  { name: 'Wonder Woman', publisher: 'DC Comics', searchName: 'wonder woman', gcdPublisher: 'dc' },
  { name: 'Justice League', publisher: 'DC Comics', searchName: 'justice league', gcdPublisher: 'dc' },
  { name: 'The Flash', publisher: 'DC Comics', searchName: 'the flash', gcdPublisher: 'dc' },
  { name: 'Green Lantern', publisher: 'DC Comics', searchName: 'green lantern', gcdPublisher: 'dc' },
  { name: 'Aquaman', publisher: 'DC Comics', searchName: 'aquaman', gcdPublisher: 'dc' },
  { name: 'Swamp Thing', publisher: 'DC Comics', searchName: 'swamp thing', gcdPublisher: 'dc' },
  { name: 'Sandman', publisher: 'DC Comics', searchName: 'sandman', gcdPublisher: 'dc' },
  // Marvel Classics & Key series
  { name: 'Amazing Spider-Man', publisher: 'Marvel Comics', searchName: 'amazing spider-man', gcdPublisher: 'marvel' },
  { name: 'Uncanny X-Men', publisher: 'Marvel Comics', searchName: 'uncanny x-men', gcdPublisher: 'marvel' },
  { name: 'Avengers', publisher: 'Marvel Comics', searchName: 'avengers', gcdPublisher: 'marvel' },
  { name: 'Fantastic Four', publisher: 'Marvel Comics', searchName: 'fantastic four', gcdPublisher: 'marvel' },
  { name: 'Incredible Hulk', publisher: 'Marvel Comics', searchName: 'incredible hulk', gcdPublisher: 'marvel' },
  { name: 'Iron Man', publisher: 'Marvel Comics', searchName: 'iron man', gcdPublisher: 'marvel' },
  { name: 'Captain America', publisher: 'Marvel Comics', searchName: 'captain america', gcdPublisher: 'marvel' },
  { name: 'Thor', publisher: 'Marvel Comics', searchName: 'thor', gcdPublisher: 'marvel' },
  { name: 'Daredevil', publisher: 'Marvel Comics', searchName: 'daredevil', gcdPublisher: 'marvel' },
  { name: 'Wolverine', publisher: 'Marvel Comics', searchName: 'wolverine', gcdPublisher: 'marvel' },
];

// Key TPBs/GNs to search for individually
const KEY_TITLES = [
  'Batman Year One',
  'Batman The Long Halloween',
  'Batman Dark Victory',
  'Batman Hush',
  'Batman The Killing Joke',
  'Superman Year One',
  'Superman All Seasons',
  'Batman All Seasons',
  'Watchmen',
  'V for Vendetta',
  'The Dark Knight Returns',
  'Kingdom Come',
  'Crisis on Infinite Earths',
  'Marvels',
  'Spider-Man Blue',
  'Daredevil Born Again',
  'X-Men Dark Phoenix Saga',
  'Infinity Gauntlet',
  'Civil War Marvel',
  'House of M',
];

async function searchGCD(query, limit = 10) {
  const url = `https://www.comics.org/api/issue/?series_name=${encodeURIComponent(query)}&format=json&page_size=${limit}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function searchGCDSeries(query, limit = 5) {
  const url = `https://www.comics.org/api/series/?name=${encodeURIComponent(query)}&format=json&page_size=${limit}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function getSeriesIssues(seriesUrl, limit = 50) {
  try {
    const url = seriesUrl + '?format=json';
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const data = await resp.json();

    // Get issues
    const issuesUrl = data.active_issues?.[0]?.replace(/\d+\//, '') || null;
    if (!issuesUrl) return null;

    // Fetch issues list
    const baseUrl = seriesUrl.replace(/\/\d+\/$/, '/');
    const issueListUrl = `https://www.comics.org/api/issue/?series_name=${encodeURIComponent(data.name)}&format=json&page_size=${limit}`;
    const issueResp = await fetch(issueListUrl, { signal: AbortSignal.timeout(15000) });
    if (!issueResp.ok) return null;
    const issueData = await issueResp.json();

    return {
      seriesName: data.name,
      publisher: data.publisher_name || '',
      yearBegan: data.year_began,
      yearEnded: data.year_ended,
      issueCount: data.issue_count,
      issues: issueData.results || [],
    };
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== DC/MARVEL GCD FETCH ===\n');
  const allIssues = [];

  // 1. Search for key TPBs/GNs
  console.log('--- Key Titles ---');
  for (const title of KEY_TITLES) {
    process.stdout.write(title + '... ');
    const results = await searchGCDSeries(title, 3);

    if (results.length > 0) {
      const series = results[0];
      console.log('Found: ' + series.name + ' (' + (series.year_began || '?') + ')');
      allIssues.push({
        title: series.name,
        publisher: series.publisher_name || 'DC Comics',
        publishYear: series.year_began || null,
        sourceKey: 'gcd:series:' + (series.api_url?.match(/\/(\d+)\//)?.[1] || ''),
        coverImageUrl: '',
        description: '',
        pageCount: null,
        publishMonth: null,
      });
    } else {
      console.log('NOT FOUND');
    }
    await sleep(DELAY_MS);
  }

  // 2. Search for recent issues (2023-2026)
  console.log('\n--- Recent DC/Marvel Issues ---');
  const recentSearches = [
    'batman 2024', 'batman 2025', 'batman 2026',
    'superman 2024', 'superman 2025',
    'detective comics 2024', 'detective comics 2025',
    'action comics 2024', 'action comics 2025',
    'amazing spider-man 2024', 'amazing spider-man 2025',
    'x-men 2024', 'x-men 2025',
    'avengers 2024', 'avengers 2025',
    'wonder woman 2024', 'wonder woman 2025',
  ];

  for (const search of recentSearches) {
    process.stdout.write(search + '... ');
    const results = await searchGCD(search, 20);
    const filtered = results.filter(r => {
      const name = (r.series_name || '').toLowerCase();
      const searchBase = search.replace(/ \d{4}$/, '').toLowerCase();
      return name.includes(searchBase);
    });
    console.log(filtered.length + ' issues');

    for (const issue of filtered) {
      allIssues.push({
        title: (issue.series_name || '') + ' #' + (issue.number || ''),
        publisher: issue.publisher_name || '',
        publishYear: issue.cover_date ? parseInt(issue.cover_date.split('-')[0]) : null,
        publishMonth: issue.cover_date ? parseInt(issue.cover_date.split('-')[1]) : null,
        sourceKey: 'gcd:issue:' + (issue.api_url?.match(/\/(\d+)\//)?.[1] || ''),
        coverImageUrl: '',
        description: (issue.notes || '').slice(0, 300),
        pageCount: issue.page_count ? parseInt(issue.page_count) : null,
      });
    }
    await sleep(DELAY_MS);
  }

  // Deduplicate
  const seen = new Set();
  const unique = allIssues.filter(i => {
    const key = i.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('\n=== RESULTS ===');
  console.log('Total unique: ' + unique.length);

  const outputPath = path.join(__dirname, '..', 'docs', 'dc-marvel-gcd.json');
  fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2));
  console.log('Saved to: docs/dc-marvel-gcd.json');

  // Stats
  const byPub = {};
  unique.forEach(i => { byPub[i.publisher] = (byPub[i.publisher] || 0) + 1; });
  console.log('\nBy publisher:');
  Object.entries(byPub).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => console.log('  ' + p + ': ' + c));
}

run().catch(e => console.error(e));
