// emergency sound alert — socket event e kaj kore, user setting on thakle beep bajay.
// Web Audio API use hoy, kono audio file lagge na.

let audioContext = null;
const SOUND_KEY = 'bc_sound_alerts';

export const soundEnabled = () => localStorage.getItem(SOUND_KEY) !== 'off';
export const setSoundEnabled = (enabled) => {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  window.dispatchEvent(new Event('sound-setting-changed'));
};

const getContext = () => {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  return audioContext;
};

// emergency er jonno 3-ta quick beep — distinct frequency diye bojha jay.
export const playEmergencyAlert = () => {
  if (!soundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    [0, 0.25, 0.5].forEach((offset) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      oscillator.start(ctx.currentTime + offset);
      oscillator.stop(ctx.currentTime + offset + 0.22);
    });
  } catch { /* audio blocked — silently ignore */ }
};

// chat/notification er jonno soft pop sound.
export const playPop = () => {
  if (!soundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'triangle';
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.16);
  } catch { /* ignore */ }
};
