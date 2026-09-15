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
  }

  renderText(text) {
    if (!this.textDisplay) return;
    this.textDisplay.innerHTML = '';
    this.charElements = [];

    // Create caret
    this.caret = document.createElement('span');
    this.caret.className = 'caret';
    this.textDisplay.appendChild(this.caret);

    // Split into words to prevent unnatural mid-word line wrapping
    const words = text.split(' ');
    let charGlobalIndex = 0;
    this.textDisplay.scrollTop = 0;

    words.forEach((word, wIdx) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';

      for (let i = 0; i < word.length; i++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char pending';
        charSpan.textContent = word[i];
        charSpan.dataset.index = charGlobalIndex;
        wordSpan.appendChild(charSpan);
        this.charElements.push(charSpan);
        charGlobalIndex++;
      }

      // Add trailing space inside wordSpan (except after the last word)
      if (wIdx < words.length - 1) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char char-space pending';
        spaceSpan.textContent = ' ';
        spaceSpan.dataset.index = charGlobalIndex;
        wordSpan.appendChild(spaceSpan);
        this.charElements.push(spaceSpan);
        charGlobalIndex++;
      }

      this.textDisplay.appendChild(wordSpan);
    });

    this.updateCaretPosition(0);
  }

  updateCharacterStates(charStates, currentIndex) {
    for (let i = 0; i < this.charElements.length; i++) {
      const el = this.charElements[i];
      const stateObj = charStates[i];

      if (!stateObj) continue;

      let cls = 'char';
      if (el.classList.contains('char-space')) {
        cls += ' char-space';
      }

      if (i < currentIndex) {
        cls += stateObj.state === 'correct' ? ' correct' : ' incorrect';
      } else {
        cls += ' pending';
      }

      if (i === currentIndex) {
        cls += ' active-char';
      }

      el.className = cls;
    }

    this.updateCaretPosition(currentIndex);
  }

  updateCaretPosition(index) {
    if (!this.caret || !this.textDisplay) return;

    if (index >= 0 && index < this.charElements.length) {
      const targetChar = this.charElements[index];
      const displayRect = this.textDisplay.getBoundingClientRect();
      const charRect = targetChar.getBoundingClientRect();

      const left = charRect.left - displayRect.left;
      const top = (charRect.top - displayRect.top) + this.textDisplay.scrollTop;

      this.caret.style.left = `${left}px`;
      this.caret.style.top = `${top}px`;
      this.caret.style.height = `${Math.round(charRect.height) || 26}px`;

      // Measure line pitch dynamically from the word element
      const firstWord = this.textDisplay.querySelector('.word');
      const linePitch = firstWord ? firstWord.offsetHeight : 42;

      // Determine current line (0-indexed)
      const currentLineIndex = Math.max(0, Math.floor((top + 5) / linePitch));

      // Keep active line centered on middle line of 3-line viewport
      const targetScrollTop = currentLineIndex >= 2 ? (currentLineIndex - 1) * linePitch : 0;

      if (Math.abs(this.textDisplay.scrollTop - targetScrollTop) > 1) {
        this.textDisplay.scrollTop = targetScrollTop;
      }
    } else if (this.charElements.length > 0 && index >= this.charElements.length) {
      // Position caret at end of last char
      const lastChar = this.charElements[this.charElements.length - 1];
      const displayRect = this.textDisplay.getBoundingClientRect();
      const charRect = lastChar.getBoundingClientRect();

      this.caret.style.left = `${charRect.right - displayRect.left}px`;
      this.caret.style.top = `${(charRect.top - displayRect.top) + this.textDisplay.scrollTop}px`;
    }
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
