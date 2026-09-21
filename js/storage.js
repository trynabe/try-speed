/**
 * Storage Manager for Typing Practice
 * Manages LocalStorage persistence for user preferences, session history, and high scores.
 */

const STORAGE_KEYS = {
  HISTORY: 'typing_practice_history',
  SETTINGS: 'typing_practice_settings',
  BEST_SCORES: 'typing_practice_best_scores'
};

const DEFAULT_SETTINGS = {
  duration: 60,
  difficulty: 'medium',
  theme: 'dark',
  soundEnabled: false,
  soundProfile: 'mechanical',
  soundVolume: 0.8,
  customColors: {
    accent: '#00ff66',
    bg: '#0d1117'
  }
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validDuration = value => value === 'inf' || (Number.isInteger(value) && value >= 1 && value <= 3600);
const validDifficulty = value => ['easy', 'medium', 'hard'].includes(value);
const validScore = value => isRecord(value) && nonnegative(value.wpm) && nonnegative(value.accuracy) && value.accuracy <= 100 && validDuration(value.duration) && validDifficulty(value.difficulty);

function normalizeSettings(value) {
  const data = isRecord(value) ? value : {};
  const colors = isRecord(data.customColors) ? data.customColors : {};
  const hex = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  return {
    duration: validDuration(data.duration) ? data.duration : DEFAULT_SETTINGS.duration,
    difficulty: validDifficulty(data.difficulty) ? data.difficulty : DEFAULT_SETTINGS.difficulty,
    theme: ['dark', 'light', 'matrix', 'dracula', 'cyberpunk', 'nord', 'monokai', 'catppuccin', 'custom'].includes(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
    soundEnabled: typeof data.soundEnabled === 'boolean' ? data.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    soundProfile: ['mechanical', 'thock', 'typewriter', 'pop', 'beep', 'custom'].includes(data.soundProfile) ? data.soundProfile : DEFAULT_SETTINGS.soundProfile,
    soundVolume: nonnegative(data.soundVolume) && data.soundVolume <= 1 ? data.soundVolume : DEFAULT_SETTINGS.soundVolume,
    customColors: {
      accent: hex(colors.accent) ? colors.accent : DEFAULT_SETTINGS.customColors.accent,
      bg: hex(colors.bg) ? colors.bg : DEFAULT_SETTINGS.customColors.bg
    }
  };
}

export const StorageManager = {
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return normalizeSettings(data ? JSON.parse(data) : null);
    } catch (e) {
      console.error('Failed to load settings:', e);
      return normalizeSettings(null);
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = normalizeSettings({ ...current, ...settings });
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return settings;
    }
  },

  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const history = data ? JSON.parse(data) : [];
      return Array.isArray(history) ? history.filter(entry => validScore(entry) && nonnegative(entry.timestamp) &&
        ['rawWpm', 'correctChars', 'incorrectChars', 'totalChars', 'timeSpent'].every(key => nonnegative(entry[key]))).slice(0, 100) : [];
    } catch (e) {
      console.error('Failed to load history:', e);
      return [];
    }
  },

  saveSession(session) {
    try {
      const history = this.getHistory();
      const newEntry = {
        id: 'sess_' + Date.now(),
        timestamp: Date.now(),
        wpm: Math.round(session.wpm),
        rawWpm: Math.round(session.rawWpm),
        accuracy: Math.round(session.accuracy),
        correctChars: session.correctChars,
        incorrectChars: session.incorrectChars,
        totalChars: session.totalChars,
        duration: session.duration,
        timeSpent: session.timeSpent,
        difficulty: session.difficulty
      };

      history.unshift(newEntry);
      // Keep up to 100 recent sessions
      if (history.length > 100) {
        history.length = 100;
      }
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

      // Update best scores
      this.updateBestScore(newEntry);

      return newEntry;
    } catch (e) {
      console.error('Failed to save session:', e);
      return null;
    }
  },

  updateBestScore(entry) {
    try {
      const bestScores = this.getAllBestScores();
      const key = `${entry.difficulty}_${entry.duration}`;
      const existing = bestScores[key];

      if (!existing || entry.wpm > existing.wpm || (entry.wpm === existing.wpm && entry.accuracy > existing.accuracy)) {
        bestScores[key] = {
          wpm: entry.wpm,
          accuracy: entry.accuracy,
          date: entry.timestamp,
          duration: entry.duration,
          difficulty: entry.difficulty
        };
      }

      // Also track overall best
      if (!bestScores.overall || entry.wpm > bestScores.overall.wpm ||
          (entry.wpm === bestScores.overall.wpm && entry.accuracy > bestScores.overall.accuracy)) {
        bestScores.overall = {
          wpm: entry.wpm,
          accuracy: entry.accuracy,
          date: entry.timestamp,
          duration: entry.duration,
          difficulty: entry.difficulty
        };
      }

      localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(bestScores));
    } catch (e) {
      console.error('Failed to update best score:', e);
    }
  },

  getAllBestScores() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BEST_SCORES);
      const scores = data ? JSON.parse(data) : {};
      return isRecord(scores) ? Object.fromEntries(Object.entries(scores).filter(([key, value]) =>
        (key === 'overall' || /^(easy|medium|hard)_(inf|\d+)$/.test(key)) && validScore(value))) : {};
    } catch (e) {
      console.error('Failed to load best scores:', e);
      return {};
    }
  },

  getBestScore(difficulty, duration) {
    const all = this.getAllBestScores();
    if (difficulty && duration) {
      const key = `${difficulty}_${duration}`;
      return all[key] || null;
    }
    return all.overall || null;
  },

  getSummaryStats() {
    const history = this.getHistory();
    if (!history.length) {
      return {
        totalTests: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        bestWpm: 0
      };
    }

    const totalTests = history.length;
    const totalWpm = history.reduce((sum, h) => sum + (h.wpm || 0), 0);
    const totalAcc = history.reduce((sum, h) => sum + (h.accuracy || 0), 0);
    const bestWpm = history.reduce((max, h) => Math.max(max, h.wpm || 0), 0);

    return {
      totalTests,
      avgWpm: Math.round(totalWpm / totalTests),
      avgAccuracy: Math.round(totalAcc / totalTests),
      bestWpm
    };
  },

  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.BEST_SCORES);
      return true;
    } catch (e) {
      console.error('Failed to clear history:', e);
      return false;
    }
  }
};
