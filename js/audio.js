/**
 * Audio Synthesizer & MP3 Engine — Try-Speed
 * Supports 5 built-in procedural switch profiles + custom uploaded MP3 audio playback.
 * 100% low-latency Web Audio API implementation.
 */

const STORAGE_KEYS = {
  CUSTOM_AUDIO_DATA: 'tryspeed_custom_audio_data',
  CUSTOM_AUDIO_NAME: 'tryspeed_custom_audio_name'
};

export const SoundEffects = (() => {
  let audioCtx = null;
  let isMuted = true;
  let activeProfile = 'mechanical'; // 'mechanical' | 'thock' | 'typewriter' | 'pop' | 'beep' | 'custom'
  let volume = 0.8; // 0.0 to 1.0
  let customAudioBuffer = null;
  let customAudioName = '';

  function getContext() {
    if (!audioCtx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Load custom audio saved from previous sessions
  function initStoredCustomAudio() {
    try {
      const storedData = localStorage.getItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
      const storedName = localStorage.getItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
      if (storedData && storedName) {
        loadCustomAudioFromBase64(storedData, storedName, false);
      }
    } catch (e) {
      console.warn('Failed to load stored custom audio:', e);
    }
  }

  // Auto-init on script load if window exists
  if (typeof window !== 'undefined') {
    setTimeout(initStoredCustomAudio, 100);
  }

  /**
   * Convert File or Blob to ArrayBuffer and decode for playback
   */
  async function loadCustomAudioFile(file) {
    const ctx = getContext();
    if (!ctx) throw new Error('Web Audio not supported');

    const arrayBuffer = await file.arrayBuffer();
    // Clone arrayBuffer because decodeAudioData detaches it
    const bufferCopy = arrayBuffer.slice(0);

    const decoded = await ctx.decodeAudioData(arrayBuffer);
    customAudioBuffer = decoded;
    customAudioName = file.name;

    // Save as Base64 in LocalStorage for persistence across reloads (if < 3.5MB)
    if (bufferCopy.byteLength < 3.5 * 1024 * 1024) {
      try {
        let binary = '';
        const bytes = new Uint8Array(bufferCopy);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA, base64);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME, file.name);
      } catch (e) {
        console.warn('File too large for LocalStorage caching:', e);
      }
    }

    activeProfile = 'custom';
    return { name: file.name, duration: decoded.duration };
  }

  async function loadCustomAudioFromBase64(base64Str, name, autoSwitch = true) {
    try {
      const ctx = getContext();
      if (!ctx) return;
      const binary = atob(base64Str);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoded = await ctx.decodeAudioData(bytes.buffer);
      customAudioBuffer = decoded;
      customAudioName = name;
      if (autoSwitch) activeProfile = 'custom';
    } catch (e) {
      console.warn('Error decoding Base64 custom audio:', e);
    }
  }

  function clearCustomAudio() {
    customAudioBuffer = null;
    customAudioName = '';
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
    if (activeProfile === 'custom') {
      activeProfile = 'mechanical';
    }
  }

  /**
   * Sound Generators
   */

  // 1. Tactile Mechanical (Crisp Click)
  function playMechanical(ctx, now, masterGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = 460 + (Math.random() * 80 - 40);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.035);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  // 2. Deep Thock (Lubed Linear Red Switch)
  function playThock(ctx, now, masterGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const freq = 130 + (Math.random() * 20 - 10);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  // 3. Vintage Typewriter (Mechanical Clack)
  function playTypewriter(ctx, now, masterGain) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(780 + Math.random() * 60, now);
    osc1.frequency.exponentialRampToValueAtTime(140, now + 0.045);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(220, now);
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.045);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.048);
    osc2.stop(now + 0.048);
  }

  // 4. Bubble Pop
  function playPop(ctx, now, masterGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.025);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // 5. Retro 8-bit Beep
  function playBeep(ctx, now, masterGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.02);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 6. Custom Uploaded MP3 / Audio Buffer
  function playCustomBuffer(ctx, masterGain) {
    if (!customAudioBuffer) {
      playMechanical(ctx, ctx.currentTime, masterGain);
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = customAudioBuffer;
    source.connect(masterGain);
    source.start(0);
  }

  // Low error thud
  function playErrorSound(ctx, now, masterGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  function playKeyClick(isError = false) {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
      masterGain.connect(ctx.destination);

      if (isError) {
        playErrorSound(ctx, now, masterGain);
        return;
      }

      switch (activeProfile) {
        case 'thock':
          playThock(ctx, now, masterGain);
          break;
        case 'typewriter':
          playTypewriter(ctx, now, masterGain);
          break;
        case 'pop':
          playPop(ctx, now, masterGain);
          break;
        case 'beep':
          playBeep(ctx, now, masterGain);
          break;
        case 'custom':
          playCustomBuffer(ctx, masterGain);
          break;
        case 'mechanical':
        default:
          playMechanical(ctx, now, masterGain);
          break;
      }
    } catch (e) {
      // Audio autoplay policy or device restrictions
    }
  }

  function playFinishChime() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.15 * volume, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } catch (e) {}
  }

  return {
    setMuted(muted) {
      isMuted = muted;
    },
    isMuted() {
      return isMuted;
    },
    setVolume(val) {
      volume = Math.max(0, Math.min(1, Number(val)));
    },
    getVolume() {
      return volume;
    },
    setProfile(profile) {
      activeProfile = profile;
    },
    getProfile() {
      return activeProfile;
    },
    hasCustomAudio() {
      return !!customAudioBuffer;
    },
    getCustomAudioName() {
      return customAudioName;
    },
    loadCustomAudioFile,
    clearCustomAudio,
    playKeyClick,
    playFinishChime
  };
})();
