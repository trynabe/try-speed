import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let data, contexts, quotaError, decodeError, serial = 0;
class AudioNode {
  constructor() {
    this.gain = this.frequency = {
      values: [], setValueAtTime(value, time) { this.values.push({ value, time }); },
      exponentialRampToValueAtTime() {}
    };
    this.stops = 0;
  }
  connect(target) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(...args) { this.started = args; }
  stop() { this.stops++; }
}
class AudioContextMock {
  constructor() { this.currentTime = 10; this.state = 'running'; this.destination = {}; this.gains = []; this.sources = []; contexts.push(this); }
  createGain() { const node = new AudioNode(); this.gains.push(node); return node; }
  createBufferSource() { const node = new AudioNode(); this.sources.push(node); return node; }
  createOscillator() { return new AudioNode(); }
  createBiquadFilter() { return new AudioNode(); }
  async decodeAudioData() { if (decodeError) throw Error('Invalid audio'); return {duration:120}; }
  async resume() {}
}
beforeEach(() => {
  data = new Map(); contexts = []; quotaError = false; decodeError = false;
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { if (quotaError) throw Error('Quota exceeded'); data.set(key, value); },
    removeItem: key => data.delete(key)
  };
  globalThis.window = { AudioContext: AudioContextMock };
});
afterEach(() => { delete globalThis.window; delete globalThis.localStorage; });
async function audio() {
  const { SoundEffects } = await import(`../js/audio.js?test=${serial++}`);
  await SoundEffects.ready;
  return SoundEffects;
}
const file = (name, size = 4) => ({ name, size, arrayBuffer: async () => new Uint8Array(size).buffer });

test('legacy custom audio is restored before ready resolves', async () => {
  data.set('tryspeed_custom_audio_data', btoa('wave'));
  data.set('tryspeed_custom_audio_name', 'legacy.wav');
  const sound = await audio();
  assert.equal(sound.getCustomAudioName(), 'legacy.wav');
  assert.equal(sound.hasCustomAudio(), true);
});

test('uploaded audio name and bytes persist together and restore on reload', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('click.wav'));
  assert.equal(JSON.parse(data.get('tryspeed_custom_audio')).name, 'click.wav');
  const restored = await audio();
  assert.equal(restored.getCustomAudioName(), 'click.wav');
  assert.equal(restored.hasCustomAudio(), true);
});

test('oversized replacement is rejected without silently changing the active sound', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('old.wav'));
  await assert.rejects(sound.loadCustomAudioFile(file('large.wav', 4 * 1024 * 1024)), /smaller than 3.5 MiB/);
  assert.equal(sound.getCustomAudioName(), 'old.wav');
  assert.equal(JSON.parse(data.get('tryspeed_custom_audio')).name, 'old.wav');
});

test('storage quota failures keep the previous active and persisted audio', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('old.wav'));
  quotaError = true;
  await assert.rejects(sound.loadCustomAudioFile(file('new.wav')), /could not be saved/);
  assert.equal(sound.getCustomAudioName(), 'old.wav');
  assert.equal(JSON.parse(data.get('tryspeed_custom_audio')).name, 'old.wav');
});

test('invalid audio does not replace the last successful upload', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('old.wav'));
  decodeError = true;
  await assert.rejects(sound.loadCustomAudioFile(file('broken.wav')), /Invalid audio/);
  assert.equal(sound.getCustomAudioName(), 'old.wav');
});

test('mute stops every active custom sound and volume adjusts their shared gain', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('click.wav'));
  sound.setMuted(false);
  sound.playKeyClick(); sound.playKeyClick(); sound.playKeyClick();
  const ctx = contexts[0];
  assert.equal(ctx.sources.length, 3);
  for (const source of ctx.sources) assert.deepEqual(source.started, [10, 0, 0.25]);
  sound.setVolume(0.2);
  assert.equal(ctx.gains[0].gain.values.at(-1).value, 0.2);
  sound.setMuted(true);
  assert.equal(ctx.gains[0].gain.values.at(-1).value, 0);
  for (const source of ctx.sources) { assert.equal(source.stops, 1); assert.equal(source.disconnected, true); }
});

test('preview can play while muted without enabling typing sounds', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('click.wav'));
  sound.playKeyClick(false, true);
  sound.playKeyClick();
  assert.equal(sound.isMuted(), true);
  assert.equal(contexts[0].sources.length, 1);
  assert.equal(contexts[0].gains[0].gain.values.at(-1).value, 0);
  assert.equal(contexts[0].gains[1].gain.values.at(-1).value, 0.8);
});

test('custom polyphony is bounded and removing audio clears persistence', async () => {
  const sound = await audio();
  await sound.loadCustomAudioFile(file('click.wav')); sound.setMuted(false);
  for (let i = 0; i < 20; i++) sound.playKeyClick();
  assert.equal(contexts[0].sources.filter(source => source.stops === 0).length, 16);
  sound.clearCustomAudio();
  assert.equal(sound.hasCustomAudio(), false);
  assert.equal(sound.getProfile(), 'mechanical');
  assert.equal(data.has('tryspeed_custom_audio'), false);
  assert.equal(contexts[0].sources.filter(source => source.stops === 0).length, 0);
});
