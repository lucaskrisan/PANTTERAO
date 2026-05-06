// Notification sound player using real MP3 files with Web Audio API fallback

const SOUND_FILES: Record<string, string> = {
  kaching: '/sounds/kaching.mp3',
  coin: '/sounds/coin.mp3',
  bell: '/sounds/bell.mp3',
  success: '/sounds/success.mp3',
  magic: '/sounds/magic.mp3',
};

// Web Audio fallback for sounds without MP3 files
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  // Resume if browser suspended it due to autoplay policy
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playFallback(sound: string) {
  switch (sound) {
    case 'cash':
      playTone(800, 0.1, 'square', 0.2);
      setTimeout(() => playTone(1200, 0.15, 'square', 0.2), 80);
      setTimeout(() => playTone(1600, 0.3, 'sine', 0.25), 160);
      break;
    case 'pop':
      playTone(600, 0.08, 'square', 0.25);
      setTimeout(() => playTone(900, 0.12, 'sine', 0.2), 60);
      break;
    default:
      playTone(1000, 0.3, 'sine', 0.2);
  }
}

export function playNotificationSound(sound: string) {
  if (sound === 'none') return;

  try {
    const file = SOUND_FILES[sound];
    if (file) {
      const audio = new Audio(file);
      audio.volume = 0.7;
      audio.play().catch(() => playFallback(sound));
    } else {
      playFallback(sound);
    }
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}
