# Try-Speed — English Typing Practice for Developers

A modern, developer-aesthetic English typing practice web application with coding typography, custom durations, infinite mode, and free theme/color customization.

## Features

- **Developer / Coding Monospace Typography**:
  - Full site-wide `JetBrains Mono` / Monospace styling across headings, buttons, modals, badges, and the typing arena.
- **Custom Durations & Infinite (`inf`) Mode**:
  - Choose between standard 30s, 60s, 120s, or click **Custom**.
  - Enter any duration in seconds (e.g. `15`, `45`, `90`).
  - Enter `inf` (or select `∞ inf`) for unlimited zen practice mode (counts up without time limits).
- **Themes & Free Color Customization**:
  - **Preset Developer Themes**: Matrix Green, Dracula, Cyberpunk Neon, Nord, Monokai, Catppuccin Mocha, Clean Light, and Default Dark.
  - **Free Color Pickers**: Interactive color pickers for Accent/Caret and Background colors allowing complete customization.
  - Automatically saves theme and custom colors to `localStorage`.
- **Difficulty Tiers**:
  - **Easy**: High-frequency lowercase words for muscle memory and rhythm.
  - **Medium**: Natural English prose with standard punctuation and capitalization.
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
  - History drawer logging recent sessions with summary statistics (average WPM, average accuracy, highest speed).
  - Clear history option.
- **Keyboard Navigation & Shortcuts**:
  - `Tab` + `Enter` or `Ctrl` + `Enter`: Restart session with the same text.
  - `Esc`: Generate new practice text.
  - `Backspace`: Erase previous character.
  - `Ctrl` + `Backspace`: Erase previous word.

## Running Locally

You can open `index.html` directly in any web browser, or serve it using Python or Node:

```bash
# Using Python
python -m http.server 8080

# Or using Node
npx serve .
```

Open `http://localhost:8080` in your web browser.

## Running Tests

Automated tests can be executed with Node:

```bash
node tests/test_engine.js
node tests/test_suite.js
```
"# try-speed" 
