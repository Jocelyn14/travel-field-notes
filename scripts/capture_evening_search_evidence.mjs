import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sources = await readJson(join(root, 'scripts', 'evening-media-sources.json'));
const catalog = await readJson(join(root, 'scripts', 'evening-media-catalog.json'));
const contentDecisions = await readJson(join(root, 'scripts', 'evening-media-content-decisions.json'));
const outputPath = join(root, 'scripts', 'evening-media-search-evidence.json');
const partialPath = join(root, 'scripts', '.evening-media-search-evidence.partial.json');
const previousReport = await readJson(outputPath);
const previousById = new Map(previousReport.rows.map((row) => [row.id, row]));
const illustrationIds = new Set(catalog.filter((item) => item.kind === 'illustration').map((item) => item.id));
for (const decision of contentDecisions) {
  if (decision.decision === 'needs-illustration') illustrationIds.add(decision.id);
}
const targets = sources.filter((item) => illustrationIds.has(item.id));
const maxAttempts = 1;

if (targets.length !== illustrationIds.size) throw new Error('Illustration catalog and source decisions do not align');

const requestWithCurl = (url, maxTimeSeconds = 30) => new Promise((resolve) => {
  const requestedAt = new Date().toISOString();
  const child = spawn('curl.exe', [
    '--silent',
    '--show-error',
    '--location',
    '--connect-timeout', '10',
    '--max-time', String(maxTimeSeconds),
    '--user-agent', 'TravelAtlasMediaAudit/1.0 (venue search evidence)',
    '--write-out', '\n__HTTP_STATUS__:%{http_code}',
    url,
  ], { windowsHide: true });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  child.on('error', (error) => resolve({
    requestedAt,
    httpStatus: 0,
    outcome: 'transport-error',
    body: Buffer.alloc(0),
    error: error.message,
  }));
  child.on('close', (exitCode) => {
    const output = Buffer.concat(stdout).toString('utf8');
    const marker = '\n__HTTP_STATUS__:';
    const markerIndex = output.lastIndexOf(marker);
    const bodyText = markerIndex === -1 ? output : output.slice(0, markerIndex);
    const parsedStatus = markerIndex === -1 ? 0 : Number(output.slice(markerIndex + marker.length).trim());
    const httpStatus = Number.isInteger(parsedStatus) ? parsedStatus : 0;
    resolve({
      requestedAt,
      httpStatus,
      outcome: exitCode === 0 && httpStatus >= 200 && httpStatus < 300
        ? 'success'
        : exitCode === 0 && httpStatus > 0
          ? 'http-error'
          : 'transport-error',
      body: Buffer.from(bodyText),
      error: Buffer.concat(stderr).toString('utf8').trim(),
    });
  });
});

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const captureResponse = async (url, { attemptLimit = maxAttempts, maxTimeSeconds = 30 } = {}) => {
  const attempts = [];
  let response;
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    response = await requestWithCurl(url, maxTimeSeconds);
    attempts.push({
      attempt,
      requestedAt: response.requestedAt,
      httpStatus: response.httpStatus,
      outcome: response.outcome,
      error: response.error,
    });
    if (response.outcome === 'success' || (response.httpStatus > 0 && response.httpStatus < 500 && response.httpStatus !== 429)) break;
    if (attempt < attemptLimit) await sleep(500);
  }
  return { ...response, attempts };
};

const venueCity = (source) => {
  const venueName = source.researchInput.nameEn || source.researchInput.nameLocal || source.researchInput.name;
  const suffix = ' official interior exterior';
  if (!source.researchQuery.startsWith(`${venueName} `) || !source.researchQuery.endsWith(suffix)) {
    throw new Error(`${source.id} has an unexpected canonical research query`);
  }
  return source.researchQuery.slice(venueName.length + 1, -suffix.length);
};

const venueQuery = (source, city) => {
  const venueName = source.researchInput.nameEn || source.researchInput.nameLocal || source.researchInput.name;
  return `${venueName} ${city}`;
};

const commonsUrl = (query) => {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '6',
    srlimit: '5',
    format: 'json',
    origin: '*',
  });
  return url.href;
};

const openverseUrl = (query) => {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.search = new URLSearchParams({ q: query, page_size: '5' });
  return url.href;
};

const bingUrl = (query) => {
  const url = new URL('https://www.bing.com/search');
  url.search = new URLSearchParams({ format: 'rss', q: query });
  return url.href;
};

const responseIdentity = (body) => ({
  rawResponseBytes: body.length,
  rawResponseSha256: createHash('sha256').update(body).digest('hex'),
});

const parseCommons = (body) => {
  const parsed = JSON.parse(body.toString('utf8'));
  const resultCount = parsed.query?.searchinfo?.totalhits ?? 0;
  const candidate = parsed.query?.search?.[0];
  return {
    resultCount,
    topCandidate: candidate ? {
      title: candidate.title,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(candidate.title.replaceAll(' ', '_')).replaceAll('%3A', ':')}`,
      creator: null,
      license: null,
    } : null,
  };
};

const parseOpenverse = (body) => {
  const parsed = JSON.parse(body.toString('utf8'));
  const candidate = parsed.results?.[0];
  return {
    resultCount: parsed.result_count ?? 0,
    topCandidate: candidate ? {
      title: candidate.title || '(untitled)',
      sourceUrl: candidate.foreign_landing_url || candidate.url,
      creator: candidate.creator || null,
      license: candidate.license ? `${candidate.license.toUpperCase()} ${candidate.license_version || ''}`.trim() : null,
    } : null,
  };
};

const decodeXml = (value) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
  .trim();

const rssValue = (item, tag) => {
  const match = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
};

const parseBingRss = (body) => {
  const xml = body.toString('utf8');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const first = items[0]?.[1];
  const title = first ? rssValue(first, 'title') : '';
  const url = first ? rssValue(first, 'link') : '';
  return {
    resultCount: items.length,
    topResult: title && /^https?:\/\//i.test(url) ? { title, url } : null,
  };
};

const acceptanceFor = (source, response, parsed) => {
  if (response.outcome !== 'success') {
    return {
      accepted: false,
      reasonCode: 'request-failed',
      reason: `The bounded API request ended with ${response.outcome} / HTTP ${response.httpStatus}; no candidate was accepted.`,
    };
  }
  if (source.contentStatus === 'needs-illustration') {
    return {
      accepted: false,
      reasonCode: 'content-unsuitable',
      reason: 'The canonical exact-venue asset is a menu close-up rather than an interior or exterior venue image; the content-review illustration decision remains in force.',
    };
  }
  if (source.downloadStatus === 'failed') {
    return {
      accepted: false,
      reasonCode: 'delivery-download-failed',
      reason: 'Canonical research already identifies a reusable exact-venue asset, but the committed bounded download attempts failed; the delivery remains an illustration.',
    };
  }
  if (!parsed.topCandidate) {
    return {
      accepted: false,
      reasonCode: 'no-candidate',
      reason: 'The venue-specific API query returned no candidate; the illustration decision remains in force.',
    };
  }
  return {
    accepted: false,
    reasonCode: 'identity-license-not-verified',
    reason: `The top discovery candidate "${parsed.topCandidate.title}" was not accepted because this automated result alone does not establish exact venue identity and adaptation-safe reuse rights.`,
  };
};

const captureService = async (source, service, query, requestUrl, parse) => {
  const response = await captureResponse(requestUrl, { attemptLimit: 1, maxTimeSeconds: 12 });
  let parsed = { resultCount: null, topCandidate: null };
  let parseError = '';
  if (response.outcome === 'success') {
    try {
      parsed = parse(response.body);
    } catch (error) {
      response.outcome = 'transport-error';
      parseError = `Invalid JSON response: ${error.message}`;
    }
  }
  return {
    service,
    query,
    requestedAt: response.requestedAt,
    requestUrl,
    httpStatus: response.httpStatus,
    outcome: response.outcome,
    ...responseIdentity(response.body),
    resultCount: parsed.resultCount,
    topCandidate: parsed.topCandidate,
    attempts: response.attempts,
    error: parseError || response.error,
    acceptance: acceptanceFor(source, response, parsed),
  };
};

const officialAcceptance = (response, parsed) => {
  if (response.outcome !== 'success') {
    return {
      accepted: false,
      reasonCode: 'official-discovery-request-failed',
      reason: `The bounded official-source discovery request ended with ${response.outcome} / HTTP ${response.httpStatus}; no official media rights were accepted.`,
    };
  }
  if (!parsed.topResult) {
    return {
      accepted: false,
      reasonCode: 'official-discovery-no-result',
      reason: 'The exact venue-and-city query returned no usable top result; no official media rights were accepted.',
    };
  }
  return {
    accepted: false,
    reasonCode: 'official-result-rights-not-established',
    reason: `The top web result "${parsed.topResult.title}" was recorded for discovery only; a search result does not grant adaptation and redistribution rights, so no official image was accepted.`,
  };
};

const captureOfficial = async (source, city) => {
  const query = source.researchQuery;
  const venueName = source.researchInput.nameEn || source.researchInput.nameLocal || source.researchInput.name;
  const requestUrl = bingUrl(query);
  const response = await captureResponse(requestUrl, { attemptLimit: 1, maxTimeSeconds: 12 });
  let parsed = { resultCount: null, topResult: null };
  let parseError = '';
  if (response.outcome === 'success') {
    try {
      parsed = parseBingRss(response.body);
    } catch (error) {
      response.outcome = 'transport-error';
      parseError = `Invalid RSS response: ${error.message}`;
    }
  }
  return {
    service: 'bing-web-rss',
    query,
    venueName,
    city,
    requestedAt: response.requestedAt,
    requestUrl,
    httpStatus: response.httpStatus,
    outcome: response.outcome,
    ...responseIdentity(response.body),
    resultCount: parsed.resultCount,
    topResult: parsed.topResult,
    attempts: response.attempts,
    error: parseError || response.error,
    acceptance: officialAcceptance(response, parsed),
  };
};

const captureRow = async (source) => {
  const city = venueCity(source);
  const query = venueQuery(source, city);
  const official = await captureOfficial(source, city);
  const previous = previousById.get(source.id);
  const reusableServices = previous?.services?.length === 2
    && previous.services.every((service) => service.query === query);
  const commons = reusableServices
    ? previous.services[0]
    : await captureService(source, 'wikimedia-commons', query, commonsUrl(query), parseCommons);
  const openverse = reusableServices
    ? previous.services[1]
    : await captureService(source, 'openverse', query, openverseUrl(query), parseOpenverse);
  await sleep(1_100);
  return {
    id: source.id,
    venue: {
      name: source.researchInput.name,
      nameEn: source.researchInput.nameEn,
      nameLocal: source.researchInput.nameLocal,
      city,
      category: source.researchInput.category,
    },
    official,
    services: [commons, openverse],
  };
};

const partialReport = await readJson(partialPath).catch(() => ({ rows: [] }));
const partialById = new Map(partialReport.rows.map((row) => [row.id, row]));
const rows = [];
for (const [index, source] of targets.entries()) {
  const resumed = partialById.get(source.id);
  const row = resumed?.official?.service === 'bing-web-rss'
    && resumed.official.query === source.researchQuery
    ? resumed
    : await captureRow(source);
  rows.push(row);
  await writeFile(partialPath, `${JSON.stringify({ rows }, null, 2)}\n`, 'utf8');
  process.stdout.write(`CAPTURED ${index + 1}/${targets.length} ${source.id}${row === resumed ? ' resumed' : ''}\n`);
}
const report = {
  generatedAt: new Date().toISOString(),
  method: 'Sequential official-first discovery via one bounded Bing Web RSS request per illustration. Existing exact-query Wikimedia Commons/Openverse captures were preserved; newly added illustration rows were captured after their official check. No Google or Tripadvisor media downloaded.',
  maxAttempts,
  rows,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await rm(partialPath, { force: true });
process.stdout.write(`SEARCH_EVIDENCE_OK rows=${rows.length} officialSuccess=${rows.filter((row) => row.official.outcome === 'success').length} services=${rows.length * 2} commonsSuccess=${rows.filter((row) => row.services[0].outcome === 'success').length} openverseSuccess=${rows.filter((row) => row.services[1].outcome === 'success').length}\n`);
