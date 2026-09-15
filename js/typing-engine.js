/**
 * Typing Engine
 * Handles typing state, character-by-character matching, backspace, accuracy, and WPM.
 */

export class TypingEngine {
  constructor({ onStateChange, onMetricsChange, onFirstKeystroke, onComplete, onSound } = {}) {
    this.targetText = '';
    this.charStates = []; // Array of { char: string, state: 'pending'|'correct'|'incorrect'|'extra' }
    this.currentIndex = 0;
    this.hasStarted = false;
    this.isCompleted = false;

    // Running metric counters
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.incorrectKeystrokes = 0;
    this.elapsedSeconds = 0;

    // Callbacks
    this.onStateChange = onStateChange || (() => {});
    // metrics-only channel: numbers change every tick, the text does not
    this.onMetricsChange = onMetricsChange || this.onStateChange || (() => {});
    this.onFirstKeystroke = onFirstKeystroke || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onSound = onSound || (() => {});
  }

  setText(text) {
    this.targetText = text;
    this.charStates = text.split('').map((char) => ({
      char,
      state: 'pending'
    }));
    this.currentIndex = 0;
    this.hasStarted = false;
    this.isCompleted = false;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.incorrectKeystrokes = 0;
    this.elapsedSeconds = 0;

    this.onStateChange(this.getMetrics());
  }

  setElapsedSeconds(seconds) {
    this.elapsedSeconds = seconds;
    // WPM/accuracy only — do NOT re-touch the character spans here
    this.onMetricsChange(this.getMetrics());
  }

  handleInput(key, ctrlKey = false) {
    if (this.isCompleted) return;

    // Handle Backspace
    if (key === 'Backspace') {
      this.handleBackspace(ctrlKey);
      return;
    }

    // Ignore non-printable modifier keys
    if (key.length > 1) return;

    // First keypress triggers the timer
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.onFirstKeystroke();
    }

    if (this.currentIndex >= this.charStates.length) {
      return;
    }

    const expectedChar = this.charStates[this.currentIndex].char;
    const isCorrect = key === expectedChar;

    this.totalKeystrokes++;
    if (isCorrect) {
      this.correctKeystrokes++;
      this.charStates[this.currentIndex].state = 'correct';
      this.onSound(false);
    } else {
      this.incorrectKeystrokes++;
      this.charStates[this.currentIndex].state = 'incorrect';
      this.onSound(true);
    }

    this.currentIndex++;

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
    if (this.currentIndex === 0) return;

    if (ctrlKey) {
      // Delete whole word back
      // Step back at least one
      let targetIndex = this.currentIndex - 1;
      // Skip trailing spaces if any
      while (targetIndex > 0 && this.charStates[targetIndex].char === ' ') {
        this.charStates[targetIndex].state = 'pending';
        targetIndex--;
      }
      // Delete until space or start
      while (targetIndex >= 0 && this.charStates[targetIndex].char !== ' ') {
        this.charStates[targetIndex].state = 'pending';
        targetIndex--;
      }
      this.currentIndex = Math.max(0, targetIndex + 1);
    } else {
      // Single character backspace
      this.currentIndex--;
      this.charStates[this.currentIndex].state = 'pending';
    }

    this.onStateChange(this.getMetrics());
  }

  getMetrics() {
    let correctChars = 0;
    let incorrectChars = 0;
    let pendingChars = 0;

    for (let i = 0; i < this.charStates.length; i++) {
      const s = this.charStates[i].state;
      if (s === 'correct') correctChars++;
      else if (s === 'incorrect') incorrectChars++;
      else pendingChars++;
    }

    const effectiveTimeMin = Math.max(0.016, this.elapsedSeconds / 60); // min ~1 sec to avoid divide by zero

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
}
