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

export const StorageManager = {
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Failed to load settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
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
      return data ? JSON.parse(data) : [];
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
        timeSpent: Math.round(session.timeSpent),
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
      if (!bestScores.overall || entry.wpm > bestScores.overall.wpm) {
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
      return data ? JSON.parse(data) : {};
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
