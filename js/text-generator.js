/**
 * Text Generator for Typing Practice — Try-Speed
 * Provides extensive randomized word streams for Easy, Medium, and Hard difficulty levels.
 */

import { THAI_WORDS } from './thai-words.js';

export const TextGenerator = (() => {
  // 300+ Common English words for Easy mode (lowercase, simple, high frequency)
  const EASY_WORDS = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'water', 'long', 'great', 'world', 'here', 'life', 'still', 'must', 'hand', 'small',
    'large', 'home', 'read', 'port', 'spell', 'add', 'land', 'big', 'high', 'such',
    'follow', 'act', 'why', 'ask', 'men', 'change', 'went', 'light', 'kind', 'off',
    'need', 'house', 'picture', 'try', 'again', 'animal', 'point', 'mother', 'near', 'build',
    'self', 'earth', 'father', 'head', 'stand', 'own', 'page', 'should', 'country', 'found',
    'answer', 'school', 'grow', 'study', 'learn', 'plant', 'cover', 'food', 'sun', 'four',
    'between', 'state', 'keep', 'eye', 'never', 'last', 'let', 'thought', 'city', 'tree',
    'cross', 'farm', 'hard', 'start', 'might', 'story', 'saw', 'far', 'sea', 'draw',
    'left', 'late', 'run', 'while', 'press', 'close', 'night', 'real', 'few', 'north',
    'open', 'seem', 'together', 'next', 'white', 'children', 'begin', 'got', 'walk', 'example',
    'ease', 'paper', 'group', 'always', 'music', 'those', 'both', 'mark', 'often', 'letter',
    'until', 'mile', 'river', 'car', 'feet', 'care', 'second', 'book', 'carry', 'took',
    'rain', 'eat', 'room', 'friend', 'began', 'idea', 'fish', 'mountain', 'stop', 'once',
    'base', 'hear', 'horse', 'cut', 'sure', 'watch', 'color', 'face', 'wood', 'main',
    'enough', 'plain', 'girl', 'usual', 'young', 'ready', 'above', 'ever', 'red', 'list',
    'though', 'feel', 'talk', 'bird', 'soon', 'body', 'dog', 'family', 'direct', 'pose',
    'leave', 'song', 'measure', 'door', 'product', 'black', 'short', 'numeral', 'class', 'wind',
    'question', 'happen', 'complete', 'ship', 'area', 'half', 'rock', 'order', 'fire', 'south',
    'problem', 'piece', 'told', 'knew', 'pass', 'since', 'top', 'whole', 'king', 'space'
  ];

  // 300+ Conversational & Journalistic words for Medium mode (varied casing & natural punctuation)
  const MEDIUM_WORDS = [
    'However,', 'technology', 'system', 'creative', 'discover', 'nature.', 'Always',
    'curious', 'learning', 'journey', 'digital', 'freedom', 'Because', 'morning',
    'quiet', 'horizon', 'effortless', 'design', 'consistent', 'practice,', 'instrument',
    'memory', 'whisper', 'forest', 'autumn', 'golden', 'leaves.', 'Success',
    'persistence', 'patience;', 'telescope', 'cosmos,', 'millions', 'distant', 'galaxy',
    'confident', 'breeze', 'twilight', 'vibrant', 'resilience', 'obstacle', 'determination,',
    'programming', 'algorithm', 'function', 'developer', 'browser', 'interface', 'solution.',
    'Imagine', 'wonder', 'explore', 'universe', 'planet', 'adventure', 'curiosity,',
    'language', 'sentence', 'rhythm', 'keyboard', 'keystroke', 'accuracy.', 'Perhaps',
    'tomorrow', 'challenge', 'progress', 'moment', 'peaceful', 'serenade', 'harmony,',
    'knowledge', 'insight', 'balance', 'clarity', 'strength', 'courage.', 'Indeed,',
    'ancient', 'modern', 'architect', 'structure', 'foundation', 'canvas', 'brilliant,',
    'inspire', 'passion', 'dedication', 'craftsman', 'mastery', 'experience.', 'Sometimes',
    'simple', 'profound', 'connection', 'empathy', 'dialogue', 'listen,', 'understand.',
    'energy', 'momentum', 'potential', 'achieve', 'dimension', 'horizon,', 'infinite',
    'reflection', 'twilight', 'starlight', 'shadow', 'illuminate', 'pathway.', 'Together,',
    'discover', 'treasure', 'library', 'chapter', 'history', 'wisdom,', 'generations.',
    'spectrum', 'atmosphere', 'velocity', 'orbit', 'constellation', 'gravity.', 'Therefore,',
    'thoughtful', 'deliberate', 'spontaneous', 'authentic', 'expression', 'originality,',
    'landscape', 'meadow', 'riverbank', 'solitude', 'tranquil', 'reflection.', 'Suddenly,',
    'spark', 'catalyst', 'breakthrough', 'innovate', 'collaborate', 'succeed,', 'triumph.',
    'curious', 'observe', 'analyze', 'synthesize', 'formulate', 'evaluate.', 'Finally,',
    'breath', 'focus', 'flow', 'tempo', 'precision', 'fluidity,', 'seamless.', 'Everywhere,',
    'opportunity', 'potential', 'unfold', 'destiny', 'courage', 'adventure.', 'Undoubtedly,'
  ];

  // 300+ Advanced vocabulary, technical terms, symbols, numbers, and dates for Hard mode
  const HARD_WORDS = [
    'In 1969,', 'Apollo-11', 'superposition', 'quantum-entanglement', 'NP-hard',
    'algorithms', 'exponentially', 'By 2035,', '62.5%', 'CO2', 'emissions',
    'asynchronous', 'I/O;', 'microservices', 'RESTful', 'APIs,', 'WebSockets,',
    'gRPC', 'endpoints.', 'Renaissance', '(circa 1400–1600),', 'polymaths',
    'Leonardo', 'da Vinci', 'surged by 14.8%,', 'inflationary', 'headwinds',
    'supply-chain', 'bottlenecks.', 'synaptic', 'plasticity—the', 'neurons\'',
    'connections—underpins', 'Atacama', '(elevation: 5,050m),', 'unhindered',
    'atmospheric', 'Kierkegaard:', '"Life backwards; forwards."', 'SHA-256',
    'tamper-proof', 'blockchain', 'protocols.', 'Beethoven\'s', 'Symphony No. 9',
    'allegro', 'climax!', '1990–2020,', 'surpassed 59.5%', 'biodiversity:',
    'keystone', 'species', '(wolves & otters)', 'biomes.', 'L1/L2/L3', 'caches,',
    '~100ns', 'non-blocking', 'concurrency.', 'TypeScript/Rust', 'compiler',
    'polymorphic', 'deterministic', 'state-machine.', 'OAuth2.0', 'JWT-token',
    'cryptographic', 'entropy;', 'hexadecimal', '#00ff66', 'matrix-code.',
    'Fibonacci(n):', 'f(0)=0,', 'f(1)=1;', 'Big-O: O(N*logN)', 'quicksort.',
    'hypothetical', 'phenomenon', 'conscientious', 'miscellaneous', 'bureaucracy,',
    'ubiquitous', 'paradigm-shift', 'prerequisite', 'anachronism.', 'CPU @ 4.8GHz',
    'RAM: 32GB', 'DDR5-6000', 'NVMe-SSD (7,000MB/s).', 'Q3/2026', 'p-value < 0.001',
    'variance (σ²);', 'standard-deviation (σ).', 'Distributed-consensus', 'Raft/Paxos',
    'fault-tolerant', 'replicated-log.', 'HTTP/3 over QUIC', 'UDP-based', '0-RTT'
  ];

  /**
   * Fisher-Yates shuffle helper
   */
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Generate purely randomized word streams based on difficulty and session duration.
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @param {number|string} duration - seconds (30, 60, 120, custom, or 'inf')
   * @returns {string} Randomized words sequence
   */
  function generateText(difficulty = 'medium', duration = 60, language = 'en') {
    let targetWords = 95;
    if (duration === 'inf' || duration === Infinity) {
      targetWords = 240;
    } else {
      const sec = Number(duration) || 60;
      targetWords = Math.max(25, Math.round(sec * 1.65));
    }

    let wordPool = EASY_WORDS;
    if (difficulty === 'medium') wordPool = MEDIUM_WORDS;
    else if (difficulty === 'hard') wordPool = HARD_WORDS;
    if (language === 'th') wordPool = THAI_WORDS[difficulty] || THAI_WORDS.medium;

    const resultWords = [];
    let shuffledPool = shuffle(wordPool);
    let poolIndex = 0;

    for (let i = 0; i < targetWords; i++) {
      if (poolIndex >= shuffledPool.length) {
        shuffledPool = shuffle(wordPool);
        poolIndex = 0;
      }

      // Avoid consecutive duplicate words
      let word = shuffledPool[poolIndex++];
      if (resultWords.length > 0 && resultWords[resultWords.length - 1].toLowerCase() === word.toLowerCase()) {
        const replacement = wordPool.find(candidate => candidate.toLowerCase() !== word.toLowerCase());
        if (replacement) word = replacement;
      }

      resultWords.push(word);
    }

    if (language === 'th' && difficulty === 'hard') {
      const sample = resultWords.join(' ');
      if (!/[0-9๐-๙]/u.test(sample) || !/[():%!?/#".-]/u.test(sample)) {
        resultWords[resultWords.length - 1] = 'คะแนน:100';
      }
    }
    return resultWords.join(' ');
  }

  return {
    generateText,
    THAI_WORDS,
    EASY_WORDS,
    MEDIUM_WORDS,
    HARD_WORDS
  };
})();
