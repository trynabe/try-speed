import test from 'node:test';
import assert from 'node:assert/strict';
import { TextGenerator } from '../js/text-generator.js';
import { THAI_WORDS } from '../js/thai-words.js';
import { splitGraphemes } from '../js/text-layout.js';
import { TypingEngine } from '../js/typing-engine.js';
import { StorageManager } from '../js/storage.js';

test('Thai dictionaries have distinct levels, marks, numbers and punctuation', () => {
  for (const words of Object.values(THAI_WORDS)) {
    assert.ok(words.length >= 80);
    assert.equal(new Set(words).size, words.length);
    for (const word of words) {
      assert.match(word, /[ก-๙]/u);
      assert.doesNotMatch(word, /\s/);
    }
  }
  const medium = THAI_WORDS.medium.join('');
  for (const mark of ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', '่', '้', '๊', '๋']) assert.ok(medium.includes(mark), mark);
  assert.match(THAI_WORDS.hard.join(' '), /์/u);
  assert.match(THAI_WORDS.hard.join(' '), /[0-9๐-๙]/u);
});

test('each Thai difficulty produces single-space-separated tokens from its dictionary', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const duration of [1, 30, 45, 120, 'inf']) {
      const text = TextGenerator.generateText(difficulty, duration, 'th');
      assert.equal(text, text.trim());
      assert.doesNotMatch(text, /\s{2}|[\r\n\t]/);
      const words = text.split(' ');
      assert.ok(words.length >= 25);
      for (const word of words) assert.ok(THAI_WORDS[difficulty].includes(word), word);
      for (let i=1;i<words.length;i++) assert.notEqual(words[i], words[i-1]);
      if (difficulty === 'hard') {
        assert.match(text, /[0-9๐-๙]/u);
        assert.match(text, /[():%!?/#".-]/u);
      }
    }
  }
  assert.doesNotMatch(TextGenerator.generateText('easy', 30), /[ก-๙]/u);
});

test('Thai combining marks stay in a cluster and text is not normalized away', () => {
  const text = 'กุ้ง น้ำ ปี่ ผู้ใหญ่ เก้าอี้';
  const groups = splitGraphemes(text, 'th');
  assert.equal(groups.join(''), text);
  assert.ok(groups.includes('กุ้'));
  assert.ok(groups.includes('น้ำ'));
  for (const group of groups) assert.doesNotMatch(group, /^\p{Mark}/u);
  const original = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    const fallback = splitGraphemes(text, 'th');
    assert.equal(fallback.join(''), text);
    assert.ok(fallback.includes('กุ้'));
    assert.ok(fallback.includes('น้ำ'));
  } finally { Intl.Segmenter = original; }
});

test('Thai CPM counts correct typed characters including marks and spaces', () => {
  const engine = new TypingEngine();
  const text = 'กุ้ง น้ำ';
  engine.setText(text + ' ต่อ');
  for (const char of text) engine.handleInput(char);
  engine.setElapsedSeconds(30);
  const metrics = engine.getMetrics();
  assert.equal(metrics.correctChars, text.length);
  assert.equal(metrics.cpm, text.length * 2);
  assert.equal(metrics.wpm, Math.round(text.length * 2 / 5));
  assert.equal(metrics.accuracy, 100);
  engine.handleInput('x');
  engine.handleInput('Backspace');
  assert.equal(engine.getMetrics().incorrectChars, 0);
  assert.equal(engine.getMetrics().cpm, text.length * 2);
  assert.ok(engine.getMetrics().accuracy < 100);
});

test('Thai backspace removes one mark and Ctrl+Backspace removes a space-delimited word', () => {
  const engine = new TypingEngine();
  engine.setText('กุ้ง น้ำ ต่อ');
  for (const char of 'กุ้') engine.handleInput(char);
  engine.handleInput('Backspace');
  assert.equal(engine.currentIndex, 2);
  assert.equal(engine.charStates[2].state, 'pending');
  for (const char of '้ง น้ำ ') engine.handleInput(char);
  engine.handleInput('Backspace', true);
  assert.equal(engine.currentIndex, 'กุ้ง '.length);
  assert.equal(engine.getMetrics().correctChars, 'กุ้ง '.length);
});

test('English legacy records migrate without leaking into Thai personal bests', () => {
  const data = new Map();
  globalThis.localStorage = { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value), removeItem:key=>data.delete(key) };
  try {
    const legacy = {wpm:80,accuracy:98,duration:60,difficulty:'medium',date:1};
    data.set('typing_practice_best_scores', JSON.stringify({medium_60:legacy,overall:legacy}));
    assert.equal(StorageManager.getBestScore('medium',60,'en').wpm,80);
    assert.equal(StorageManager.getBestScore('medium',60,'th'),null);
    const session = {wpm:40,cpm:200,rawWpm:42,accuracy:96,correctChars:200,incorrectChars:10,totalChars:300,timeSpent:60,duration:60,difficulty:'medium',language:'th'};
    StorageManager.saveSession(session);
    assert.equal(StorageManager.getBestScore('medium',60,'th').wpm,40);
    assert.equal(StorageManager.getBestScore('medium',60,'en').wpm,80);
    assert.equal(StorageManager.getBestScore(null,null,'th').wpm,40);
    assert.equal(StorageManager.getBestScore(null,null,'en').wpm,80);
    assert.equal(StorageManager.getHistory()[0].language,'th');
    assert.equal(StorageManager.getHistory()[0].cpm,200);
    const stored = JSON.parse(data.get('typing_practice_best_scores'));
    assert.ok(stored.en_medium_60 && stored.th_medium_60);
    assert.equal(stored.medium_60,undefined);
    delete session.language;
    StorageManager.saveSession(session);
    assert.equal(StorageManager.getHistory()[0].language,'en');
    StorageManager.saveSettings({language:'th'});
    assert.equal(StorageManager.getSettings().language,'th');
    StorageManager.saveSettings({language:'unknown'});
    assert.equal(StorageManager.getSettings().language,'en');
  } finally { delete globalThis.localStorage; }
});
