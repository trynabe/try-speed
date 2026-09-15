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

class TypingApp {
  constructor() {
    this.ui = new UIController();
    this.settings = StorageManager.getSettings();
    this.currentText = '';

    // Initialize Audio Engine
    SoundEffects.setMuted(!this.settings.soundEnabled);
    SoundEffects.setVolume(this.settings.soundVolume ?? 0.8);
    SoundEffects.setProfile(this.settings.soundProfile || 'mechanical');

    this.ui.setSoundState(this.settings.soundEnabled);
    this.ui.updateSoundVolumeUI(this.settings.soundVolume ?? 0.8);
    this.ui.updateSoundProfileUI(this.settings.soundProfile || 'mechanical', SoundEffects.getCustomAudioName());

    // Initialize Theme & Custom Colors
    this.ui.setTheme(this.settings.theme || 'dark', this.settings.customColors);

    // Initialize Timer
    this.timer = new Timer(this.settings.duration, {
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
      onStateChange: (metrics) => {
        this.ui.updateCharacterStates(this.typingEngine.charStates, metrics.currentIndex);
        this.ui.updateLiveMetrics(metrics);
      },
      onFirstKeystroke: () => {
        this.timer.start();
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
          this.applyCustomDurationFromModal();
        }
      });
    }

    // Difficulty options
    const difficultyPills = document.querySelectorAll('[data-difficulty]');
    difficultyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const diff = pill.dataset.difficulty;
        this.setDifficulty(diff);
      });
    });

    // Control buttons
    if (this.ui.restartBtn) {
      this.ui.restartBtn.addEventListener('click', () => this.restartCurrentText());
    }
    if (this.ui.newTextBtn) {
      this.ui.newTextBtn.addEventListener('click', () => this.loadNewText());
    }

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

      // Tab key tracking for Tab + Enter restart shortcut
      if (e.key === 'Tab') {
        this.lastTabTime = Date.now();
      }

      // Tab + Enter or Ctrl + Enter restart shortcut
      if (e.key === 'Enter') {
        const isTabEnter = this.lastTabTime && (Date.now() - this.lastTabTime < 900);
        const isCtrlEnter = e.ctrlKey || e.metaKey;
        if (isTabEnter || isCtrlEnter) {
          e.preventDefault();
          this.restartCurrentText();
          return;
        }
      }

      // Any keypress when not inside a modal focuses hidden input
      if (
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
        const wasMuted = SoundEffects.isMuted();
        SoundEffects.setMuted(false);
        SoundEffects.playKeyClick(false);
        SoundEffects.setMuted(wasMuted);
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
        const wasMuted = SoundEffects.isMuted();
        SoundEffects.setMuted(false);
        SoundEffects.playKeyClick(false);
        SoundEffects.setMuted(wasMuted);
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
          const wasMuted = SoundEffects.isMuted();
          SoundEffects.setMuted(false);
          SoundEffects.playKeyClick(false);
          SoundEffects.setMuted(wasMuted);
        } catch (err) {
          alert('Could not decode audio file. Please try another MP3 or WAV audio file.');
          console.error(err);
        }
      });
    }

    // Clear custom audio button
    const clearCustomBtn = document.getElementById('clear-custom-audio-btn');
    if (clearCustomBtn) {
      clearCustomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundEffects.clearCustomAudio();
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
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.setDuration(Math.min(3600, parsed));
      } else {
        this.setDuration(60);
      }
    }

    this.ui.closeCustomDurModal();
    this.focusInput();
  }

  handleKeyDown(e) {
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

    if (e.key === 'Tab') {
      return; // allow normal tab navigation
    }

    if (e.key.length === 1) {
      e.preventDefault();
      this.lastInputTime = Date.now();
      this.lastKey = e.key;
      this.typingEngine.handleInput(e.key);
    }
  }

  handleMobileInput(e) {
    // Avoid double processing if keydown already handled this character
    const now = Date.now();
    if (this.lastInputTime && (now - this.lastInputTime < 40)) {
      if (this.ui.hiddenInput) {
        this.ui.hiddenInput.value = '';
      }
      return;
    }

    // For mobile virtual keyboards that fire input events
    if (e.inputType === 'deleteContentBackward') {
      this.typingEngine.handleInput('Backspace', false);
    } else if (e.data) {
      for (const char of e.data) {
        this.typingEngine.handleInput(char);
      }
    }
    // Clear the hidden input value so it never overflows
    if (this.ui.hiddenInput) {
      this.ui.hiddenInput.value = '';
    }
  }

  focusInput() {
    if (this.ui.hiddenInput) {
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

  applyActiveSettingsPills() {
    document.querySelectorAll('[data-duration]:not(#custom-duration-pill)').forEach(pill => {
      const dur = parseInt(pill.dataset.duration, 10);
      pill.classList.toggle('active', dur === this.settings.duration);
    });

    this.ui.updateCustomDurationPill(this.settings.duration);

    document.querySelectorAll('[data-difficulty]').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.difficulty === this.settings.difficulty);
    });
  }

  updateBestScoreBadge() {
    const best = StorageManager.getBestScore(this.settings.difficulty, this.settings.duration);
    this.ui.updateBestBadge(best);
  }

  loadNewText() {
    this.timer.reset();
    this.timer.setDuration(this.settings.duration);
    this.ui.updateTimer(this.settings.duration);

    this.currentText = TextGenerator.generateText(this.settings.difficulty, this.settings.duration);
    this.typingEngine.setText(this.currentText);
    this.ui.renderText(this.currentText);
    this.focusInput();
  }

  restartCurrentText() {
    this.timer.reset();
    this.timer.setDuration(this.settings.duration);
    this.ui.updateTimer(this.settings.duration);

    this.typingEngine.setText(this.currentText);
    this.ui.renderText(this.currentText);
    this.focusInput();
  }

  finishSession(elapsedSeconds) {
    SoundEffects.playFinishChime();
    const metrics = this.typingEngine.getMetrics();
    const prevBest = StorageManager.getBestScore(this.settings.difficulty, this.settings.duration);

    const sessionData = {
      wpm: metrics.wpm,
      rawWpm: metrics.rawWpm,
      accuracy: metrics.accuracy,
      correctChars: metrics.correctChars,
      incorrectChars: metrics.incorrectChars,
      totalChars: metrics.totalChars,
      duration: this.settings.duration === 'inf' ? 'inf' : this.settings.duration,
      timeSpent: Math.round(elapsedSeconds),
      difficulty: this.settings.difficulty
    };

    StorageManager.saveSession(sessionData);
    this.updateBestScoreBadge();

    const isNewBest = !prevBest || metrics.wpm > prevBest.wpm;
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
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TypingApp();
});
