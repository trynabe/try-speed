import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TypingApp } from '../js/app.js';
import { Timer } from '../js/timer.js';
import { StorageManager } from '../js/storage.js';
import { TextGenerator } from '../js/text-generator.js';
import { UIController } from '../js/ui.js';
import { splitGraphemes } from '../js/text-layout.js';

class Element {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.dataset = {};
    this.tagName = 'BUTTON';
    this.isConnected = true;
    this.listeners = {};
    this.attributes = {};
    this.children = [];
    const classes = new Set(['hidden']);
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, force) => { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); }
    };
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  fire(type, event = {}) {
    event.target ??= this;
    event.preventDefault ??= () => { event.defaultPrevented = true; };
    event.stopPropagation ??= () => {};
    for (const fn of this.listeners[type] || []) fn(event);
    return event;
  }
  focus() { document.activeElement = this; }
  setSelectionRange() {}
  setAttribute(key, value) { this.attributes[key] = value; }
  setCustomValidity(message) { this.validationMessage = message; }
  reportValidity() { this.reportedValidity = true; }
  querySelector() { return this.firstControl || null; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
}

let elements, windowEvents, now, apps;
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
  elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  globalThis.document = {
    getElementById: get, querySelectorAll: () => [],
    activeElement: get('hidden-input'), body: new Element('body'),
    createElement: tag => new Element(tag)
  };
  windowEvents = {};
  globalThis.window = { addEventListener: (type, fn) => { windowEvents[type] = fn; } };
  now = 0;
  apps = [];
});
afterEach(() => {
  for (const app of apps) { app.timer.stop(); clearTimeout(app.compositionCommitTimer); }
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.localStorage;
});

function makeApp(duration = 1) {
  StorageManager.saveSettings({ duration, difficulty: 'easy' });
  const ui = {
    hiddenInput: document.getElementById('hidden-input'),
    resultsModal: document.getElementById('results-modal'),
    customDurModal: document.getElementById('custom-duration-modal'),
    restartBtn: document.getElementById('restart-btn'),
    modals: [], results: [],
    setSoundState() {}, updateSoundVolumeUI() {}, updateSoundProfileUI() {}, setTheme() {}, setPracticeLanguage() {},
    updateCustomDurationPill() {}, updateTimer(value, elapsed) { this.timer = { value, elapsed }; },
    updateCharacterStates() {}, updateLiveMetrics(metrics) { this.metrics = metrics; },
    renderText(text) { this.text = text; }, showFocusOverlay() {}, setFinishEnabled(enabled) { this.finishEnabled = enabled; },
    getOpenModal() { return this.modal || null; },
    showResultsModal(data) { this.results.push(data); this.modal = this.resultsModal; this.resultsModal.classList.remove('hidden'); },
    hideResultsModal() { if (this.modal === this.resultsModal) this.modal = null; this.resultsModal.classList.add('hidden'); },
    closeCustomDurModal() { this.modal = null; },
    openCustomDurModal() { this.modal = this.customDurModal; }
  };
  const app = new TypingApp({ ui, now: () => now });
  apps.push(app);
  app.currentText = 'abcdefghijklmnopqrstuvwxyz';
  app.restartCurrentText();
  return app;
}

test('expired sessions lock input, save once, and cannot corrupt personal best', () => {
  const app = makeApp();
  app.commitText('a');
  now = 1500;
  app.timer.tick();
  const saved = StorageManager.getHistory()[0];
  assert.equal(saved.timeSpent, 1);
  assert.equal(saved.correctChars, 1);
  assert.equal(saved.wpm, 12);
  app.commitText('bcdefghijklmnopqrstuvwxyz');
  app.typingEngine.handleInput('Backspace');
  app.finishSession(1);
  assert.equal(app.typingEngine.currentIndex, 1);
  assert.equal(StorageManager.getHistory().length, 1);
  assert.equal(app.ui.results.length, 1);
  assert.equal(StorageManager.getBestScore('easy', 1).wpm, 12);
});

test('input at the deadline finishes before an overdue interval callback', () => {
  const app = makeApp();
  app.commitText('a');
  now = 1000;
  app.commitText('b');
  assert.equal(app.typingEngine.currentIndex, 1);
  assert.equal(StorageManager.getHistory().length, 1);
  assert.equal(app.timer.isRunning, false);
});

test('early finish uses the actual timestamp, including fractional seconds', () => {
  const app = makeApp(30);
  app.currentText = 'ab'; app.restartCurrentText();
  app.commitText('a'); now = 1250; app.commitText('b');
  const saved = StorageManager.getHistory()[0];
  assert.equal(saved.timeSpent, 1.25);
  assert.equal(saved.wpm, 19);
  assert.equal(app.ui.results[0].timeSpent, saved.timeSpent);
});

test('delayed countdown ticks clamp elapsed before publishing metrics', () => {
  let tick, completions = 0;
  const timer = new Timer(30, { now: () => now, onTick: (...args) => { tick = args; }, onComplete: () => completions++ });
  timer.start(); now = 31000; timer.tick(); timer.tick();
  assert.deepEqual(tick, [0, 30]);
  assert.equal(completions, 1);
  assert.equal(timer.getElapsedSeconds(), 30);
  timer.reset(); assert.equal(timer.getElapsedSeconds(), 0);
});

test('infinite sessions continue past text exhaustion and save only on Finish', () => {
  const app = makeApp('inf');
  const initial = app.currentText;
  app.commitText(initial[0]); now = 10000; app.commitText(initial.slice(1));
  assert.equal(app.typingEngine.isCompleted, false);
  assert.equal(app.timer.isRunning, true);
  assert.ok(app.typingEngine.targetText.length > initial.length);
  assert.equal(app.typingEngine.getMetrics().correctChars, initial.length);
  assert.equal(StorageManager.getHistory().length, 0);
  document.getElementById('finish-btn').fire('click');
  assert.equal(StorageManager.getHistory().length, 1);
  assert.equal(StorageManager.getHistory()[0].duration, 'inf');
});

test('Ctrl+Enter from results starts a fresh text and resets the session', () => {
  const app = makeApp();
  const previousText = app.currentText;
  app.commitText('a'); now = 1000; app.timer.tick();
  windowEvents.keydown({ key: 'Enter', ctrlKey: true, preventDefault() {} });
  assert.equal(app.ui.getOpenModal(), null);
  assert.equal(app.sessionFinished, false);
  assert.equal(app.typingEngine.currentIndex, 0);
  assert.notEqual(app.currentText, previousText);
  app.commitText('a'); now = 2000; app.timer.tick();
  assert.equal(StorageManager.getHistory().length, 2);
});

test('the icon restart and results restart both generate fresh text', () => {
  const app = makeApp(60);
  const originalGenerator = TextGenerator.generateText;
  let nextText = 0;
  TextGenerator.generateText = () => `fresh text ${++nextText}`;
  try {
    app.commitText('abc');
    app.ui.restartBtn.fire('click');
    assert.equal(app.currentText, 'fresh text 1');
    assert.equal(app.typingEngine.currentIndex, 0);
    assert.equal(app.ui.text, app.currentText);

    app.ui.modal = app.ui.resultsModal;
    app.ui.resultsModal.classList.remove('hidden');
    document.getElementById('res-restart-btn').fire('click');
    assert.equal(app.currentText, 'fresh text 2');
    assert.equal(app.ui.getOpenModal(), null);
    assert.equal(app.typingEngine.currentIndex, 0);
  } finally {
    TextGenerator.generateText = originalGenerator;
  }
});

test('Tab then Enter inside settings does not reset the underlying session', () => {
  const app = makeApp(60);
  app.commitText('abc');
  app.ui.modal = app.ui.customDurModal;
  windowEvents.keydown({ key: 'Tab' });
  windowEvents.keydown({ key: 'Enter', preventDefault() { throw Error('must use native activation'); } });
  app.commitText('def');
  assert.equal(app.typingEngine.currentIndex, 3);
});

test('composition updates count once on commit, including the trailing browser input', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  input.fire('compositionstart');
  for (const [data, index] of [['a', 1], ['ab', 2], ['abc', 3]]) {
    input.fire('input', { data, inputType: 'insertCompositionText', isComposing: true });
    assert.equal(app.typingEngine.currentIndex, index);
  }
  input.fire('keydown', { key: 'a', isComposing: true });
  assert.equal(app.typingEngine.currentIndex, 3);
  input.fire('compositionend', { data: 'abc' });
  input.fire('input', { data: 'abc', inputType: 'insertFromComposition' });
  assert.equal(app.typingEngine.currentIndex, 3);
  assert.equal(app.typingEngine.getMetrics().incorrectChars, 0);
  input.fire('keydown', { key: 'd' });
  input.fire('input', { data: 'd', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 4);
});

test('Thai composition falls back to the textarea value and ignores a data-less trailing input', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  app.currentText = 'กุ้งน้ำ'; app.restartCurrentText();
  input.fire('compositionstart');
  input.value = '\u200bกุ้ง';
  input.fire('compositionend', { data: '' });
  input.fire('input', { data: null, inputType: 'insertFromComposition' });
  assert.equal(app.typingEngine.currentIndex, 'กุ้ง'.length);
  assert.equal(app.typingEngine.getMetrics().correctChars, 'กุ้ง'.length);
  input.fire('input', { data: 'น้ำ', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 'กุ้งน้ำ'.length);
  assert.equal(app.typingEngine.getMetrics().incorrectChars, 0);
});

test('Thai IME can revise a composing vowel without corrupting the character position', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  app.currentText = 'กุ้งต่อ'; app.restartCurrentText();
  input.fire('compositionstart');
  for (const data of ['กุ', 'กู', 'กุ้', 'กุ้ง']) {
    input.fire('input', { data, inputType: 'insertCompositionText', isComposing: true });
  }
  input.fire('compositionend', { data: 'กุ้ง' });
  input.fire('input', { data: 'กุ้ง', inputType: 'insertFromComposition' });
  assert.equal(app.typingEngine.currentIndex, 'กุ้ง'.length);
  assert.equal(app.typingEngine.getMetrics().correctChars, 'กุ้ง'.length);
  assert.equal(app.typingEngine.getMetrics().incorrectChars, 0);
});

test('Thai composition accepts a tone mark before its vowel', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  app.currentText = 'รู้ ต่อ'; app.restartCurrentText();
  input.fire('compositionstart');
  for (const [data, index] of [['ร', 1], ['ร้', 2], ['รู้', 3]]) {
    input.value = `\u200b${data}`;
    input.fire('input', { data, inputType: 'insertCompositionText', isComposing: true });
    assert.equal(app.typingEngine.currentIndex, index);
  }
  input.fire('compositionend', { data: 'รู้' });
  input.fire('input', { data: 'รู้', inputType: 'insertFromComposition' });
  assert.equal(app.typingEngine.getMetrics().correctChars, 3);
  assert.equal(app.typingEngine.getMetrics().incorrectChars, 0);
  assert.deepEqual(app.typingEngine.charStates.slice(0, 3).map(({ state }) => state), ['correct', 'correct', 'correct']);
});

test('fast distinct input events are not dropped; desktop and mobile deletion work', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  input.fire('keydown', { key: 'a' }); input.fire('input', { data: 'a', inputType: 'insertText' });
  input.fire('input', { data: 'b', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 2);
  input.fire('input', { inputType: 'deleteContentBackward' });
  input.fire('keydown', { key: 'Backspace' });
  assert.equal(app.typingEngine.currentIndex, 0);
  assert.equal(input.value, '\u200b');
});

test('input without event.data preserves the first character with or without the sentinel', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  input.value = 'abc';
  input.fire('input', { data: null, inputType: 'insertText' });
  input.value = '\u200bdef';
  input.fire('input', { data: null, inputType: 'insertFromPaste' });
  assert.equal(app.typingEngine.currentIndex, 6);
  assert.equal(app.typingEngine.getMetrics().correctChars, 6);
});

test('invalid custom durations keep the dialog and session intact', () => {
  const app = makeApp(60), input = document.getElementById('custom-duration-input');
  app.commitText('a'); app.ui.modal = app.ui.customDurModal;
  for (const value of ['30abc', '', '0', '1.5', '3601']) {
    input.value = value; app.applyCustomDurationFromModal();
    assert.ok(input.validationMessage);
    assert.equal(app.settings.duration, 60);
    assert.equal(app.typingEngine.currentIndex, 1);
    assert.equal(app.ui.getOpenModal(), app.ui.customDurModal);
  }
  input.value = '45'; app.applyCustomDurationFromModal();
  assert.equal(app.settings.duration, 45);
  assert.equal(app.ui.getOpenModal(), null);
});

test('valid JSON with invalid schemas recovers and accepts new sessions', () => {
  localStorage.setItem('typing_practice_history', 'null');
  localStorage.setItem('typing_practice_best_scores', 'null');
  localStorage.setItem('typing_practice_settings', JSON.stringify({duration: -4, theme:'evil', soundVolume: 4, customColors: {bg:null}}));
  assert.deepEqual(StorageManager.getHistory(), []);
  assert.equal(StorageManager.getBestScore('easy', 1), null);
  assert.equal(StorageManager.getSummaryStats().totalTests, 0);
  assert.equal(StorageManager.getSettings().duration, 60);
  assert.match(StorageManager.getSettings().customColors.bg, /^#[0-9a-f]{6}$/i);
  const app = makeApp(); app.commitText('a'); now = 1000; app.timer.tick();
  assert.equal(StorageManager.getHistory().length, 1);
});

test('history stays bounded while personal best survives beyond the recent window', () => {
  const session = {wpm:200,rawWpm:200,accuracy:100,correctChars:1000,incorrectChars:0,totalChars:1000,duration:60,timeSpent:60,difficulty:'easy'};
  StorageManager.saveSession(session);
  for (let i=0;i<100;i++) StorageManager.saveSession({...session,wpm:50});
  assert.equal(StorageManager.getHistory().length, 100);
  assert.equal(StorageManager.getSummaryStats().bestWpm, 50);
  assert.equal(StorageManager.getBestScore('easy', 60).wpm, 200);
});

test('generator avoids the seeded pool-boundary duplicate', () => {
  const original = Math.random; let seed = 11344;
  Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  try {
    const words = TextGenerator.generateText('medium', 120).toLowerCase().split(' ');
    for (let i=1;i<words.length;i++) assert.notEqual(words[i],words[i-1]);
  } finally { Math.random = original; }
});

test('modal lifecycle transfers focus, isolates background, and restores the trigger', () => {
  const trigger = new Element('trigger'), modal = new Element('modal'), control = new Element('control');
  modal.firstControl = control; trigger.focus();
  const ui = Object.assign(Object.create(UIController.prototype), { modals: [modal], appWrapper: {inert:false} });
  ui.openModal(modal);
  assert.equal(document.activeElement, control);
  assert.equal(ui.appWrapper.inert, true);
  ui.closeModal(modal);
  assert.equal(document.activeElement, trigger);
  assert.equal(ui.appWrapper.inert, false);
});

test('custom light backgrounds choose readable text and presets clear custom overrides', () => {
  const values = new Map();
  document.documentElement = {setAttribute(){},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}};
  const ui = Object.create(UIController.prototype);
  ui.setTheme('custom',{bg:'#ffffff',accent:'#00aa00'});
  assert.equal(values.get('--text-main'),'#000000');
  ui.setTheme('dark');
  assert.equal(values.has('--text-main'),false);
  assert.equal(values.has('--bg-surface'),false);
});

test('language changes persist, reset an active session, and generate Thai text', () => {
  const app = makeApp(60);
  app.commitText('a');
  app.setLanguage('th');
  assert.equal(StorageManager.getSettings().language, 'th');
  assert.equal(app.timer.isRunning, false);
  assert.equal(app.typingEngine.currentIndex, 0);
  assert.match(app.currentText, /[ก-๙]/u);
  assert.equal(StorageManager.getHistory().length, 0);
  const reloaded = makeApp(60);
  assert.equal(reloaded.settings.language, 'th');
  const prevText = app.currentText;
  app.setLanguage('th');
  assert.equal(typeof app.currentText, 'string');
  // Grave accent / tilde language switch key is ignored
  const input = app.ui.hiddenInput;
  input.fire('keydown', { key: '`' });
  input.fire('input', { data: '`', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 0);
  app.setLanguage('en');
  assert.doesNotMatch(app.currentText, /[ก-๙]/u);
});

test('language-switch characters are ignored only when they are not expected', () => {
  const app = makeApp(60), input = app.ui.hiddenInput;
  app.currentText = '~`_a'; app.restartCurrentText();
  input.fire('keydown', { key: '~', code: 'Backquote' });
  input.fire('input', { data: '~', inputType: 'insertText' });
  input.fire('keydown', { key: '`', code: 'Backquote' });
  input.fire('input', { data: '`', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 2);
  const mappedKey = input.fire('keydown', { key: '_', code: 'Backquote' });
  assert.equal(mappedKey.defaultPrevented, undefined);
  input.fire('input', { data: '_', inputType: 'insertText' });
  input.fire('input', { data: 'a', inputType: 'insertText' });
  assert.equal(app.typingEngine.currentIndex, 4);
  assert.equal(app.typingEngine.getMetrics().incorrectChars, 0);
});

test('Thai composition commits each vowel and tone mark once and saves language/CPM', () => {
  const app = makeApp(30);
  app.setLanguage('th');
  app.currentText = 'กุ้ง น้ำ'; app.restartCurrentText();
  const input = app.ui.hiddenInput;
  input.fire('compositionstart');
  for (const [data, index] of [['ก', 1], ['กุ', 2], ['กุ้', 3], ['กุ้ง', 4]]) {
    input.fire('input', { data, inputType: 'insertCompositionText', isComposing: true });
    assert.equal(app.typingEngine.currentIndex, index);
  }
  input.fire('compositionend', { data: 'กุ้ง' });
  input.fire('input', { data: 'กุ้ง', inputType: 'insertFromComposition' });
  now = 10000;
  input.fire('input', { data: ' น้ำ', inputType: 'insertText' });
  const saved = StorageManager.getHistory()[0];
  assert.equal(saved.language, 'th');
  assert.equal(saved.correctChars, 'กุ้ง น้ำ'.length);
  assert.equal(saved.accuracy, 100);
  assert.equal(saved.cpm, 'กุ้ง น้ำ'.length * 6);
  assert.equal(StorageManager.getBestScore('easy', 30, 'en'), null);
  assert.ok(StorageManager.getBestScore('easy', 30, 'th'));
});

test('Thai infinite text extension stays Thai and does not finish automatically', () => {
  const app = makeApp('inf');
  app.setLanguage('th');
  app.currentText = 'บ้าน'; app.restartCurrentText();
  app.commitText('บ้าน');
  assert.equal(app.typingEngine.isCompleted, false);
  assert.equal(app.typingEngine.targetText.slice(0, 5), 'บ้าน ');
  assert.doesNotMatch(app.typingEngine.targetText, /[a-z]/i);
});

test('renderHistory constructs safe DOM nodes without raw HTML injection', () => {
  const ui = Object.create(UIController.prototype);
  const malicious = '<img src=x onerror=alert(1)>';
  ui.renderHistory([{
    wpm: 60,
    accuracy: 98,
    duration: 30,
    difficulty: malicious,
    correctChars: 150,
    incorrectChars: 2,
    timestamp: 1726880000000
  }], { totalTests: 1, avgWpm: 60, avgAccuracy: 98, bestWpm: 60 });

  const list = document.getElementById('history-list');
  assert.equal(list.children.length, 1);
  const item = list.children[0];
  assert.equal(item.className, 'history-item');
  const details = item.children[1];
  const modeSpan = details.children[0];
  assert.equal(modeSpan.textContent, `EN • 30s • ${malicious}`);
});

test('updateCharacterStates efficiently updates targeted range on keystrokes and deletions', () => {
  const ui = Object.create(UIController.prototype);
  const text = 'hello';
  const charElements = text.split('').map(char => {
    const el = new Element('char');
    el.className = 'char pending';
    return el;
  });
  ui.charElements = charElements;
  ui.isSpaceFlags = [false, false, false, false, false];
  ui.appliedClasses = new Array(5).fill('char pending');
  ui.prevIndex = null;
  ui.updateCaretPosition = () => {};

  const charStates = text.split('').map(char => ({ char, state: 'pending' }));

  // Initial update: full sweep
  ui.updateCharacterStates(charStates, 0);
  assert.equal(charElements[0].className, 'char pending active-char');
  assert.equal(charElements[1].className, 'char pending');

  // Type 'h' correctly: narrow window
  charStates[0].state = 'correct';
  ui.updateCharacterStates(charStates, 1);
  assert.equal(charElements[0].className, 'char correct');
  assert.equal(charElements[1].className, 'char pending active-char');
  assert.equal(charElements[2].className, 'char pending');

  // Backspace: narrow window
  charStates[0].state = 'pending';
  ui.updateCharacterStates(charStates, 0);
  assert.equal(charElements[0].className, 'char pending active-char');
  assert.equal(charElements[1].className, 'char pending');
});

test('caret stays at text height while waiting for Space in English and Thai', () => {
  for (const language of ['en', 'th']) {
    const ui = Object.create(UIController.prototype);
    const word = { classList: { contains: () => false }, offsetHeight: 46 };
    const cluster = { classList: { contains: name => name === 'grapheme' }, offsetLeft: 0, offsetTop: 8, offsetWidth: 16, offsetHeight: 34 };
    const makeChar = (parentElement, left, top, width, height) => ({ parentElement, offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height });
    ui.practiceLanguage = language;
    ui.charElements = language === 'th'
      ? [makeChar(cluster, 0, 0, 0, 0), makeChar(cluster, 0, 0, 0, 0), makeChar(word, 16, 22, 10, 0), makeChar(word, 26, 8, 12, 25)]
      : [makeChar(word, 0, 10, 12, 23), makeChar(word, 12, 10, 12, 23), makeChar(word, 24, 21, 10, 0), makeChar(word, 34, 10, 12, 23)];
    ui.isSpaceFlags = [false, false, true, false];
    ui.textDisplay = { querySelector: () => word };
    ui.caret = { style: {} };
    ui.measurePositions();
    assert.equal(ui.charPos[2].top, ui.charPos[1].top, language);
    assert.equal(ui.charPos[2].left, ui.charElements[2].offsetLeft, language);
    assert.equal(ui.charPos[3].top, ui.charPos[2].top, language);
  }
});

test('Thai typed characters get immediate feedback while untyped marks stay muted', () => {
  const text = 'แบ่งบัน กุ้ง น้ำ ปี่ รู้';
  const ui = Object.create(UIController.prototype);
  ui.charElements = [...text].map(() => {
    const el = new Element('char');
    el.className = 'char pending';
    return el;
  });
  ui.isSpaceFlags = [...text].map(char => char === ' ');
  ui.appliedClasses = [...text].map(char => char === ' ' ? 'char char-space pending' : 'char pending');
  ui.graphemeBounds = [];
  ui.prevIndex = null;
  ui.updateCaretPosition = () => {};
  let offset = 0;
  for (const cluster of splitGraphemes(text, 'th')) {
    const end = offset + cluster.length;
    if (cluster !== ' ') {
      const bounds = { start: offset, end };
      if (cluster.length > 1) bounds.feedback = new Element('feedback');
      for (let i = offset; i < end; i++) ui.graphemeBounds[i] = bounds;
    }
    offset = end;
  }

  const states = [...text].map(char => ({ char, state: 'pending' }));
  let index = 0;
  const type = (state = 'correct') => {
    states[index++].state = state;
    ui.updateCharacterStates(states, index);
  };
  const classAt = position => ui.charElements[position].className;
  ui.updateCharacterStates(states, index);

  type(); // แ
  type('incorrect'); // wrong บ, while ่ is still untyped
  assert.match(classAt(1), / pending/);
  assert.equal(ui.graphemeBounds[1].feedback.dataset.typedPrefix, 'บ');
  assert.equal(ui.graphemeBounds[1].feedback.classList.contains('typed-incorrect'), true);
  index--;
  states[index].state = 'pending';
  ui.updateCharacterStates(states, index);
  assert.equal(ui.graphemeBounds[1].feedback.dataset.typedPrefix, '');

  type(); // บ, with ่ still untyped
  assert.match(classAt(0), / correct/);
  assert.match(classAt(1), / pending/);
  assert.match(classAt(2), / pending/);
  assert.equal(ui.graphemeBounds[1].feedback.dataset.typedPrefix, 'บ');
  assert.equal(ui.graphemeBounds[1].feedback.classList.contains('typed-incorrect'), false);
  type(); // ่ completes บ่
  assert.match(classAt(1), / correct/);
  assert.match(classAt(2), / correct/);
  assert.equal(ui.graphemeBounds[1].feedback.dataset.typedPrefix, '');

  while (index < text.indexOf('ก')) type();
  type(); // ก, with ุ้ still untyped
  type(); // ุ, with ้ still untyped
  const ko = text.indexOf('ก');
  assert.match(classAt(ko), / pending/);
  assert.match(classAt(ko + 1), / pending/);
  assert.match(classAt(ko + 2), / pending/);
  assert.equal(ui.graphemeBounds[ko].feedback.dataset.typedPrefix, 'กุ');
  type('incorrect'); // wrong tone mark colors the whole glyph red
  assert.match(classAt(ko), / incorrect/);
  assert.match(classAt(ko + 2), / incorrect/);

  index--;
  states[index].state = 'pending';
  ui.updateCharacterStates(states, index);
  assert.match(classAt(ko), / pending/);
  assert.match(classAt(ko + 2), / pending/);
  assert.equal(ui.graphemeBounds[ko].feedback.dataset.typedPrefix, 'กุ');
  type();
  assert.match(classAt(ko), / correct/);
  assert.match(classAt(ko + 2), / correct/);

  while (index < text.indexOf('น้ำ')) type();
  const nam = text.indexOf('น้ำ');
  type(); // น
  assert.equal(ui.graphemeBounds[nam].feedback.dataset.typedPrefix, 'น');
  type(); // ้
  assert.equal(ui.graphemeBounds[nam].feedback.dataset.typedPrefix, 'น้');
  type(); // ำ
  assert.equal(ui.graphemeBounds[nam].feedback.dataset.typedPrefix, '');

  while (index < text.indexOf('ปี่')) type();
  const pi = text.indexOf('ปี่');
  type(); // ป
  assert.equal(ui.graphemeBounds[pi].feedback.dataset.typedPrefix, 'ป');
  type(); // ี
  assert.equal(ui.graphemeBounds[pi].feedback.dataset.typedPrefix, 'ปี');
  type(); // ่
  assert.equal(ui.graphemeBounds[pi].feedback.dataset.typedPrefix, '');

  while (index < text.indexOf('รู้')) type();
  const ru = text.indexOf('รู้');
  type(); // ร
  states[ru + 2].state = 'correct'; // ้ before ู
  index++;
  ui.updateCharacterStates(states, index);
  assert.equal(ui.graphemeBounds[ru].feedback.dataset.typedPrefix, 'ร้');
  assert.match(classAt(ru + 1), / pending/);
  states[ru + 1].state = 'correct'; // ู completes the grapheme
  index++;
  ui.updateCharacterStates(states, index);
  assert.equal(ui.graphemeBounds[ru].feedback.dataset.typedPrefix, '');
  assert.match(classAt(ru), / correct/);
  assert.match(classAt(ru + 1), / correct/);
  assert.match(classAt(ru + 2), / correct/);

  for (const word of ['น้ำ', 'ปี่']) {
    const start = text.indexOf(word);
    for (let i = start; i < start + 3; i++) assert.match(classAt(i), / correct/);
  }
});
