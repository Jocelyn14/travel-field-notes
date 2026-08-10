function wikipediaUrl(language, query) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'extracts|coordinates',
    exintro: '1',
    explaintext: '1',
  });
  return url;
}

async function searchLanguage(language, query, fetcher) {
  const response = await fetcher(wikipediaUrl(language, query));
  if (!response.ok) throw new Error(`Wikipedia ${language} HTTP ${response.status}`);
  const data = await response.json();
  return Object.values(data.query?.pages ?? {})[0] ?? null;
}

export async function searchPlace(query, tripId, fetcher = fetch) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) throw new Error('请输入要搜索的景点或地点');
  const localLanguage = tripId === 'italy' ? 'it' : 'ja';
  const [zh, en, local] = await Promise.all([
    searchLanguage('zh', normalizedQuery, fetcher),
    searchLanguage('en', normalizedQuery, fetcher),
    searchLanguage(localLanguage, normalizedQuery, fetcher),
  ]);
  const primary = zh ?? local ?? en;
  if (!primary) throw new Error(`没有找到“${normalizedQuery}”，请换一个关键词或手动填写`);
  const coordinates = primary.coordinates?.[0] ?? en?.coordinates?.[0] ?? local?.coordinates?.[0];
  const mapQuery = coordinates ? `${coordinates.lat},${coordinates.lon}` : primary.title;
  const maps = new URL('https://www.google.com/maps/search/');
  maps.search = new URLSearchParams({ api: '1', query: mapQuery });

  return {
    name: zh?.title ?? primary.title,
    nameEn: en?.title ?? primary.title,
    nameLocal: local?.title ?? primary.title,
    note: zh?.extract ?? en?.extract ?? local?.extract ?? '',
    address: coordinates ? `${coordinates.lat.toFixed(5)}, ${coordinates.lon.toFixed(5)}` : primary.title,
    maps: maps.href,
  };
}
