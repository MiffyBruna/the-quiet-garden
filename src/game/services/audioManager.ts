/**
 * Audio Manager — handles game soundtrack and sound effects
 */

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

  audioInstance = new Audio(src);
  audioInstance.loop = true;
  audioInstance.volume = (volume ?? currentSettings.musicVolume) / 100;
  audioInstance.play().catch((e) => {
    console.warn('Failed to play music:', e);
  });
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
    playMusic('/cdn-assets/soundtrack.mp3');
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
