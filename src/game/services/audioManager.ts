/**
 * Audio Manager — handles game soundtrack and sound effects
 */
import { loadCdnAsset } from './assetLoader';

interface AudioSettings {
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  musicVolume: 70,
  sfxVolume: 80,
  musicEnabled: true,
  sfxEnabled: true,
};

const STORAGE_KEY = 'quiet-garden-audio-settings';

let audioInstance: HTMLAudioElement | null = null;
let currentSettings: AudioSettings = { ...DEFAULT_SETTINGS };

/**
 * Load audio settings from storage
 */
export function loadAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load audio settings:', e);
  }
  return currentSettings;
}

/**
 * Save audio settings to storage
 */
export function saveAudioSettings(settings: Partial<AudioSettings>): void {
  currentSettings = { ...currentSettings, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.warn('Failed to save audio settings:', e);
  }
}

/**
 * Get current audio settings
 */
export function getAudioSettings(): AudioSettings {
  return { ...currentSettings };
}

/**
 * Play background music with loop
 */
export function playMusic(src: string, volume?: number): void {
  if (!currentSettings.musicEnabled) return;

  // Stop any existing audio
  if (audioInstance) {
    audioInstance.pause();
    audioInstance = null;
  }

  (async () => {
    try {
      // Load audio from CDN - handle both full paths and filenames
      const filename = src.startsWith('/') ? src.replace('/cdn-assets/', '') : src;
      const audioUrl = await loadCdnAsset(filename);
      audioInstance = new Audio(audioUrl);
      audioInstance.loop = true;
      audioInstance.volume = (volume ?? currentSettings.musicVolume) / 100;
      audioInstance.play().catch((e) => {
        console.warn('Failed to play music:', e);
      });
    } catch (e) {
      console.warn('Failed to load music:', e);
    }
  })();
}

/**
 * Stop background music
 */
export function stopMusic(): void {
  if (audioInstance) {
    audioInstance.pause();
    audioInstance.currentTime = 0;
    audioInstance = null;
  }
}

/**
 * Set music volume (0-100)
 */
export function setMusicVolume(volume: number): void {
  const normalizedVolume = Math.max(0, Math.min(100, volume));
  saveAudioSettings({ musicVolume: normalizedVolume });
  if (audioInstance) {
    audioInstance.volume = normalizedVolume / 100;
  }
}

/**
 * Toggle music on/off
 */
export function toggleMusic(enabled: boolean): void {
  saveAudioSettings({ musicEnabled: enabled });
  if (enabled && audioInstance === null) {
    playMusic('soundtrack.mp3');
  } else if (!enabled) {
    stopMusic();
  }
}

/**
 * Get current music volume
 */
export function getMusicVolume(): number {
  return currentSettings.musicVolume;
}

/**
 * Check if music is enabled
 */
export function isMusicEnabled(): boolean {
  return currentSettings.musicEnabled;
}

/**
 * Set SFX volume (0-100)
 */
export function setSfxVolume(volume: number): void {
  const normalizedVolume = Math.max(0, Math.min(100, volume));
  saveAudioSettings({ sfxVolume: normalizedVolume });
}

/**
 * Get current SFX volume
 */
export function getSfxVolume(): number {
  return currentSettings.sfxVolume;
}

/**
 * Check if SFX is enabled
 */
export function isSfxEnabled(): boolean {
  return currentSettings.sfxEnabled;
}

let rainAudioInstance: HTMLAudioElement | null = null;

/**
 * Play rain sound effect (looping ambient sound)
 */
export function playRain(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing rain sound
  if (rainAudioInstance) {
    rainAudioInstance.pause();
    rainAudioInstance = null;
  }

  try {
    rainAudioInstance = new Audio('/rain.wav');
    rainAudioInstance.loop = true;
    rainAudioInstance.volume = (currentSettings.sfxVolume / 100) * 0.6; // Slightly quieter than other SFX
    rainAudioInstance.play().catch((e) => {
      console.warn('Failed to play rain sound:', e);
    });
  } catch (e) {
    console.warn('Failed to load rain sound:', e);
  }
}

/**
 * Stop rain sound effect
 */
export function stopRain(): void {
  if (rainAudioInstance) {
    rainAudioInstance.pause();
    rainAudioInstance.currentTime = 0;
    rainAudioInstance = null;
  }
}

let mulchAudioInstance: HTMLAudioElement | null = null;

/**
 * Play mulch sound effect (one-time)
 */
export function playMulch(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing mulch sound
  if (mulchAudioInstance) {
    mulchAudioInstance.pause();
    mulchAudioInstance = null;
  }

  try {
    mulchAudioInstance = new Audio('/mulch.ogg');
    mulchAudioInstance.loop = false;
    mulchAudioInstance.volume = currentSettings.sfxVolume / 100;
    mulchAudioInstance.play().catch((e) => {
      console.warn('Failed to play mulch sound:', e);
    });
  } catch (e) {
    console.warn('Failed to load mulch sound:', e);
  }
}

let destroyAudioInstance: HTMLAudioElement | null = null;

/**
 * Play destruction sound effect (for reshape tool destruction)
 */
export function playDestroy(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing destruction sound
  if (destroyAudioInstance) {
    destroyAudioInstance.pause();
    destroyAudioInstance = null;
  }

  try {
    destroyAudioInstance = new Audio('/destroy.ogg');
    destroyAudioInstance.loop = false;
    destroyAudioInstance.volume = currentSettings.sfxVolume / 100;
    destroyAudioInstance.play().catch((e) => {
      console.warn('Failed to play destroy sound:', e);
    });
  } catch (e) {
    console.warn('Failed to load destroy sound:', e);
  }
}

let moveAudioInstance: HTMLAudioElement | null = null;

/**
 * Play movement sound effect (for reshape tool block movement)
 */
export function playMove(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing movement sound
  if (moveAudioInstance) {
    moveAudioInstance.pause();
    moveAudioInstance = null;
  }

  try {
    moveAudioInstance = new Audio('/move.ogg');
    moveAudioInstance.loop = false;
    moveAudioInstance.volume = currentSettings.sfxVolume / 100;
    moveAudioInstance.play().catch((e) => {
      console.warn('Failed to play move sound:', e);
    });
  } catch (e) {
    console.warn('Failed to load move sound:', e);
  }
}
