/**
 * UI Renderer and View Controller
 * Handles DOM manipulation, character rendering, cursor positioning, modals, and focus states.
 */

export class UIController {
  constructor() {
    // DOM Elements
    this.textDisplay = document.getElementById('text-display');
    this.hiddenInput = document.getElementById('hidden-input');
    this.focusOverlay = document.getElementById('focus-overlay');
    this.timerDisplay = document.getElementById('timer-display');
    this.wpmDisplay = document.getElementById('wpm-display');
    this.accuracyDisplay = document.getElementById('accuracy-display');
    this.correctDisplay = document.getElementById('correct-display');
    this.incorrectDisplay = document.getElementById('incorrect-display');
    this.bestWpmBadge = document.getElementById('best-wpm-badge');

    // Modals
    this.resultsModal = document.getElementById('results-modal');
    this.historyModal = document.getElementById('history-modal');
    this.instructionsModal = document.getElementById('instructions-modal');
    this.themeModal = document.getElementById('theme-modal');
    this.customDurModal = document.getElementById('custom-duration-modal');
    this.soundModal = document.getElementById('sound-modal');

    // Controls
    this.themeBtn = document.getElementById('theme-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.customDurationPill = document.getElementById('custom-duration-pill');
    this.restartBtn = document.getElementById('restart-btn');
    this.newTextBtn = document.getElementById('new-text-btn');

    // Caret element
    this.caret = null;
    this.charElements = [];

    // Render caches — avoid touching the DOM / reading layout on every keystroke
    this.isSpaceFlags = [];
    this.appliedClasses = [];
    this.charPos = [];
    this.linePitch = 0;
    this.scrollTopCache = 0;
    this._blinkTimer = null;

    // Char geometry only changes when the box resizes
    window.addEventListener('resize', () => {
      if (this.charElements.length) this.measurePositions();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (this.charElements.length) this.measurePositions();
      });
    }
  }

  renderText(text) {
    if (!this.textDisplay) return;

    this.charElements = [];
    this.isSpaceFlags = [];
    this.appliedClasses = [];

    // Build off-document: one reflow instead of one per appended node
    const frag = document.createDocumentFragment();

    this.caret = document.createElement('span');
    this.caret.className = 'caret';
    frag.appendChild(this.caret);

    const words = text.split(' ');

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';

      for (let i = 0; i < word.length; i++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char pending';
        charSpan.textContent = word[i];
        wordSpan.appendChild(charSpan);
        this.charElements.push(charSpan);
        this.isSpaceFlags.push(false);
        this.appliedClasses.push('char pending');
      }

      if (w < words.length - 1) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char char-space pending';
        spaceSpan.textContent = ' ';
        wordSpan.appendChild(spaceSpan);
        this.charElements.push(spaceSpan);
        this.isSpaceFlags.push(true);
        this.appliedClasses.push('char char-space pending');
      }

      frag.appendChild(wordSpan);
    }

    this.textDisplay.innerHTML = '';
    this.textDisplay.appendChild(frag);
    this.textDisplay.scrollTop = 0;
    this.scrollTopCache = 0;

    this.measurePositions();
    this.updateCaretPosition(0);
  }

  /**
   * Measure every char once. The text never reflows mid-session, so the caret
   * can read these numbers instead of forcing a layout on every keystroke.
   */
  measurePositions() {
    const n = this.charElements.length;
    this.charPos = new Array(n);

    for (let i = 0; i < n; i++) {
      const el = this.charElements[i];
      this.charPos[i] = {
        left: el.offsetLeft,
        top: el.offsetTop,
        right: el.offsetLeft + el.offsetWidth
      };
    }

    const firstWord = this.textDisplay.querySelector('.word');
    this.linePitch = firstWord ? firstWord.offsetHeight : 42;

    if (this.caret && this.charElements[0]) {
      this.caret.style.height = `${Math.round(this.charElements[0].offsetHeight) || 26}px`;
    }
  }

  updateCharacterStates(charStates, currentIndex) {
    const n = this.charElements.length;

    for (let i = 0; i < n; i++) {
      const stateObj = charStates[i];
      if (!stateObj) continue;

      let cls = this.isSpaceFlags[i] ? 'char char-space' : 'char';

      if (i < currentIndex) {
        cls += stateObj.state === 'correct' ? ' correct' : ' incorrect';
      } else {
        cls += ' pending';
      }

      if (i === currentIndex) cls += ' active-char';

      // Write only the 1-2 chars that actually changed
      if (this.appliedClasses[i] !== cls) {
        this.appliedClasses[i] = cls;
        this.charElements[i].className = cls;
      }
    }

    this.updateCaretPosition(currentIndex);
  }

  updateCaretPosition(index) {
    if (!this.caret || !this.textDisplay) return;
    if (!this.charPos || this.charPos.length === 0) return;

    let left;
    let top;

    if (index >= 0 && index < this.charPos.length) {
      left = this.charPos[index].left;
      top = this.charPos[index].top;
    } else {
      const last = this.charPos[this.charPos.length - 1];
      left = last.right;
      top = last.top;
    }

    const pitch = this.linePitch || 42;
    const currentLineIndex = Math.max(0, Math.round(top / pitch));
    const targetScrollTop = currentLineIndex >= 2 ? (currentLineIndex - 1) * pitch : 0;

    // Write-only: never read scrollTop back, that would force a reflow
    if (this.scrollTopCache !== targetScrollTop) {
      this.scrollTopCache = targetScrollTop;
      this.textDisplay.scrollTop = targetScrollTop;
    }

    // transform is compositor-only; left/top would relayout every keystroke
    this.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;

    this.markTyping();
  }

  /** Freeze the blink while keys are coming in — blinking mid-word reads as lag. */
  markTyping() {
    if (!this.caret) return;
    this.caret.classList.add('typing');
    clearTimeout(this._blinkTimer);
    this._blinkTimer = setTimeout(() => {
      if (this.caret) this.caret.classList.remove('typing');
    }, 700);
  }

  updateLiveMetrics({ wpm, accuracy, correctChars, incorrectChars }) {
    if (this.wpmDisplay) this.wpmDisplay.textContent = wpm;
    if (this.accuracyDisplay) this.accuracyDisplay.textContent = `${accuracy}%`;
    if (this.correctDisplay) this.correctDisplay.textContent = correctChars;
    if (this.incorrectDisplay) this.incorrectDisplay.textContent = incorrectChars;
  }

  updateTimer(remainingOrMode, elapsedSeconds = 0) {
    if (!this.timerDisplay) return;

    if (remainingOrMode === 'inf') {
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = Math.floor(elapsedSeconds % 60);
      this.timerDisplay.textContent = `∞ ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      this.timerDisplay.classList.remove('urgent');
      return;
    }

    const remainingSeconds = Number(remainingOrMode);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    this.timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    // Urgency pulse when <= 5 seconds
    if (remainingSeconds <= 5 && remainingSeconds > 0) {
      this.timerDisplay.classList.add('urgent');
    } else {
      this.timerDisplay.classList.remove('urgent');
    }
  }

  showFocusOverlay(show) {
    if (!this.focusOverlay) return;
    if (show) {
      this.focusOverlay.classList.remove('hidden');
    } else {
      this.focusOverlay.classList.add('hidden');
    }
  }

  updateBestBadge(bestScore) {
    if (!this.bestWpmBadge) return;
    if (bestScore && bestScore.wpm > 0) {
      this.bestWpmBadge.textContent = `${bestScore.wpm} WPM (${bestScore.accuracy}%)`;
    } else {
      this.bestWpmBadge.textContent = '--';
    }
  }

  showResultsModal(sessionData, isNewBest = false) {
    if (!this.resultsModal) return;

    document.getElementById('res-wpm').textContent = sessionData.wpm;
    document.getElementById('res-raw-wpm').textContent = sessionData.rawWpm;
    document.getElementById('res-accuracy').textContent = `${sessionData.accuracy}%`;
    document.getElementById('res-correct').textContent = sessionData.correctChars;
    document.getElementById('res-incorrect').textContent = sessionData.incorrectChars;
    document.getElementById('res-time').textContent = `${sessionData.timeSpent}s`;

    const errorRateEl = document.getElementById('res-error-rate');
    if (errorRateEl) {
      errorRateEl.textContent = `${Math.max(0, 100 - sessionData.accuracy)}%`;
    }

    // Performance Badge Title
    const badgeEl = document.getElementById('res-badge');
    if (badgeEl) {
      if (sessionData.wpm >= 90) {
        badgeEl.textContent = '🚀 Grandmaster Speed';
        badgeEl.className = 'res-badge badge-grandmaster';
      } else if (sessionData.wpm >= 70) {
        badgeEl.textContent = '⚡ Speed Demon';
        badgeEl.className = 'res-badge badge-expert';
      } else if (sessionData.wpm >= 50) {
        badgeEl.textContent = '🔥 Fast & Accurate';
        badgeEl.className = 'res-badge badge-advanced';
      } else if (sessionData.wpm >= 30) {
        badgeEl.textContent = '🎯 Solid Typist';
        badgeEl.className = 'res-badge badge-intermediate';
      } else {
        badgeEl.textContent = '🌱 Keep Practicing';
        badgeEl.className = 'res-badge badge-novice';
      }
    }

    const newBestNotice = document.getElementById('res-new-best');
    if (newBestNotice) {
      if (isNewBest) {
        newBestNotice.classList.remove('hidden');
      } else {
        newBestNotice.classList.add('hidden');
      }
    }

    this.resultsModal.classList.remove('hidden');
  }

  hideResultsModal() {
    if (this.resultsModal) {
      this.resultsModal.classList.add('hidden');
    }
  }

  renderHistory(historyList, statsSummary) {
    const listEl = document.getElementById('history-list');
    const totalTestsEl = document.getElementById('hist-total-tests');
    const avgWpmEl = document.getElementById('hist-avg-wpm');
    const avgAccEl = document.getElementById('hist-avg-acc');
    const bestWpmEl = document.getElementById('hist-best-wpm');

    if (statsSummary) {
      if (totalTestsEl) totalTestsEl.textContent = statsSummary.totalTests;
      if (avgWpmEl) avgWpmEl.textContent = statsSummary.avgWpm;
      if (avgAccEl) avgAccEl.textContent = `${statsSummary.avgAccuracy}%`;
      if (bestWpmEl) bestWpmEl.textContent = statsSummary.bestWpm;
    }

    if (!listEl) return;

    if (!historyList || historyList.length === 0) {
      listEl.innerHTML = '<div class="empty-history">No typing sessions recorded yet. Complete a session to see your progress!</div>';
      return;
    }

    listEl.innerHTML = historyList.map(item => {
      const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <div class="history-item">
          <div class="hist-col-main">
            <span class="hist-wpm">${item.wpm} <small>WPM</small></span>
            <span class="hist-acc">${item.accuracy}% acc</span>
          </div>
          <div class="hist-col-details">
            <span class="hist-mode">${item.duration}s • ${item.difficulty}</span>
            <span class="hist-chars">${item.correctChars}✓ / ${item.incorrectChars}✗</span>
          </div>
          <div class="hist-col-date">${dateStr}</div>
        </div>
      `;
    }).join('');
  }

  openHistoryModal() {
    if (this.historyModal) this.historyModal.classList.remove('hidden');
  }

  closeHistoryModal() {
    if (this.historyModal) this.historyModal.classList.add('hidden');
  }

  openInstructionsModal() {
    if (this.instructionsModal) this.instructionsModal.classList.remove('hidden');
  }

  closeInstructionsModal() {
    if (this.instructionsModal) this.instructionsModal.classList.add('hidden');
  }

  openThemeModal() {
    if (this.themeModal) this.themeModal.classList.remove('hidden');
  }

  closeThemeModal() {
    if (this.themeModal) this.themeModal.classList.add('hidden');
  }

  openCustomDurModal() {
    if (this.customDurModal) this.customDurModal.classList.remove('hidden');
  }

  closeCustomDurModal() {
    if (this.customDurModal) this.customDurModal.classList.add('hidden');
  }

  updateCustomDurationPill(duration) {
    if (!this.customDurationPill) return;
    if (duration === 'inf' || duration === Infinity) {
      this.customDurationPill.textContent = '∞ inf';
      this.customDurationPill.classList.add('active');
    } else if ([30, 60, 120].includes(Number(duration))) {
      this.customDurationPill.textContent = 'Custom';
      this.customDurationPill.classList.remove('active');
    } else {
      this.customDurationPill.textContent = `${duration}s`;
      this.customDurationPill.classList.add('active');
    }
  }

  setTheme(themeName, customColors = null) {
    document.documentElement.setAttribute('data-theme', themeName);

    // Update active state on preset cards
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.themeName === themeName);
    });

    if (themeName === 'custom' && customColors) {
      document.documentElement.style.setProperty('--accent', customColors.accent);
      document.documentElement.style.setProperty('--caret-color', customColors.accent);
      document.documentElement.style.setProperty('--accent-hover', customColors.accent);
      document.documentElement.style.setProperty('--accent-light', customColors.accent + '26');
      document.documentElement.style.setProperty('--bg-primary', customColors.bg);
      document.documentElement.style.setProperty('--bg-secondary', this.adjustColor(customColors.bg, 14));
      document.documentElement.style.setProperty('--bg-tertiary', this.adjustColor(customColors.bg, 24));
    } else {
      ['--accent', '--caret-color', '--accent-hover', '--accent-light', '--bg-primary', '--bg-secondary', '--bg-tertiary'].forEach(prop => {
        document.documentElement.style.removeProperty(prop);
      });
    }
  }

  adjustColor(hex, percent) {
    let num = parseInt(hex.replace('#', ''), 16);
    if (isNaN(num)) return '#222328';
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  openSoundModal() {
    if (this.soundModal) this.soundModal.classList.remove('hidden');
  }

  closeSoundModal() {
    if (this.soundModal) this.soundModal.classList.add('hidden');
  }

  updateSoundProfileUI(activeProfile, customName = '') {
    document.querySelectorAll('.sound-card').forEach(card => {
      card.classList.toggle('active', card.dataset.profile === activeProfile);
    });

    const customDesc = document.getElementById('custom-sound-desc');
    const customStatus = document.getElementById('custom-file-status');
    const customFilename = document.getElementById('custom-filename');

    if (customName) {
      if (customDesc) customDesc.textContent = customName;
      if (customStatus) customStatus.classList.remove('hidden');
      if (customFilename) customFilename.textContent = customName;
    } else {
      if (customDesc) customDesc.textContent = 'Upload your sound';
      if (customStatus) customStatus.classList.add('hidden');
    }
  }

  updateSoundVolumeUI(volume) {
    const slider = document.getElementById('sound-volume-slider');
    const label = document.getElementById('volume-val-label');
    const pct = Math.round(volume * 100);
    if (slider) slider.value = pct;
    if (label) label.textContent = `${pct}%`;
  }

  setSoundState(isEnabled) {
    if (this.soundBtn) {
      this.soundBtn.classList.toggle('active', isEnabled);
      this.soundBtn.setAttribute('aria-label', isEnabled ? 'Sound enabled' : 'Sound muted');
      this.soundBtn.innerHTML = isEnabled
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    }

    const modalToggleBtn = document.getElementById('modal-sound-toggle-btn');
    if (modalToggleBtn) {
      modalToggleBtn.textContent = isEnabled ? 'Active (ON)' : 'Muted (OFF)';
      modalToggleBtn.className = isEnabled ? 'btn btn-primary' : 'btn btn-secondary';
    }
  }
}
