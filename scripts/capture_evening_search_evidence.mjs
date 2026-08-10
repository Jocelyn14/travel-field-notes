import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sources = await readJson(join(root, 'scripts', 'evening-media-sources.json'));
const catalog = await readJson(join(root, 'scripts', 'evening-media-catalog.json'));
const outputPath = join(root, 'scripts', 'evening-media-search-evidence.json');
const illustrationIds = new Set(catalog.filter((item) => item.kind === 'illustration').map((item) => item.id));
const targets = sources.filter((item) => illustrationIds.has(item.id));
const maxAttempts = 2;

if (targets.length !== illustrationIds.size) throw new Error('Illustration catalog and source decisions do not align');

const requestWithCurl = (url) => new Promise((resolve) => {
  const requestedAt = new Date().toISOString();
  const child = spawn('curl.exe', [
    '--silent',
    '--show-error',
    '--location',
    '--connect-timeout', '10',
    '--max-time', '30',
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
const captureResponse = async (url) => {
  const attempts = [];
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await requestWithCurl(url);
    attempts.push({
      attempt,
      requestedAt: response.requestedAt,
      httpStatus: response.httpStatus,
      outcome: response.outcome,
      error: response.error,
    });
    if (response.outcome === 'success' || (response.httpStatus > 0 && response.httpStatus < 500 && response.httpStatus !== 429)) break;
    if (attempt < maxAttempts) await sleep(500);
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
  const response = await captureResponse(requestUrl);
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

const captureRow = async (source) => {
  const city = venueCity(source);
  const query = venueQuery(source, city);
  const commons = await captureService(source, 'wikimedia-commons', query, commonsUrl(query), parseCommons);
  const openverse = await captureService(source, 'openverse', query, openverseUrl(query), parseOpenverse);
  await sleep(2_100);
  return {
    id: source.id,
    venue: {
      name: source.researchInput.name,
      nameEn: source.researchInput.nameEn,
      nameLocal: source.researchInput.nameLocal,
      city,
      category: source.researchInput.category,
    },
    official: {
      status: 'not-recorded',
      sourceUrl: null,
      reason: 'The canonical per-row research record does not identify a specific official venue source URL, so no official-source check is claimed.',
    },
    services: [commons, openverse],
  };
};

const runPool = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
      process.stdout.write(`CAPTURED ${index + 1}/${items.length} ${items[index].id}\n`);
    }
  }));
  return results;
};

const rows = await runPool(targets, 1, captureRow);
const report = {
  generatedAt: new Date().toISOString(),
  method: 'Bounded read-only Wikimedia Commons and Openverse API discovery; no Google or Tripadvisor media downloaded.',
  maxAttempts,
  rows,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`SEARCH_EVIDENCE_OK rows=${rows.length} services=${rows.length * 2} commonsSuccess=${rows.filter((row) => row.services[0].outcome === 'success').length} openverseSuccess=${rows.filter((row) => row.services[1].outcome === 'success').length}\n`);
