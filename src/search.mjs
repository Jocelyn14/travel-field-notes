function wikipediaUrl(language, query) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'extracts|coordinates|pageimages',
    exintro: '1',
    explaintext: '1',
    piprop: 'original|thumbnail',
    pithumbsize: '960',
  });
  return url;
}

async function reverseGeocode(coordinates, fetcher) {
  if (!coordinates) return '';
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coordinates.lat),
    lon: String(coordinates.lon),
    zoom: '18',
    'accept-language': 'zh-CN,zh,en',
  });
  try {
    const response = await fetcher(url);
    if (!response.ok) return '';
    const result = await response.json();
    return result.display_name ?? '';
  } catch {
    return '';
  }
}

async function searchLanguage(language, query, fetcher) {
  const response = await fetcher(wikipediaUrl(language, query));
  if (!response.ok) throw new Error(`Wikipedia ${language} HTTP ${response.status}`);
  const data = await response.json();
  return Object.values(data.query?.pages ?? {})[0] ?? null;
}

export function summarizeExtract(value, maxLength = 50) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const sentenceEnd = [...text].findIndex((character) => '。！？.!?'.includes(character));
  if (sentenceEnd >= 0 && sentenceEnd + 1 <= maxLength) return text.slice(0, sentenceEnd + 1);
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
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
  const address = await reverseGeocode(coordinates, fetcher);
  const mapQuery = coordinates ? `${coordinates.lat},${coordinates.lon}` : primary.title;
  const maps = new URL('https://www.google.com/maps/search/');
  maps.search = new URLSearchParams({ api: '1', query: mapQuery });
  const imagePage = zh?.original || zh?.thumbnail ? zh : local?.original || local?.thumbnail ? local : en;
  const imageLanguage = imagePage === zh ? 'zh' : imagePage === local ? localLanguage : 'en';
  const image = imagePage?.original?.source ?? imagePage?.thumbnail?.source ?? '';

  return {
    name: zh?.title ?? primary.title,
    nameEn: en?.title ?? primary.title,
    nameLocal: local?.title ?? primary.title,
    note: summarizeExtract(zh?.extract ?? en?.extract ?? local?.extract ?? ''),
    address: address || (coordinates ? `${coordinates.lat.toFixed(5)}, ${coordinates.lon.toFixed(5)}` : primary.title),
    maps: maps.href,
    image,
    imageSource: imagePage ? `https://${imageLanguage}.wikipedia.org/wiki/${encodeURIComponent(imagePage.title.replaceAll(' ', '_'))}` : '',
  };
}
