/**
 * Accurate Countdown / Count-up Timer
 * Supports custom seconds and infinite ('inf') mode.
 * Uses timestamp deltas to prevent setInterval drift.
 */

export class Timer {
  constructor(duration, { onTick, onComplete, now = () => performance.now() } = {}) {
    this.now = now;
    this.isInfinite = duration === 'inf' || duration === Infinity;
    const seconds = Number(duration);
    this.totalDuration = this.isInfinite ? 'inf' : (Number.isFinite(seconds) ? Math.max(1, seconds) : 60);
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
    this.isRunning = false;
    this.startTime = null;
    this.timerId = null;
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
    this.isCompleted = false;
  }

  setDuration(duration) {
    this.stop();
    this.isInfinite = duration === 'inf' || duration === Infinity;
    const seconds = Number(duration);
    this.totalDuration = this.isInfinite ? 'inf' : (Number.isFinite(seconds) ? Math.max(1, seconds) : 60);
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
    this.startTime = null;
    this.isCompleted = false;
  }

  start() {
    if (this.isRunning || this.isCompleted) return;
    this.isRunning = true;
    this.startTime = this.now() - (this.elapsedSeconds * 1000);

    this.timerId = setInterval(() => this.tick(), 100);
  }

  tick() {
    if (!this.isRunning) return;
    this.elapsedSeconds = this.getElapsedSeconds();
    this.remainingSeconds = this.isInfinite ? Infinity : Math.max(0, Math.ceil(this.totalDuration - this.elapsedSeconds));
    const finished = !this.isInfinite && this.elapsedSeconds >= this.totalDuration;
    if (finished) {
      this.stop();
      this.isCompleted = true;
    }
    this.onTick(this.isInfinite ? 'inf' : this.remainingSeconds, this.elapsedSeconds);
    if (finished) this.onComplete(this.elapsedSeconds);
  }

  stop() {
    if (this.isRunning) this.elapsedSeconds = this.getElapsedSeconds();
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    return this.elapsedSeconds;
  }

  reset() {
    this.stop();
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
    this.startTime = null;
    this.isCompleted = false;
    this.onTick(this.isInfinite ? 'inf' : this.remainingSeconds, 0);
  }

  getElapsedSeconds() {
    const elapsed = this.isRunning ? Math.max(0, (this.now() - this.startTime) / 1000) : this.elapsedSeconds;
    return this.isInfinite ? elapsed : Math.min(this.totalDuration, elapsed);
  }
}
