const CLOSING_PUNCTUATION = /^[，。！？；：、）》】」』]/u;
const OPENING_PUNCTUATION = /[《【（「『]$/u;
const PREFERRED_BREAK = /[，。！？；：、]$/u;

function partitions(length, lineCount, minimum = 2) {
  const results = [];
  const visit = (breaks, start) => {
    if (breaks.length === lineCount - 1) {
      if (length - start >= minimum) results.push(breaks);
      return;
    }
    const remainingLines = lineCount - breaks.length - 1;
    const last = length - (remainingLines * minimum);
    for (let index = start + minimum; index <= last; index += 1) visit([...breaks, index], index);
  };
  visit([], 0);
  return results;
}

function splitAt(characters, breaks) {
  const points = [0, ...breaks, characters.length];
  return points.slice(0, -1).map((start, index) => characters.slice(start, points[index + 1]).join(''));
}

export function chooseBalancedTitleLines(value, maxWidth, measure = (text) => [...text].length) {
  const text = String(value ?? '').trim();
  const characters = [...text];
  if (!text || maxWidth <= 0 || measure(text) <= maxWidth) return text ? [text] : [];
  const minimumLines = Math.max(2, Math.ceil(measure(text) / maxWidth));
  const maximumLines = Math.min(4, Math.max(minimumLines + 1, 2), Math.floor(characters.length / 2));
  let best = null;
  for (let lineCount = minimumLines; lineCount <= maximumLines; lineCount += 1) {
    for (const breaks of partitions(characters.length, lineCount)) {
      const lines = splitAt(characters, breaks);
      if (lines.some((line) => CLOSING_PUNCTUATION.test(line) || OPENING_PUNCTUATION.test(line))) continue;
      const widths = lines.map(measure);
      const overflow = widths.reduce((sum, width) => sum + Math.max(0, width - maxWidth) ** 2, 0);
      const average = widths.reduce((sum, width) => sum + width, 0) / widths.length;
      const imbalance = widths.reduce((sum, width) => sum + (width - average) ** 2, 0);
      const punctuationReward = lines.slice(0, -1).filter((line) => PREFERRED_BREAK.test(line)).length;
      const score = (overflow * 1000) + imbalance + ((lineCount - minimumLines) * 18) - (punctuationReward * 3);
      if (!best || score < best.score) best = { lines, score };
    }
    if (best && best.lines.every((line) => measure(line) <= maxWidth)) break;
  }
  return best?.lines ?? [text];
}

function titleMeasure(element) {
  const style = getComputedStyle(element);
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return (text) => [...text].length;
  context.font = style.font;
  const spacing = Number.parseFloat(style.letterSpacing) || 0;
  return (text) => context.measureText(text).width + Math.max(0, [...text].length - 1) * spacing;
}

export function applyBalancedTitles(root = document) {
  root.querySelectorAll('[data-balance-title="true"]').forEach((element) => {
    const text = element.dataset.titleText || element.getAttribute('aria-label') || element.textContent.trim();
    if (!text) return;
    element.dataset.titleText = text;
    element.setAttribute('aria-label', text);
    element.replaceChildren(document.createTextNode(text));
    const width = element.getBoundingClientRect().width;
    if (width <= 0) return;
    const lines = chooseBalancedTitleLines(text, width, titleMeasure(element));
    element.replaceChildren(...lines.map((line) => {
      const span = document.createElement('span');
      span.className = 'display-title__line';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = line;
      return span;
    }));
  });
}

let resizeObserver;

export function watchBalancedTitles(root = document) {
  resizeObserver?.disconnect();
  applyBalancedTitles(root);
  if (!('ResizeObserver' in globalThis)) return;
  resizeObserver = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => applyBalancedTitles(target.parentElement ?? root));
  });
  root.querySelectorAll('[data-balance-title="true"]').forEach((element) => resizeObserver.observe(element));
}
