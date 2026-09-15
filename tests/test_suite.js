import { TextGenerator } from '../js/text-generator.js';
import { TypingEngine } from '../js/typing-engine.js';
import { Timer } from '../js/timer.js';
import { SoundEffects } from '../js/audio.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== 1. Text Variety Verification ===');
const sample1 = TextGenerator.generateText('medium', 30);
const sample2 = TextGenerator.generateText('medium', 30);
assert(sample1.length > 0 && sample2.length > 0, 'Generated text has valid length');
console.log('Sample 1:', sample1.slice(0, 60) + '...');
console.log('Sample 2:', sample2.slice(0, 60) + '...');

const hard1 = TextGenerator.generateText('hard', 60);
assert(/[0-9:;\-—"()]/.test(hard1), 'Hard mode generates rich punctuation, dates, or numbers');

console.log('\n=== 2. Word Deletion (Ctrl + Backspace) Verification ===');
let engine = new TypingEngine();
engine.setText('the quick brown fox');

// Type 'the quick '
const typed = 'the quick ';
for (const ch of typed) engine.handleInput(ch);
assert(engine.currentIndex === 10, 'Typed 10 characters');

// Type a partial word 'bro'
engine.handleInput('b');
engine.handleInput('r');
engine.handleInput('o');
assert(engine.currentIndex === 13, 'Typed "bro", index 13');

// Press Ctrl+Backspace (word deletion)
engine.handleInput('Backspace', true);
assert(engine.currentIndex === 10, `Ctrl+Backspace deleted "bro" back to index 10 (actual: ${engine.currentIndex})`);

// Another Ctrl+Backspace should delete the space and "quick"
engine.handleInput('Backspace', true);
assert(engine.currentIndex === 4, `Ctrl+Backspace deleted "quick " back to index 4 (actual: ${engine.currentIndex})`);

console.log('\n=== 3. Timer and Early Finish Verification ===');
let finished = false;
let completedMetrics = null;

const testEngine = new TypingEngine({
  onFirstKeystroke: () => {},
  onComplete: (metrics) => {
    finished = true;
    completedMetrics = metrics;
  }
});

const shortText = 'fast test';
testEngine.setText(shortText);

for (const ch of shortText) {
  testEngine.handleInput(ch);
}

assert(finished, 'TypingEngine fired onComplete upon finishing text early');
assert(completedMetrics.correctChars === shortText.length, 'All characters marked correct on early finish');

console.log('\n=== 4. Net WPM and Accuracy Formula Accuracy ===');
// Simulating typing 100 characters in 30 seconds (0.5 minutes) with 5 errors
const formulaEngine = new TypingEngine();
formulaEngine.setText('a'.repeat(100));

// Type 95 correct, 5 wrong
for (let i = 0; i < 95; i++) {
  formulaEngine.handleInput('a');
}
for (let i = 0; i < 5; i++) {
  formulaEngine.handleInput('x'); // wrong
}

formulaEngine.setElapsedSeconds(30);
const m = formulaEngine.getMetrics();
// Total keystrokes: 100
// Correct: 95
// Incorrect: 5
// Time: 30s = 0.5min
// Gross WPM: (100 / 5) / 0.5 = 40 WPM
// Net WPM: (95 / 5) / 0.5 = 38 WPM
// Accuracy: 95 / 100 = 95%
assert(m.rawWpm === 40, `Gross WPM is 40 (got ${m.rawWpm})`);
assert(m.wpm === 38, `Net WPM is 38 (got ${m.wpm})`);
assert(m.accuracy === 95, `Accuracy is 95% (got ${m.accuracy}%)`);
assert(m.correctChars === 95, `Correct chars is 95 (got ${m.correctChars})`);
assert(m.incorrectChars === 5, `Incorrect chars is 5 (got ${m.incorrectChars})`);

console.log('\n=== 5. Custom Duration & Infinite (inf) Mode Verification ===');
// Test Timer in 'inf' mode
let tickMode = null;
let tickElapsed = null;
const infTimer = new Timer('inf', {
  onTick: (mode, elapsed) => {
    tickMode = mode;
    tickElapsed = elapsed;
  }
});
assert(infTimer.isInfinite === true, 'Timer recognizes "inf" duration');
assert(infTimer.totalDuration === 'inf', 'Timer totalDuration is "inf"');
infTimer.start();
// Wait 150ms to tick
await new Promise(r => setTimeout(r, 150));
infTimer.stop();
assert(tickMode === 'inf', `Timer ticked with mode "inf" (got ${tickMode})`);
assert(tickElapsed > 0, `Timer recorded elapsed seconds in inf mode (${tickElapsed.toFixed(2)}s)`);

// Test TextGenerator with 'inf'
const infText = TextGenerator.generateText('medium', 'inf');
const infWordCount = infText.split(/\s+/).length;
assert(infWordCount >= 180, `Infinite mode generates long text (got ${infWordCount} words)`);

// Test arbitrary custom seconds
const customText = TextGenerator.generateText('easy', 45);
assert(customText.split(/\s+/).length >= 45, 'Custom 45s generates scaled word count');

console.log('\n=== 6. Randomized Words & Sound Engine Verification ===');
// Verify two consecutive generations produce randomized word orders
const gen1 = TextGenerator.generateText('easy', 30).split(' ').slice(0, 8).join(' ');
const gen2 = TextGenerator.generateText('easy', 30).split(' ').slice(0, 8).join(' ');
assert(gen1 !== gen2, `Word streams are randomized (Run1: "${gen1}" vs Run2: "${gen2}")`);

// Verify sound engine profiles and volume
SoundEffects.setProfile('thock');
assert(SoundEffects.getProfile() === 'thock', 'SoundEffects sets profile to "thock"');

SoundEffects.setVolume(0.65);
assert(Math.abs(SoundEffects.getVolume() - 0.65) < 0.01, 'SoundEffects volume sets correctly (0.65)');

SoundEffects.setMuted(true);
assert(SoundEffects.isMuted() === true, 'SoundEffects mute toggles properly');

console.log(`\n========================================`);
console.log(`All Suite Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
