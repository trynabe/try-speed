/**
 * Typing Engine
 * Handles typing state, character-by-character matching, backspace, accuracy, and WPM.
 */

import { splitGraphemes } from './text-layout.js';

export class TypingEngine {
  constructor({ onStateChange, onMetricsChange, onFirstKeystroke, onComplete, onSound, beforeInput, onTextExhausted } = {}) {
    this.targetText = '';
    this.charStates = []; // Array of { char: string, state: 'pending'|'correct'|'incorrect'|'extra' }
    this.graphemeBounds = [];
    this.inputHistory = [];
    this.isThai = false;
    this.currentIndex = 0;
    this.hasStarted = false;
    this.isCompleted = false;

    // Running metric counters
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.incorrectKeystrokes = 0;
    this.correctCharsCount = 0;
    this.incorrectCharsCount = 0;
    this.elapsedSeconds = 0;

    // Callbacks
    this.onStateChange = onStateChange || (() => {});
    // metrics-only channel: numbers change every tick, the text does not
    this.onMetricsChange = onMetricsChange || this.onStateChange || (() => {});
    this.onFirstKeystroke = onFirstKeystroke || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onSound = onSound || (() => {});
    this.beforeInput = beforeInput || (() => true);
    this.onTextExhausted = onTextExhausted || (() => {});
  }

  setText(text) {
    this.targetText = text;
    this.charStates = text.split('').map((char) => ({
      char,
      state: 'pending'
    }));
    this.isThai = /[\u0e00-\u0e7f]/u.test(text);
    this.graphemeBounds = [];
    if (this.isThai) this.appendGraphemeBounds(text, 0);
    this.inputHistory = [];
    this.currentIndex = 0;
    this.hasStarted = false;
    this.isCompleted = false;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.incorrectKeystrokes = 0;
    this.correctCharsCount = 0;
    this.incorrectCharsCount = 0;
    this.elapsedSeconds = 0;

    this.onStateChange(this.getMetrics());
  }

  setElapsedSeconds(seconds) {
    this.elapsedSeconds = seconds;
    // WPM/accuracy only — do NOT re-touch the character spans here
    this.onMetricsChange(this.getMetrics());
  }

  handleInput(key, ctrlKey = false) {
    if (this.isCompleted || !this.beforeInput()) return;

    // Handle Backspace
    if (key === 'Backspace') {
      this.handleBackspace(ctrlKey);
      return;
    }

    // Ignore non-printable modifier keys
    if (typeof key !== 'string' || key.length !== 1) return;

    // First keypress triggers the timer
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.onFirstKeystroke();
    }

    if (this.currentIndex >= this.charStates.length) {
      return;
    }

    const targetIndex = this.getTargetIndex(key);
    const isCorrect = key === this.charStates[targetIndex].char;

    this.totalKeystrokes++;
    if (isCorrect) {
      this.correctKeystrokes++;
      this.correctCharsCount++;
      this.charStates[targetIndex].state = 'correct';
      this.onSound(false);
    } else {
      this.incorrectKeystrokes++;
      this.incorrectCharsCount++;
      this.charStates[targetIndex].state = 'incorrect';
      this.onSound(true);
    }

    this.inputHistory.push(targetIndex);
    this.currentIndex++;

    // Infinite sessions may append another chunk without resetting counters.
    if (this.currentIndex >= this.charStates.length) this.onTextExhausted();
    // Check if test is completed
    if (this.currentIndex >= this.charStates.length) {
      this.isCompleted = true;
      this.onStateChange(this.getMetrics());
      this.onComplete(this.getMetrics());
      return;
    }

    this.onStateChange(this.getMetrics());
  }

  handleBackspace(ctrlKey = false) {
    if (this.isCompleted || this.currentIndex === 0) return;

    if (ctrlKey) {
      // Undo the actual input order so swapped Thai marks return to pending.
      while (this.inputHistory.length && this.charStates[this.inputHistory.at(-1)].char === ' ') {
        this.undoLastInput();
      }
      while (this.inputHistory.length && this.charStates[this.inputHistory.at(-1)].char !== ' ') {
        this.undoLastInput();
      }
    } else {
      this.undoLastInput();
    }

    this.onStateChange(this.getMetrics());
  }

  getMetrics() {
    const correctChars = this.correctCharsCount;
    const incorrectChars = this.incorrectCharsCount;
    const pendingChars = Math.max(0, this.charStates.length - this.currentIndex);

    const effectiveTimeMin = Math.max(Number.EPSILON, this.elapsedSeconds / 60);

    // Standard Gross WPM: (all typed characters / 5) / time in min
    const grossWpm = this.elapsedSeconds > 0
      ? Math.max(0, (this.totalKeystrokes / 5) / effectiveTimeMin)
      : 0;

    // Net WPM: (correct characters / 5) / time in min
    const netWpm = this.elapsedSeconds > 0
      ? Math.max(0, (correctChars / 5) / effectiveTimeMin)
      : 0;

    // Accuracy: ratio of correct keystrokes to total keystrokes
    const accuracy = this.totalKeystrokes > 0
      ? Math.max(0, Math.min(100, (this.correctKeystrokes / this.totalKeystrokes) * 100))
      : 100;

    const progress = this.charStates.length > 0
      ? Math.min(100, Math.round((this.currentIndex / this.charStates.length) * 100))
      : 0;

    return {
      wpm: Math.round(netWpm),
      rawWpm: Math.round(grossWpm),
      cpm: Math.round(netWpm * 5),
      rawCpm: Math.round(grossWpm * 5),
      accuracy: Math.round(accuracy),
      correctChars,
      incorrectChars,
      pendingChars,
      totalChars: this.charStates.length,
      currentIndex: this.currentIndex,
      totalKeystrokes: this.totalKeystrokes,
      elapsedSeconds: this.elapsedSeconds,
      progress,
      isCompleted: this.isCompleted
    };
  }

  reset() {
    this.setText(this.targetText);
  }

  appendText(text) {
    if (this.isCompleted) return;
    const start = this.charStates.length;
    this.targetText += text;
    this.charStates.push(...text.split('').map(char => ({ char, state: 'pending' })));
    if (this.isThai) this.appendGraphemeBounds(text, start);
  }

  appendGraphemeBounds(text, offset) {
    for (const cluster of splitGraphemes(text, 'th')) {
      const end = offset + cluster.length;
      if (cluster.length > 1) {
        const bounds = { start: offset, end };
        for (let i = offset; i < end; i++) this.graphemeBounds[i] = bounds;
      }
      offset = end;
    }
  }

  getTargetIndex(key) {
    const bounds = this.graphemeBounds[this.currentIndex];
    if (!bounds || this.currentIndex === bounds.start) return this.currentIndex;

    // After the base letter, Thai combining marks in the same grapheme may
    // arrive in either order. Match an untyped target mark before assigning an error.
    for (let i = bounds.start + 1; i < bounds.end; i++) {
      if (this.charStates[i].state === 'pending' && this.charStates[i].char === key) return i;
    }
    for (let i = bounds.start + 1; i < bounds.end; i++) {
      if (this.charStates[i].state === 'pending') return i;
    }
    return this.currentIndex;
  }

  undoLastInput() {
    const targetIndex = this.inputHistory.pop();
    if (targetIndex === undefined) return;
    const prev = this.charStates[targetIndex].state;
    if (prev === 'correct') this.correctCharsCount--;
    else if (prev === 'incorrect') this.incorrectCharsCount--;
    this.charStates[targetIndex].state = 'pending';
    this.currentIndex--;
  }

  finish(seconds) {
    this.isCompleted = true;
    this.setElapsedSeconds(seconds);
    this.onStateChange(this.getMetrics());
  }
}
