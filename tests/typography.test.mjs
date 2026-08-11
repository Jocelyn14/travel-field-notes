import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBalancedTitleLines } from '../src/typography.mjs';

const measure = (text) => [...text].length;

test('balanced Chinese title lines avoid orphan characters and bad punctuation', () => {
  const lines = chooseBalancedTitleLines('抵达前，先认识这里', 6, measure);
  assert.ok(lines.length >= 2);
  assert.ok(lines.every((line) => [...line].length >= 2));
  assert.ok(lines.every((line) => !/^[，。！？；：、）》】」』]/u.test(line)));
  assert.ok(lines.every((line) => !/[《【（「『]$/u.test(line)));
  assert.ok(Math.max(...lines.map(measure)) - Math.min(...lines.map(measure)) <= 2);
});

test('balanced title layout responds to available width', () => {
  const title = '于是我们走出幽暗，再一次看见群星。';
  const narrow = chooseBalancedTitleLines(title, 7, measure);
  const wide = chooseBalancedTitleLines(title, 11, measure);
  assert.notDeepEqual(narrow, wide);
  assert.ok(narrow.length > wide.length);
});
