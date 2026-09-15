/**
 * Accurate Countdown / Count-up Timer
 * Supports custom seconds and infinite ('inf') mode.
 * Uses timestamp deltas to prevent setInterval drift.
 */

export class Timer {
  constructor(duration, { onTick, onComplete } = {}) {
    this.isInfinite = duration === 'inf' || duration === Infinity;
    this.totalDuration = this.isInfinite ? 'inf' : Number(duration);
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
    this.isRunning = false;
    this.startTime = null;
    this.timerId = null;
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
  }

  setDuration(duration) {
    this.stop();
    this.isInfinite = duration === 'inf' || duration === Infinity;
    this.totalDuration = this.isInfinite ? 'inf' : Math.max(1, Number(duration));
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now() - (this.elapsedSeconds * 1000);

    this.timerId = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - this.startTime;
      this.elapsedSeconds = elapsedMs / 1000;

      if (this.isInfinite) {
        this.onTick('inf', this.elapsedSeconds);
      } else {
        this.remainingSeconds = Math.max(0, Math.ceil(this.totalDuration - this.elapsedSeconds));
        this.onTick(this.remainingSeconds, this.elapsedSeconds);

        if (this.elapsedSeconds >= this.totalDuration) {
          this.stop();
          this.onComplete(this.totalDuration);
        }
      }
    }, 100);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  reset() {
    this.stop();
    this.remainingSeconds = this.isInfinite ? Infinity : this.totalDuration;
    this.elapsedSeconds = 0;
    this.startTime = null;
    this.onTick(this.isInfinite ? 'inf' : this.remainingSeconds, 0);
  }

  getElapsedSeconds() {
    return Math.max(0.1, this.elapsedSeconds);
  }
}
