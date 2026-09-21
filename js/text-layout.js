/** Keep combining vowels/tone marks in one shaping run without changing text. */
const segmenters = new Map();

export function splitGraphemes(text, language = 'en') {
  if (typeof Intl.Segmenter === 'function') {
    if (!segmenters.has(language)) segmenters.set(language, new Intl.Segmenter(language, { granularity: 'grapheme' }));
    return [...segmenters.get(language).segment(text)].map(part => part.segment);
  }
  const groups = [];
  for (const char of text) {
    if (groups.length && /[\p{Mark}\u0e33]/u.test(char)) groups[groups.length - 1] += char;
    else groups.push(char);
  }
  return groups;
}
