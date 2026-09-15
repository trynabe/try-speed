// Automated Unit Tests for Typing Engine and Modules
import { TextGenerator } from '../js/text-generator.js';
import { TypingEngine } from '../js/typing-engine.js';
import { Timer } from '../js/timer.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- Testing TextGenerator ---');
const easyText = TextGenerator.generateText('easy', 30);
assert(typeof easyText === 'string' && easyText.length > 20, 'Easy text generates valid string');
const easyWords = easyText.split(' ');
assert(easyWords.length >= 40, `Easy text generated ${easyWords.length} words (expected >= 40)`);

const medText = TextGenerator.generateText('medium', 60);
assert(typeof medText === 'string' && medText.length > 50, 'Medium text generates valid string');

const hardText = TextGenerator.generateText('hard', 120);
assert(typeof hardText === 'string' && hardText.length > 100, 'Hard text generates valid string');

console.log('\n--- Testing TypingEngine ---');
let firstKeystrokeFired = false;
let completedFired = false;

const engine = new TypingEngine({
  onFirstKeystroke: () => { firstKeystrokeFired = true; },
  onComplete: () => { completedFired = true; }
});

const sample = 'hello world';
engine.setText(sample);

assert(engine.charStates.length === sample.length, 'Char states array length matches sample text');
assert(engine.hasStarted === false, 'Initially hasStarted is false');

// Type 'h'
engine.handleInput('h');
assert(firstKeystrokeFired === true, 'First keystroke callback fired');
assert(engine.hasStarted === true, 'Engine hasStarted set to true');
assert(engine.currentIndex === 1, 'Current index incremented to 1');
assert(engine.charStates[0].state === 'correct', 'First character marked correct');

// Type wrong char 'x' instead of 'e'
engine.handleInput('x');
assert(engine.currentIndex === 2, 'Current index incremented to 2');
assert(engine.charStates[1].state === 'incorrect', 'Second character marked incorrect');

// Test Backspace
engine.handleInput('Backspace');
assert(engine.currentIndex === 1, 'Index decremented back to 1 after backspace');
assert(engine.charStates[1].state === 'pending', 'Character reset to pending after backspace');

// Correct the character to 'e'
engine.handleInput('e');
assert(engine.charStates[1].state === 'correct', 'Corrected character marked correct');

// Type rest of text: 'llo world'
const remaining = 'llo world';
for (const ch of remaining) {
  engine.handleInput(ch);
}

assert(completedFired === true, 'Engine fired onComplete when target text completed');
assert(engine.isCompleted === true, 'Engine isCompleted set to true');

// Check metrics
engine.setElapsedSeconds(10); // 10 seconds for 11 chars
const metrics = engine.getMetrics();
console.log('Metrics result:', metrics);
assert(metrics.correctChars === 11, 'All 11 characters are correct');
assert(metrics.incorrectChars === 0, 'No incorrect characters remaining');
assert(metrics.wpm > 0, `Net WPM calculated (${metrics.wpm} WPM)`);
assert(metrics.accuracy > 0 && metrics.accuracy <= 100, `Accuracy is valid (${metrics.accuracy}%)`);

console.log(`\nTests Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
