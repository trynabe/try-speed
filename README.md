# Try-Speed — English Typing Practice for Developers

A modern, developer-aesthetic English typing practice web application with coding typography, custom durations, infinite mode, and free theme/color customization.

## Features

- **Developer / Coding Monospace Typography**:
  - Full site-wide `JetBrains Mono` / Monospace styling across headings, buttons, modals, badges, and the typing arena.
- **Custom Durations & Infinite (`inf`) Mode**:
  - Choose between standard 30s, 60s, 120s, or click **Custom**.
  - Enter any duration in seconds (e.g. `15`, `45`, `90`).
  - Enter `inf` (or select `∞ inf`) for unlimited zen practice mode. Text continues automatically; use **Finish & Save** to record your results.
  - Custom timed sessions accept whole numbers from 1 to 3600 seconds.
- **Themes & Free Color Customization**:
  - **Preset Developer Themes**: Matrix Green, Dracula, Cyberpunk Neon, Nord, Monokai, Catppuccin Mocha, Clean Light, and Default Dark.
  - **Free Color Pickers**: Interactive color pickers for Accent/Caret and Background colors allowing complete customization.
  - Automatically saves theme and custom colors to `localStorage`.
- **Difficulty Tiers**:
  - **Easy**: High-frequency lowercase words for muscle memory and rhythm.
  - **Medium**: Randomized English words with punctuation and capitalization.
  - **Hard**: Complex vocabulary, numbers, dates, parentheses, quotes, and punctuation.
- **Real-Time Visual Feedback & Caret**:
  - Correct characters highlighted in bright theme colors.
  - Incorrect characters highlighted in red with underline.
  - Dedicated visual markers for mistyped spaces.
  - Smooth sliding caret with line-scrolling compensation.
- **Dynamic Scoring**:
  - Words Per Minute (Net WPM) & Raw Gross WPM.
  - Accuracy percentage.
  - Correct and incorrect character counts.
  - Backspace & `Ctrl` + `Backspace` support that recalculates scores dynamically.
- **Local Persistence & Personal Bests**:
  - Tracks personal best score per duration and difficulty mode.
  - History drawer showing the latest 100 sessions and their summary statistics. Personal bests retain records from older sessions.
  - Clear history option.
- **Keyboard Navigation & Shortcuts**:
  - `Tab` + `Enter` or `Ctrl` + `Enter`: Restart session with the same text.
  - `Esc`: Generate new practice text.
  - `Backspace`: Erase previous character.
  - `Ctrl` + `Backspace`: Erase previous word.

## Running Locally

Serve the project over HTTP; opening `index.html` with a file URL does not reliably load its ES modules. Use Python or Node:

```bash
# Using Python
python -m http.server 8080

# Or using Node
npx serve . -l 8080
```

Open `http://localhost:8080` in your web browser.

## Running Tests

Run all tests with Node.js 22 or newer (no npm dependencies to install):

```bash
npm test
```

The suite includes session deadline/completion, exact elapsed scoring, infinite text continuation, composition input, storage recovery, modal focus, and custom-audio persistence/playback regressions.

Custom audio files must be smaller than 3.5 MiB and fit available browser storage. Upload errors keep the previous sound. Each key plays up to the first 0.25 seconds of the file, with at most 16 overlapping custom sounds. Mute stops active custom sounds; volume changes apply to sounds already playing.

Accuracy measures all keystrokes, including mistakes later erased. Net WPM measures correct characters still present; raw WPM includes all typed characters. Results use the same elapsed time as scoring.
