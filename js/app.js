/**
 * Main Application Orchestrator — Try-Speed
 * Connects TypingEngine, Timer, StorageManager, SoundEffects, and UIController.
 */

import { TextGenerator } from './text-generator.js';
import { Timer } from './timer.js';
import { StorageManager } from './storage.js';
import { SoundEffects } from './audio.js';
import { TypingEngine } from './typing-engine.js';
import { UIController } from './ui.js';

export class TypingApp {
  constructor({ ui = new UIController(), now } = {}) {
    this.ui = ui;
    this.settings = StorageManager.getSettings();
    this.currentText = '';
    this.sessionFinished = false;
    this.isComposing = false;
    this.compositionText = '';

    // Initialize Audio Engine
    SoundEffects.setMuted(!this.settings.soundEnabled);
    SoundEffects.setVolume(this.settings.soundVolume ?? 0.8);
    SoundEffects.setProfile(this.settings.soundProfile || 'mechanical');

    this.ui.setSoundState(this.settings.soundEnabled);
    this.ui.updateSoundVolumeUI(this.settings.soundVolume ?? 0.8);
    this.ui.updateSoundProfileUI(this.settings.soundProfile || 'mechanical', SoundEffects.getCustomAudioName());
    SoundEffects.ready.then(() => {
      this.ui.updateSoundProfileUI(this.settings.soundProfile, SoundEffects.getCustomAudioName());
    });

    // Initialize Theme & Custom Colors
    this.ui.setTheme(this.settings.theme || 'dark', this.settings.customColors);

    // Initialize Timer
    this.timer = new Timer(this.settings.duration, {
      now,
      onTick: (remainingOrMode, elapsedSeconds) => {
        this.ui.updateTimer(remainingOrMode, elapsedSeconds);
        this.typingEngine.setElapsedSeconds(elapsedSeconds);
      },
      onComplete: (elapsedSeconds) => {
        this.finishSession(elapsedSeconds);
      }
    });

    // Initialize Typing Engine
    this.typingEngine = new TypingEngine({
      beforeInput: () => this.canType(),
      onTextExhausted: () => {
        if (this.settings.duration !== 'inf') return;
        this.typingEngine.appendText(' ' + TextGenerator.generateText(this.settings.difficulty, 'inf', this.settings.language));
        this.ui.renderText(this.typingEngine.targetText);
      },
      onStateChange: (metrics) => {
        this.ui.updateCharacterStates(this.typingEngine.charStates, metrics.currentIndex);
        this.ui.updateLiveMetrics(metrics);
      },
      onMetricsChange: (metrics) => {
        this.ui.updateLiveMetrics(metrics);
      },
      onFirstKeystroke: () => {
        this.timer.start();
        this.ui.setFinishEnabled(true);
      },
      onComplete: () => {
        const elapsed = this.timer.getElapsedSeconds();
        this.timer.stop();
        this.finishSession(elapsed);
      },
      onSound: (isError) => {
        SoundEffects.playKeyClick(isError);
      }
    });

    this.initEventListeners();
    this.initThemeAndCustomizer();
    this.initSoundModal();
    this.applyActiveSettingsPills();
    this.updateBestScoreBadge();
    this.loadNewText();
    this.focusInput();
  }

  initEventListeners() {
    // Hidden Input keystroke capturing
    const input = this.ui.hiddenInput;
    if (input) {
      input.addEventListener('keydown', (e) => this.handleKeyDown(e));
      input.addEventListener('input', (e) => this.handleMobileInput(e));
      input.addEventListener('compositionstart', () => {
        this.isComposing = true;
        this.compositionText = '';
        this.compositionCommit = null;
      });
      input.addEventListener('compositionend', (e) => {
        this.isComposing = false;
        // Some Thai IMEs leave `event.data` empty (or only expose the last
        // combining mark) while the textarea contains the complete commit.
        // Prefer the actual input value so no vowel/tone mark is lost.
        const inputValue = this.getPendingInputText();
        const committedText = inputValue || e.data || this.compositionText;
        this.syncCompositionText(committedText);
        // Some browsers emit one final input immediately after compositionend.
        this.compositionCommit = committedText || null;
        this.compositionText = '';
        clearTimeout(this.compositionCommitTimer);
        this.compositionCommitTimer = setTimeout(() => { this.compositionCommit = null; }, 0);
        this.resetInput();
      });
      input.addEventListener('focus', () => this.ui.showFocusOverlay(false));
      input.addEventListener('blur', () => {
        // Only show overlay if all modals are closed
        if (
          (!this.ui.resultsModal || this.ui.resultsModal.classList.contains('hidden')) &&
          (!this.ui.historyModal || this.ui.historyModal.classList.contains('hidden')) &&
          (!this.ui.instructionsModal || this.ui.instructionsModal.classList.contains('hidden')) &&
          (!this.ui.themeModal || this.ui.themeModal.classList.contains('hidden')) &&
          (!this.ui.customDurModal || this.ui.customDurModal.classList.contains('hidden')) &&
          (!this.ui.soundModal || this.ui.soundModal.classList.contains('hidden'))
        ) {
          this.ui.showFocusOverlay(true);
        }
      });
    }

    // Typing arena click to focus
    const arena = document.getElementById('typing-arena');
    if (arena) {
      arena.addEventListener('click', () => this.focusInput());
    }

    const overlay = this.ui.focusOverlay;
    if (overlay) {
      overlay.addEventListener('click', () => this.focusInput());
    }

    // Standard Duration pills (30, 60, 120)
    const durationPills = document.querySelectorAll('[data-duration]:not(#custom-duration-pill)');
    durationPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const dur = parseInt(pill.dataset.duration, 10);
        this.setDuration(dur);
      });
    });

    // Custom Duration pill click -> opens custom duration modal
    if (this.ui.customDurationPill) {
      this.ui.customDurationPill.addEventListener('click', () => {
        const inputEl = document.getElementById('custom-duration-input');
        if (inputEl) {
          inputEl.value = this.settings.duration === 'inf' ? 'inf' : this.settings.duration;
          inputEl.setCustomValidity('');
        }
        this.ui.openCustomDurModal();
      });
    }

    // Custom Duration modal actions
    const closeCustomDurBtn = document.getElementById('close-custom-dur-btn');
    if (closeCustomDurBtn) {
      closeCustomDurBtn.addEventListener('click', () => {
        this.ui.closeCustomDurModal();
        this.focusInput();
      });
    }

    const cancelCustomDurBtn = document.getElementById('cancel-custom-dur-btn');
    if (cancelCustomDurBtn) {
      cancelCustomDurBtn.addEventListener('click', () => {
        this.ui.closeCustomDurModal();
        this.focusInput();
      });
    }

    const applyCustomDurBtn = document.getElementById('apply-custom-dur-btn');
    if (applyCustomDurBtn) {
      applyCustomDurBtn.addEventListener('click', () => {
        this.applyCustomDurationFromModal();
      });
    }

    // Quick duration presets inside custom duration modal
    const quickDurBtns = document.querySelectorAll('[data-set-dur]');
    quickDurBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.setDur;
        const inputEl = document.getElementById('custom-duration-input');
        if (inputEl) inputEl.value = val;
        this.applyCustomDurationFromModal();
      });
    });

    const customDurInput = document.getElementById('custom-duration-input');
    if (customDurInput) {
      customDurInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.applyCustomDurationFromModal();
        }
      });
      customDurInput.addEventListener('input', () => customDurInput.setCustomValidity(''));
    }

    document.querySelectorAll('[data-language]').forEach(pill => {
      pill.addEventListener('click', () => this.setLanguage(pill.dataset.language));
    });

    // Difficulty options
    const difficultyPills = document.querySelectorAll('[data-difficulty]');
    difficultyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const diff = pill.dataset.difficulty;
        this.setDifficulty(diff);
      });
    });

    document.querySelectorAll('[role="radiogroup"]').forEach(group => {
      group.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        const choices = [...group.querySelectorAll('[role="radio"]')];
        const index = choices.indexOf(document.activeElement);
        if (index < 0) return;
        e.preventDefault();
        const offset = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1;
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : (index + offset + choices.length) % choices.length;
        choices[next].click();
        if (!this.ui.getOpenModal()) choices[next].focus();
      });
    });

    // Control buttons
    if (this.ui.restartBtn) {
      this.ui.restartBtn.addEventListener('click', () => this.restartCurrentText());
    }
    if (this.ui.newTextBtn) {
      this.ui.newTextBtn.addEventListener('click', () => this.loadNewText());
    }
    document.getElementById('finish-btn')?.addEventListener('click', () => {
      this.finishSession(this.timer.getElapsedSeconds());
    });

    // History Modal buttons
    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        this.refreshAndOpenHistory();
      });
    }

    const closeHistoryBtn = document.getElementById('close-history-btn');
    if (closeHistoryBtn) {
      closeHistoryBtn.addEventListener('click', () => this.ui.closeHistoryModal());
    }

    const closeHistoryFooterBtn = document.getElementById('close-history-footer-btn');
    if (closeHistoryFooterBtn) {
      closeHistoryFooterBtn.addEventListener('click', () => this.ui.closeHistoryModal());
    }

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all typing history and best scores?')) {
          StorageManager.clearHistory();
          this.refreshAndOpenHistory();
          this.updateBestScoreBadge();
        }
      });
    }

    // Instructions Modal buttons
    const instructionsBtn = document.getElementById('instructions-btn');
    if (instructionsBtn) {
      instructionsBtn.addEventListener('click', () => this.ui.openInstructionsModal());
    }

    const closeInstructionsBtn = document.getElementById('close-instructions-btn');
    if (closeInstructionsBtn) {
      closeInstructionsBtn.addEventListener('click', () => this.ui.closeInstructionsModal());
    }

    const closeInstructionsFooterBtn = document.getElementById('close-instructions-footer-btn');
    if (closeInstructionsFooterBtn) {
      closeInstructionsFooterBtn.addEventListener('click', () => this.ui.closeInstructionsModal());
    }

    // Results Modal action buttons
    const resRestartBtn = document.getElementById('res-restart-btn');
    if (resRestartBtn) {
      resRestartBtn.addEventListener('click', () => {
        this.ui.hideResultsModal();
        this.restartCurrentText();
      });
    }

    const resNextBtn = document.getElementById('res-next-btn');
    if (resNextBtn) {
      resNextBtn.addEventListener('click', () => {
        this.ui.hideResultsModal();
        this.loadNewText();
      });
    }

    // Global keyboard navigation shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.isComposing || this.isComposing) return;
      // Escape closes modals or resets test
      if (e.key === 'Escape') {
        if (this.ui.resultsModal && !this.ui.resultsModal.classList.contains('hidden')) {
          this.ui.hideResultsModal();
          this.loadNewText();
          return;
        }
        if (this.ui.historyModal && !this.ui.historyModal.classList.contains('hidden')) {
          this.ui.closeHistoryModal();
          this.focusInput();
          return;
        }
        if (this.ui.instructionsModal && !this.ui.instructionsModal.classList.contains('hidden')) {
          this.ui.closeInstructionsModal();
          this.focusInput();
          return;
        }
        if (this.ui.themeModal && !this.ui.themeModal.classList.contains('hidden')) {
          this.ui.closeThemeModal();
          this.focusInput();
          return;
        }
        if (this.ui.customDurModal && !this.ui.customDurModal.classList.contains('hidden')) {
          this.ui.closeCustomDurModal();
          this.focusInput();
          return;
        }
        if (this.ui.soundModal && !this.ui.soundModal.classList.contains('hidden')) {
          this.ui.closeSoundModal();
          this.focusInput();
          return;
        }
        this.loadNewText();
        return;
      }

      // Tab + Enter uses native navigation from the arena to Restart.
      const modal = this.ui.getOpenModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (!modal || modal === this.ui.resultsModal)) {
        e.preventDefault();
        this.restartCurrentText();
        return;
      }

      // Any keypress when not inside a modal focuses hidden input
      if (
        !modal &&
        document.activeElement !== this.ui.hiddenInput &&
        !['INPUT', 'BUTTON', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        if (e.key.length === 1 || e.key === 'Backspace') {
          this.focusInput();
        }
      }
    });

    // Resize handler to adjust caret position
    window.addEventListener('resize', () => {
      this.ui.updateCaretPosition(this.typingEngine.currentIndex);
    });
  }

  initSoundModal() {
    // Header sound button opens Sound Modal
    if (this.ui.soundBtn) {
      this.ui.soundBtn.addEventListener('click', () => {
        this.ui.openSoundModal();
      });
    }

    const closeSoundBtn = document.getElementById('close-sound-btn');
    if (closeSoundBtn) {
      closeSoundBtn.addEventListener('click', () => {
        this.ui.closeSoundModal();
        this.focusInput();
      });
    }

    const closeSoundFooterBtn = document.getElementById('close-sound-footer-btn');
    if (closeSoundFooterBtn) {
      closeSoundFooterBtn.addEventListener('click', () => {
        this.ui.closeSoundModal();
        this.focusInput();
      });
    }

    // Modal Mute / Enable toggle
    const modalSoundToggleBtn = document.getElementById('modal-sound-toggle-btn');
    if (modalSoundToggleBtn) {
      modalSoundToggleBtn.addEventListener('click', () => {
        const newState = !this.settings.soundEnabled;
        this.settings.soundEnabled = newState;
        StorageManager.saveSettings({ soundEnabled: newState });
        SoundEffects.setMuted(!newState);
        this.ui.setSoundState(newState);

        if (newState) {
          SoundEffects.playKeyClick(false);
        }
      });
    }

    // Sound profile selection cards
    const soundCards = document.querySelectorAll('.sound-card');
    soundCards.forEach(card => {
      card.addEventListener('click', () => {
        const profile = card.dataset.profile;
        this.settings.soundProfile = profile;
        StorageManager.saveSettings({ soundProfile: profile });
        SoundEffects.setProfile(profile);
        this.ui.updateSoundProfileUI(profile, SoundEffects.getCustomAudioName());

        // Play feedback sample
        SoundEffects.playKeyClick(false, true);
      });
    });

    // Volume slider
    const volumeSlider = document.getElementById('sound-volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const vol = Number(e.target.value) / 100;
        this.settings.soundVolume = vol;
        StorageManager.saveSettings({ soundVolume: vol });
        SoundEffects.setVolume(vol);
        this.ui.updateSoundVolumeUI(vol);
      });
    }

    // Test sound button
    const testSoundBtn = document.getElementById('test-sound-btn');
    if (testSoundBtn) {
      testSoundBtn.addEventListener('click', () => {
        SoundEffects.playKeyClick(false, true);
      });
    }

    // Upload custom MP3 trigger
    const uploadTriggerBtn = document.getElementById('upload-sound-trigger-btn');
    const fileInput = document.getElementById('sound-file-input');

    if (uploadTriggerBtn && fileInput) {
      uploadTriggerBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const info = await SoundEffects.loadCustomAudioFile(file);
          this.settings.soundProfile = 'custom';
          StorageManager.saveSettings({ soundProfile: 'custom' });
          this.ui.updateSoundProfileUI('custom', info.name);

          // Play preview
          SoundEffects.playKeyClick(false, true);
        } catch (err) {
          alert(err.message || 'Could not decode audio file. Please choose another audio file.');
          console.error(err);
        } finally {
          fileInput.value = '';
        }
      });
    }

    // Clear custom audio button
    const clearCustomBtn = document.getElementById('clear-custom-audio-btn');
    if (clearCustomBtn) {
      clearCustomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          SoundEffects.clearCustomAudio();
        } catch (err) {
          alert('Could not remove the saved sound. Browser storage is unavailable.');
          return;
        }
        this.settings.soundProfile = 'mechanical';
        StorageManager.saveSettings({ soundProfile: 'mechanical' });
        this.ui.updateSoundProfileUI('mechanical', '');
      });
    }
  }

  initThemeAndCustomizer() {
    // Theme button opens modal
    if (this.ui.themeBtn) {
      this.ui.themeBtn.addEventListener('click', () => {
        this.ui.openThemeModal();
      });
    }

    const closeThemeBtn = document.getElementById('close-theme-btn');
    if (closeThemeBtn) {
      closeThemeBtn.addEventListener('click', () => {
        this.ui.closeThemeModal();
        this.focusInput();
      });
    }

    const closeThemeFooterBtn = document.getElementById('close-theme-footer-btn');
    if (closeThemeFooterBtn) {
      closeThemeFooterBtn.addEventListener('click', () => {
        this.ui.closeThemeModal();
        this.focusInput();
      });
    }

    // Theme preset cards
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const themeName = card.dataset.themeName;
        this.settings.theme = themeName;
        StorageManager.saveSettings({ theme: themeName });
        this.ui.setTheme(themeName);
      });
    });

    // Custom Color Pickers
    const accentPicker = document.getElementById('custom-accent-picker');
    const accentHex = document.getElementById('custom-accent-hex');
    const bgPicker = document.getElementById('custom-bg-picker');
    const bgHex = document.getElementById('custom-bg-hex');
    const applyColorsBtn = document.getElementById('apply-custom-colors-btn');

    if (this.settings.customColors) {
      if (accentPicker) accentPicker.value = this.settings.customColors.accent || '#e2b714';
      if (accentHex) accentHex.textContent = accentPicker.value;
      if (bgPicker) bgPicker.value = this.settings.customColors.bg || '#18191c';
      if (bgHex) bgHex.textContent = bgPicker.value;
    }

    if (accentPicker && accentHex) {
      accentPicker.addEventListener('input', (e) => {
        accentHex.textContent = e.target.value;
      });
    }

    if (bgPicker && bgHex) {
      bgPicker.addEventListener('input', (e) => {
        bgHex.textContent = e.target.value;
      });
    }

    if (applyColorsBtn) {
      applyColorsBtn.addEventListener('click', () => {
        const customColors = {
          accent: accentPicker.value,
          bg: bgPicker.value
        };
        this.settings.theme = 'custom';
        this.settings.customColors = customColors;
        StorageManager.saveSettings({
          theme: 'custom',
          customColors
        });
        this.ui.setTheme('custom', customColors);
      });
    }
  }

  applyCustomDurationFromModal() {
    const inputEl = document.getElementById('custom-duration-input');
    if (!inputEl) return;
    const rawVal = inputEl.value.trim().toLowerCase();

    if (rawVal === 'inf' || rawVal === 'infinity' || rawVal === '∞') {
      this.setDuration('inf');
    } else {
      const parsed = Number(rawVal);
      if (!/^\d+$/.test(rawVal) || !Number.isInteger(parsed) || parsed < 1 || parsed > 3600) {
        inputEl.setCustomValidity('Enter a whole number from 1 to 3600, or inf.');
        inputEl.reportValidity();
        return;
      }
      inputEl.setCustomValidity('');
      this.setDuration(parsed);
    }

    this.ui.closeCustomDurModal();
    this.focusInput();
  }

  handleKeyDown(e) {
    if (e.isComposing || this.isComposing || e.keyCode === 229) return;
    this.compositionCommit = null;
    // Allow browser shortcuts (like Ctrl+C, Ctrl+R, F5, F12)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.typingEngine.handleInput('Backspace', true);
      }
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      this.typingEngine.handleInput('Backspace', false);
      return;
    }

    // Ignore a literal Grave Accent / Tilde produced by the Windows language
    // switch, unless it is the character the exercise currently expects.
    // Do not block by physical `code`: Thai layouts can map Backquote to a
    // different, valid character.
    if ((e.key === '`' || e.key === '~') && !this.isExpectedCharacter(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Tab') {
      return; // allow normal tab navigation
    }

    // Printable characters use the input event on both desktop and mobile.
  }

  handleMobileInput(e) {
    if (e.isComposing || this.isComposing) {
      // Composition events contain the complete in-progress string. Apply its
      // delta so Thai bases, vowels and tone marks get feedback immediately.
      const inputValue = this.getPendingInputText();
      this.syncCompositionText(inputValue || e.data || '');
      return;
    }
    if (
      this.compositionCommit != null &&
      (e.inputType === 'insertFromComposition' || e.data === this.compositionCommit)
    ) {
      this.compositionCommit = null;
      this.resetInput();
      return;
    }
    this.compositionCommit = null;
    if ((e.data === '`' || e.data === '~') && !this.isExpectedCharacter(e.data)) {
      this.resetInput();
      return;
    }
    if (e.inputType?.startsWith('delete')) {
      this.typingEngine.handleInput('Backspace', e.inputType === 'deleteWordBackward');
    } else {
      const value = this.ui.hiddenInput?.value || '';
      this.commitText(e.data ?? (value.startsWith('\u200b') ? value.slice(1) : value));
    }
    this.resetInput();
  }

  getPendingInputText() {
    const value = this.ui.hiddenInput?.value || '';
    return value.startsWith('\u200b') ? value.slice(1) : value;
  }

  isExpectedCharacter(char) {
    return this.typingEngine.charStates[this.typingEngine.currentIndex]?.char === char;
  }

  syncCompositionText(nextText) {
    const previous = [...this.compositionText];
    const next = [...(nextText || '')];
    let commonLength = 0;
    while (
      commonLength < previous.length &&
      commonLength < next.length &&
      previous[commonLength] === next[commonLength]
    ) {
      commonLength++;
    }

    // IMEs may revise a composing syllable. Undo only the changed suffix,
    // then apply the replacement without disturbing text typed before it.
    for (let i = previous.length; i > commonLength; i--) {
      this.typingEngine.handleInput('Backspace');
    }
    this.commitText(next.slice(commonLength).join(''));
    this.compositionText = next.join('');
  }

  commitText(text) {
    for (const char of text) this.typingEngine.handleInput(char);
  }

  resetInput() {
    // Keep a disposable character so mobile keyboards can delete at any index.
    if (this.ui.hiddenInput) {
      this.ui.hiddenInput.value = '\u200b';
      this.ui.hiddenInput.setSelectionRange(1, 1);
    }
  }

  canType() {
    if (this.sessionFinished || this.ui.getOpenModal()) return false;
    if (this.timer.isRunning) {
      const elapsed = this.timer.getElapsedSeconds();
      if (!this.timer.isInfinite && elapsed >= this.timer.totalDuration) {
        this.finishSession(elapsed);
        return false;
      }
      this.typingEngine.setElapsedSeconds(elapsed);
    }
    return true;
  }

  focusInput() {
    if (this.ui.hiddenInput && !this.ui.getOpenModal() && !this.sessionFinished) {
      this.ui.hiddenInput.focus();
      this.ui.showFocusOverlay(false);
    }
  }

  setDuration(duration) {
    this.settings.duration = duration;
    StorageManager.saveSettings({ duration });
    this.applyActiveSettingsPills();
    this.updateBestScoreBadge();
    this.loadNewText();
  }

  setDifficulty(difficulty) {
    if (this.settings.difficulty === difficulty) return;
    this.settings.difficulty = difficulty;
    StorageManager.saveSettings({ difficulty });
    this.applyActiveSettingsPills();
    this.updateBestScoreBadge();
    this.loadNewText();
  }

  setLanguage(language) {
    if (!['en', 'th'].includes(language)) return;
    if (this.settings.language === language) {
      this.loadNewText();
      return;
    }
    this.settings.language = language;
    StorageManager.saveSettings({ language });
    this.applyActiveSettingsPills();
    this.updateBestScoreBadge();
    this.loadNewText();
  }

  applyActiveSettingsPills() {
    document.querySelectorAll('[data-language]').forEach(pill => {
      const active = pill.dataset.language === this.settings.language;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-checked', String(active));
    });
    document.querySelectorAll('[data-duration]:not(#custom-duration-pill)').forEach(pill => {
      const dur = parseInt(pill.dataset.duration, 10);
      pill.classList.toggle('active', dur === this.settings.duration);
      pill.setAttribute('aria-checked', String(dur === this.settings.duration));
    });

    this.ui.updateCustomDurationPill(this.settings.duration);

    document.querySelectorAll('[data-difficulty]').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.difficulty === this.settings.difficulty);
      pill.setAttribute('aria-checked', String(pill.dataset.difficulty === this.settings.difficulty));
    });
  }

  updateBestScoreBadge() {
    const best = StorageManager.getBestScore(this.settings.difficulty, this.settings.duration, this.settings.language);
    this.ui.updateBestBadge(best);
  }

  loadNewText() {
    this.currentText = TextGenerator.generateText(this.settings.difficulty, this.settings.duration, this.settings.language);
    this.restartCurrentText();
  }

  restartCurrentText() {
    this.ui.hideResultsModal();
    this.sessionFinished = false;
    this.isComposing = false;
    this.compositionText = '';
    this.compositionCommit = null;
    clearTimeout(this.compositionCommitTimer);
    this.timer.reset();
    this.timer.setDuration(this.settings.duration);
    this.ui.updateTimer(this.settings.duration);
    this.ui.setPracticeLanguage(this.settings.language);

    this.typingEngine.setText(this.currentText);
    this.ui.renderText(this.currentText);
    this.resetInput();
    this.ui.setFinishEnabled(false, this.settings.duration === 'inf');
    this.focusInput();
  }

  finishSession(elapsedSeconds) {
    if (this.sessionFinished || !this.typingEngine.hasStarted) return;
    this.sessionFinished = true;
    this.timer.stop();
    this.typingEngine.finish(elapsedSeconds);
    this.ui.updateTimer(this.timer.isInfinite ? 'inf' : Math.max(0, Math.ceil(this.timer.totalDuration - elapsedSeconds)), elapsedSeconds);
    this.ui.setFinishEnabled(false);
    SoundEffects.playFinishChime();
    const metrics = this.typingEngine.getMetrics();
    const prevBest = StorageManager.getBestScore(this.settings.difficulty, this.settings.duration, this.settings.language);

    const sessionData = {
      language: this.settings.language,
      cpm: metrics.cpm,
      wpm: metrics.wpm,
      rawWpm: metrics.rawWpm,
      accuracy: metrics.accuracy,
      correctChars: metrics.correctChars,
      incorrectChars: metrics.incorrectChars,
      totalChars: metrics.totalChars,
      duration: this.settings.duration === 'inf' ? 'inf' : this.settings.duration,
      timeSpent: elapsedSeconds,
      difficulty: this.settings.difficulty
    };

    StorageManager.saveSession(sessionData);
    this.updateBestScoreBadge();

    const isNewBest = !prevBest || metrics.wpm > prevBest.wpm ||
      (metrics.wpm === prevBest.wpm && metrics.accuracy > prevBest.accuracy);
    this.ui.showResultsModal(sessionData, isNewBest);
  }

  refreshAndOpenHistory() {
    const history = StorageManager.getHistory();
    const stats = StorageManager.getSummaryStats();
    this.ui.renderHistory(history, stats);
    this.ui.openHistoryModal();
  }
}

// Bootstrap once DOM is ready
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  window.app = new TypingApp();
});
