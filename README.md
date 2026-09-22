# Try-Speed — English & Thai Typing Practice

A typing practice web application for English and Thai, with custom durations, infinite mode, live WPM/CPM, and theme/color customization.

## Features

- **English / Thai Practice**:
  - Switch **EN | TH** in the controls; the chosen language is saved locally.
  - Thai Easy uses common short words; Medium adds upper/lower vowels and all four tone marks; Hard adds specialist vocabulary, long words, numbers and punctuation.
  - Thai words are separated by single spaces for Spacebar practice. Switch your keyboard to Thai before typing.
  - Thai text uses IBM Plex Sans Thai with Noto Sans Thai, Leelawadee UI and Tahoma fallbacks. Combining vowels and tone marks share a grapheme container, while each typed character gets immediate, independent correctness and backspace handling—even during IME composition.
  - Personal bests are separated by language, difficulty and duration. Existing records are retained as English records. History shows EN/TH and CPM.

- **Developer / Coding Monospace Typography**:
  - `JetBrains Mono` / Monospace styling across the interface and English arena, with a Thai-specific font for Thai practice.
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
  - Monkeytype-style smooth sliding caret with retargeted easing, idle blink, active glow, and line-scrolling compensation.
- **Dynamic Scoring**:
  - Words Per Minute (Net WPM), Raw Gross WPM, and Characters Per Minute (CPM).
  - Accuracy percentage.
  - Correct and incorrect character counts.
  - Backspace & `Ctrl` + `Backspace` support that recalculates scores dynamically.
- **Local Persistence & Personal Bests**:
  - Tracks personal best score per language, duration and difficulty mode.
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

The suite includes session deadline/completion, exact elapsed scoring, infinite text continuation, composition input, storage recovery, modal focus, custom-audio persistence/playback, and Thai dictionary/rendering/scoring/legacy-record regressions.

Custom audio files must be smaller than 3.5 MiB and fit available browser storage. Upload errors keep the previous sound. Each key plays up to the first 0.25 seconds of the file, with at most 16 overlapping custom sounds. Mute stops active custom sounds; volume changes apply to sounds already playing.

Accuracy measures all keystrokes, including mistakes later erased. Net WPM measures correct characters still present; raw WPM includes all typed characters. Results use the same elapsed time as scoring.

For both languages, CPM = correct characters / elapsed minutes, and WPM = correct characters / 5 / elapsed minutes. Spaces, Thai vowels and tone marks each count as one character; WPM is a standardized five-character unit, not a count of natural-language words. For example, 150 correct characters in 30 seconds gives 300 CPM and 60 WPM. Each displayed metric is rounded independently.
