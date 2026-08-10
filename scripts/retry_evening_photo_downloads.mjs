import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const researchDirectory = join(root, 'scripts', 'evening-media-research');
const outputPath = join(root, 'scripts', 'evening-media-download-attempts.json');
const photoDirectory = join(root, 'assets', 'evening', 'sources', 'photos');
const maxAttempts = 2;
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const fileExists = async (path) => access(path).then(() => true, () => false);
const fileIdentity = async (path) => {
  const bytes = await readFile(path);
  return { sourceBytes: bytes.length, sourceSha256: createHash('sha256').update(bytes).digest('hex') };
};

const results = [
  ...await readJson(join(researchDirectory, 'italy-results.json')),
  ...await readJson(join(researchDirectory, 'tokyo-results.json')),
];
const contentDecisions = await readJson(join(root, 'scripts', 'evening-media-content-decisions.json'));
const illustrationOnlyIds = new Set(
  contentDecisions.filter((item) => item.decision === 'needs-illustration').map((item) => item.id),
);
const previousReport = await fileExists(outputPath) ? await readJson(outputPath) : { targets: [] };
const previousTargets = new Map(previousReport.targets.map((item) => [item.id, item]));
const targets = [];
await mkdir(photoDirectory, { recursive: true });

for (const row of results.filter((item) => item.status === 'verified-photo')) {
  if (illustrationOnlyIds.has(row.id)) continue;
  const destination = join(photoDirectory, `${row.id}.jpg`);
  if (await fileExists(destination)) {
    const previous = previousTargets.get(row.id);
    if (previous?.finalOutcome === 'downloaded') {
      const identity = await fileIdentity(destination);
      if (identity.sourceBytes !== previous.sourceBytes || identity.sourceSha256 !== previous.sourceSha256) {
        throw new Error(`Historical download ${row.id} checksum mismatch; refusing to overwrite recorded provenance`);
      }
      targets.push(previous);
    }
    continue;
  }
  const target = {
    id: row.id,
    url: row.directAssetUrl,
    sourcePage: row.sourcePage,
    attempts: [],
    finalOutcome: 'failed',
  };
  const temporary = `${destination}.download`;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const startedAt = new Date().toISOString();
    await rm(temporary, { force: true });
    const result = spawnSync('curl.exe', [
      '--location',
      '--silent',
      '--show-error',
      '--connect-timeout', '10',
      '--max-time', '45',
      '--output', temporary,
      '--write-out', '%{http_code}',
      row.directAssetUrl,
    ], { encoding: 'utf8', timeout: 55_000 });
    const finishedAt = new Date().toISOString();
    const httpStatus = /^\d{3}$/.test(result.stdout?.trim()) ? result.stdout.trim() : null;
    const downloaded = result.status === 0 && httpStatus && Number(httpStatus) >= 200 && Number(httpStatus) < 300
      && await fileExists(temporary);
    const error = downloaded
      ? ''
      : [
          result.error?.message,
          result.stderr?.trim(),
          httpStatus ? `HTTP ${httpStatus}` : 'No HTTP status returned',
        ].filter(Boolean).join('; ');
    target.attempts.push({
      attempt: attemptNumber,
      startedAt,
      finishedAt,
      outcome: downloaded ? 'downloaded' : 'failed',
      httpStatus,
      exitCode: result.status,
      error,
    });
    if (downloaded) {
      await rename(temporary, destination);
      const identity = await fileIdentity(destination);
      Object.assign(target.attempts.at(-1), { bytes: identity.sourceBytes, sha256: identity.sourceSha256 });
      Object.assign(target, identity);
      target.finalOutcome = 'downloaded';
      break;
    }
  }
  await rm(temporary, { force: true });
  targets.push(target);
}

const report = {
  generatedAt: new Date().toISOString(),
  maxAttempts,
  selection: 'verified-photo research rows whose expected local photo file was absent',
  targets,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`DOWNLOAD_RETRY targets=${targets.length} downloaded=${targets.filter((item) => item.finalOutcome === 'downloaded').length} failed=${targets.filter((item) => item.finalOutcome === 'failed').length}\n`);
