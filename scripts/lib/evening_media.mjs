import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const REQUIRED_FIELDS = ['id', 'sourceFile', 'sourceUrl', 'kind', 'license', 'credit', 'alt', 'verifiedAt'];
const MEDIA_KINDS = new Set(['venue-photo', 'illustration']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requireField = (entry, field) => {
  if (typeof entry[field] !== 'string' || !entry[field].trim()) {
    throw new Error(`${entry.id || 'catalog'}.${field} 不能为空`);
  }
};

const rejectDuplicate = (catalog, field) => {
  const seen = new Set();
  for (const entry of catalog) {
    if (seen.has(entry[field])) throw new Error(`${entry.id}.${field} 不得重复`);
    seen.add(entry[field]);
  }
};

export const validateCatalog = (catalog, ids) => {
  if (!Array.isArray(catalog)) throw new Error('catalog 必须是数组');
  if (!Array.isArray(ids)) throw new Error('ids 必须是数组');

  const expectedIds = new Set(ids);
  const catalogIds = new Set();
  for (const entry of catalog) {
    if (!entry || typeof entry !== 'object') throw new Error('catalog 条目必须是对象');
    for (const field of REQUIRED_FIELDS) requireField(entry, field);
    if (!expectedIds.has(entry.id)) throw new Error(`${entry.id} 不在推荐列表中`);
    if (catalogIds.has(entry.id)) throw new Error(`${entry.id}.id 不得重复`);
    if (!MEDIA_KINDS.has(entry.kind)) throw new Error(`${entry.id}.kind 不得是 neighborhood-fallback，必须是 venue-photo 或 illustration`);
    if (!DATE_PATTERN.test(entry.verifiedAt)) throw new Error(`${entry.id}.verifiedAt 必须是 YYYY-MM-DD`);
    catalogIds.add(entry.id);
  }
  for (const id of expectedIds) {
    if (!catalogIds.has(id)) throw new Error(`${id} 缺少媒体目录项`);
  }
  rejectDuplicate(catalog, 'sourceFile');
  rejectDuplicate(catalog, 'sourceUrl');
  return catalog;
};

export const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

export const differenceHash = (rawPixels, width, height) => {
  if (width !== 9 || height !== 8 || rawPixels.length !== width * height) {
    throw new Error('differenceHash 需要 9x8 灰度像素');
  }
  let hash = 0n;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width - 1; column += 1) {
      const offset = row * width + column;
      hash = (hash << 1n) | BigInt(rawPixels[offset] > rawPixels[offset + 1]);
    }
  }
  return hash.toString(16).padStart(16, '0');
};

export const hammingDistance = (a, b) => {
  let difference = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let distance = 0;
  while (difference) {
    difference &= difference - 1n;
    distance += 1;
  }
  return distance;
};
