/**
 * UI Renderer and View Controller
 * Handles DOM manipulation, character rendering, cursor positioning, modals, and focus states.
 */

import { splitGraphemes } from './text-layout.js';

export class UIController {
  constructor() {
    // DOM Elements
    this.textDisplay = document.getElementById('text-display');
    this.hiddenInput = document.getElementById('hidden-input');
    this.focusOverlay = document.getElementById('focus-overlay');
    this.timerDisplay = document.getElementById('timer-display');
    this.wpmDisplay = document.getElementById('wpm-display');
    this.cpmDisplay = document.getElementById('cpm-display');
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
    this.modals = [this.resultsModal, this.historyModal, this.instructionsModal, this.themeModal, this.customDurModal, this.soundModal].filter(Boolean);
    this.appWrapper = document.querySelector('.app-wrapper');
    this.modals.forEach(modal => {
      modal.tabIndex = -1;
      modal.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="file"]), [tabindex="0"]')]
          .filter(el => el.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); modal.focus(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
          e.preventDefault(); first.focus();
        }
      });
    });

    // Controls
    this.themeBtn = document.getElementById('theme-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.customDurationPill = document.getElementById('custom-duration-pill');
    this.restartBtn = document.getElementById('restart-btn');
    this.newTextBtn = document.getElementById('new-text-btn');
    this.finishBtn = document.getElementById('finish-btn');

    // Caret element
    this.caret = null;
    this.charElements = [];

    // Render caches — avoid touching the DOM / reading layout on every keystroke
    this.isSpaceFlags = [];
    this.appliedClasses = [];
    this.charPos = [];
    this.prevIndex = null;
    this.linePitch = 0;
    this.scrollTopCache = 0;
    this._blinkTimer = null;

    // Char geometry only changes when the box resizes
    window.addEventListener('resize', () => {
      if (this.charElements.length) this.measurePositions();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.addEventListener('loadingdone', () => {
        if (this.charElements.length) {
          this.measurePositions();
          this.updateCaretPosition(this.caretIndex || 0);
        }
      });
      document.fonts.ready.then(() => {
        if (this.charElements.length) {
          this.measurePositions();
          this.updateCaretPosition(this.caretIndex || 0);
        }
      });
    }
  }

  renderText(text) {
    if (!this.textDisplay) return;

    this.charElements = [];
    this.isSpaceFlags = [];
    this.appliedClasses = [];
    this.prevIndex = null;

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

      const clusters = this.practiceLanguage === 'th' ? splitGraphemes(word, 'th') : word.split('');
      for (const cluster of clusters) {
        const container = this.practiceLanguage === 'th' ? document.createElement('span') : wordSpan;
        if (container !== wordSpan) {
          container.className = 'grapheme';
          wordSpan.appendChild(container);
        }
        for (const char of cluster.split('')) {
          const charSpan = document.createElement('span');
          charSpan.className = 'char pending';
          charSpan.textContent = char;
          container.appendChild(charSpan);
          this.charElements.push(charSpan);
          this.isSpaceFlags.push(false);
          this.appliedClasses.push('char pending');
        }
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
    this.textDisplay.style.scrollBehavior = 'auto';
    this.textDisplay.scrollTop = 0;
    this.scrollTopCache = 0;
    this.lastCaretTop = undefined;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        if (this.textDisplay) this.textDisplay.style.scrollBehavior = '';
      });
    }

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
      const cluster = el.parentElement.classList.contains('grapheme') ? el.parentElement : null;
      const geometry = cluster || el;
      const insideCluster = cluster && this.charElements[i - 1]?.parentElement === cluster;
      this.charPos[i] = {
        left: geometry.offsetLeft + (insideCluster ? geometry.offsetWidth : 0),
        top: geometry.offsetTop,
        right: geometry.offsetLeft + geometry.offsetWidth
      };
    }

    const firstWord = this.textDisplay.querySelector('.word');
    this.linePitch = firstWord ? firstWord.offsetHeight : 42;

    if (this.caret && this.charElements[0]) {
      const first = this.practiceLanguage === 'th' ? this.charElements[0].parentElement : this.charElements[0];
      this.caret.style.height = `${Math.round(first.offsetHeight) || 26}px`;
    }
  }

  updateCharacterStates(charStates, currentIndex) {
    const n = this.charElements.length;
    if (n === 0) return;

    let start = 0;
    let end = n - 1;

    // Narrow scan range when progressing incrementally to prevent typing lag in long/inf sessions
    if (this.prevIndex !== null && typeof this.prevIndex === 'number') {
      start = Math.max(0, Math.min(this.prevIndex, currentIndex) - 2);
      end = Math.min(n - 1, Math.max(this.prevIndex, currentIndex) + 2);
    }
    this.prevIndex = currentIndex;

    for (let i = start; i <= end; i++) {
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
    this.caretIndex = index;
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

    // Snap instantly on line changes so caret does not glide diagonally across the screen
    const lineChanged = this.lastCaretTop !== undefined && this.lastCaretTop !== top;
    this.lastCaretTop = top;

    if (lineChanged) {
      this.caret.style.transition = 'none';
      this.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (this.caret) this.caret.style.transition = '';
        });
      }
    } else {
      this.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }

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

  updateLiveMetrics({ wpm, cpm = 0, accuracy, correctChars, incorrectChars }) {
    if (typeof requestAnimationFrame === 'undefined') {
      if (this.wpmDisplay) this.wpmDisplay.textContent = wpm;
      if (this.cpmDisplay) this.cpmDisplay.textContent = cpm;
      if (this.accuracyDisplay) this.accuracyDisplay.textContent = `${accuracy}%`;
      if (this.correctDisplay) this.correctDisplay.textContent = correctChars;
      if (this.incorrectDisplay) this.incorrectDisplay.textContent = incorrectChars;
      return;
    }

    this._pendingMetrics = { wpm, cpm, accuracy, correctChars, incorrectChars };
    if (this._metricsRaf) return;
    this._metricsRaf = requestAnimationFrame(() => {
      this._metricsRaf = null;
      const m = this._pendingMetrics;
      if (!m) return;
      if (this.cpmDisplay && this.cpmDisplay.textContent !== String(m.cpm)) this.cpmDisplay.textContent = m.cpm;
      if (this.wpmDisplay && this.wpmDisplay.textContent !== String(m.wpm)) {
        this.wpmDisplay.textContent = m.wpm;
      }
      if (this.accuracyDisplay) {
        const accStr = `${m.accuracy}%`;
        if (this.accuracyDisplay.textContent !== accStr) this.accuracyDisplay.textContent = accStr;
      }
      if (this.correctDisplay && this.correctDisplay.textContent !== String(m.correctChars)) {
        this.correctDisplay.textContent = m.correctChars;
      }
      if (this.incorrectDisplay && this.incorrectDisplay.textContent !== String(m.incorrectChars)) {
        this.incorrectDisplay.textContent = m.incorrectChars;
      }
    });
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
    document.getElementById('res-cpm').textContent = sessionData.cpm;
    document.getElementById('res-language').textContent = sessionData.language === 'th' ? 'TH · ภาษาไทย' : 'EN · English';
    document.getElementById('res-raw-wpm').textContent = sessionData.rawWpm;
    document.getElementById('res-accuracy').textContent = `${sessionData.accuracy}%`;
    document.getElementById('res-correct').textContent = sessionData.correctChars;
    document.getElementById('res-incorrect').textContent = sessionData.incorrectChars;
    document.getElementById('res-time').textContent = `${Number(sessionData.timeSpent.toFixed(2))}s`;

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

    this.openModal(this.resultsModal);
  }

  hideResultsModal() {
    this.closeModal(this.resultsModal);
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
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-history';
      emptyDiv.textContent = 'No typing sessions recorded yet. Complete a session to see your progress!';
      listEl.innerHTML = '';
      listEl.appendChild(emptyDiv);
      return;
    }

    const items = historyList.map(item => {
      const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

      const colMain = document.createElement('div');
      colMain.className = 'hist-col-main';

      const wpmSpan = document.createElement('span');
      wpmSpan.className = 'hist-wpm';
      wpmSpan.textContent = `${item.wpm} `;
      const smallWpm = document.createElement('small');
      smallWpm.textContent = 'WPM';
      wpmSpan.appendChild(smallWpm);

      const accSpan = document.createElement('span');
      accSpan.className = 'hist-acc';
      accSpan.textContent = `${item.accuracy}% acc · ${item.cpm ?? 0} CPM`;

      colMain.append(wpmSpan, accSpan);

      const colDetails = document.createElement('div');
      colDetails.className = 'hist-col-details';

      const modeSpan = document.createElement('span');
      modeSpan.className = 'hist-mode';
      modeSpan.textContent = `${item.language === 'th' ? 'TH' : 'EN'} • ${item.duration === 'inf' ? '∞ Zen' : `${item.duration}s`} • ${item.difficulty}`;

      const charsSpan = document.createElement('span');
      charsSpan.className = 'hist-chars';
      charsSpan.textContent = `${item.correctChars}✓ / ${item.incorrectChars}✗`;

      colDetails.append(modeSpan, charsSpan);

      const colDate = document.createElement('div');
      colDate.className = 'hist-col-date';
      colDate.textContent = dateStr;

      itemEl.append(colMain, colDetails, colDate);
      return itemEl;
    });

    listEl.innerHTML = '';
    listEl.append(...items);
  }

  openHistoryModal() {
    this.openModal(this.historyModal);
  }

  closeHistoryModal() {
    this.closeModal(this.historyModal);
  }

  openInstructionsModal() {
    this.openModal(this.instructionsModal);
  }

  closeInstructionsModal() {
    this.closeModal(this.instructionsModal);
  }

  openThemeModal() {
    this.openModal(this.themeModal);
  }

  closeThemeModal() {
    this.closeModal(this.themeModal);
  }

  openCustomDurModal() {
    this.openModal(this.customDurModal, document.getElementById('custom-duration-input'));
  }

  closeCustomDurModal() {
    this.closeModal(this.customDurModal);
  }

  updateCustomDurationPill(duration) {
    if (!this.customDurationPill) return;
    this.customDurationPill.setAttribute('aria-checked', String(![30, 60, 120].includes(Number(duration))));
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
      card.setAttribute('aria-pressed', String(card.dataset.themeName === themeName));
    });

    if (themeName === 'custom' && customColors) {
      document.documentElement.style.setProperty('--accent', customColors.accent);
      document.documentElement.style.setProperty('--caret-color', customColors.accent);
      document.documentElement.style.setProperty('--accent-hover', customColors.accent);
      document.documentElement.style.setProperty('--accent-light', customColors.accent + '26');
      document.documentElement.style.setProperty('--bg-primary', customColors.bg);
      const rgb = customColors.bg.slice(1).match(/../g).map(value => {
        const channel = parseInt(value, 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const light = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179;
      const surface = this.adjustColor(customColors.bg, light ? 14 : -14);
      const style = document.documentElement.style;
      style.setProperty('--bg-secondary', surface);
      style.setProperty('--bg-tertiary', this.adjustColor(customColors.bg, light ? 24 : -24));
      style.setProperty('--bg-surface', surface + 'ed');
      style.setProperty('--text-main', light ? '#000000' : '#ffffff');
      style.setProperty('--text-muted', light ? '#202020' : '#ededed');
      style.setProperty('--text-dim', light ? '#303030' : '#dddddd');
      style.setProperty('--border-subtle', light ? '#767676' : '#909090');
    } else {
      ['--accent', '--caret-color', '--accent-hover', '--accent-light', '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-surface', '--text-main', '--text-muted', '--text-dim', '--border-subtle'].forEach(prop => {
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
    this.openModal(this.soundModal);
  }

  closeSoundModal() {
    this.closeModal(this.soundModal);
  }

  updateSoundProfileUI(activeProfile, customName = '') {
    document.querySelectorAll('.sound-card').forEach(card => {
      card.classList.toggle('active', card.dataset.profile === activeProfile);
      card.setAttribute('aria-pressed', String(card.dataset.profile === activeProfile));
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

  getOpenModal() {
    return this.modals.find(modal => !modal.classList.contains('hidden')) || null;
  }

  openModal(modal, initialFocus) {
    if (!modal || this.getOpenModal() === modal) return;
    const previous = this.getOpenModal();
    if (previous) previous.classList.add('hidden');
    else this.returnFocus = document.activeElement;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    (initialFocus || modal.querySelector('button:not(:disabled), input:not([type="file"])') || modal).focus();
    if (this.appWrapper) this.appWrapper.inert = true;
  }

  closeModal(modal) {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    if (!this.getOpenModal()) {
      if (this.appWrapper) this.appWrapper.inert = false;
      document.body.classList.remove('modal-open');
      if (this.returnFocus?.isConnected && !this.returnFocus.disabled) this.returnFocus.focus();
    }
  }

  setFinishEnabled(enabled, show) {
    if (!this.finishBtn) return;
    this.finishBtn.disabled = !enabled;
    if (show !== undefined) this.finishBtn.classList.toggle('hidden', !show);
  }

  setPracticeLanguage(language) {
    this.practiceLanguage = language === 'th' ? 'th' : 'en';
    this.textDisplay?.setAttribute('lang', this.practiceLanguage);
    this.hiddenInput?.setAttribute('lang', this.practiceLanguage);
    const note = document.getElementById('practice-language-note');
    if (note) {
      note.lang = this.practiceLanguage;
      note.textContent = this.practiceLanguage === 'th'
        ? 'พิมพ์ทีละคำ แล้วกด Space · CPM = ตัวอักษรที่ถูกต้องต่อนาที (รวมสระและวรรณยุกต์)'
        : 'Type each word, then press Space. CPM = correct characters per minute.';
    }
    const badgeLabel = document.getElementById('best-mode-label');
    if (badgeLabel) badgeLabel.textContent = `${this.practiceLanguage.toUpperCase()} Best:`;
  }
}
