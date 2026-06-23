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
  sfxVolume: 10,
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
      playAudioWithUnlock(audioInstance, 'music');
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

/**
 * Toggle SFX on/off
 */
export function toggleSfx(enabled: boolean): void {
  saveAudioSettings({ sfxEnabled: enabled });
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

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('rain.wav');
      rainAudioInstance = new Audio(audioUrl);
      rainAudioInstance.loop = true;
      rainAudioInstance.volume = (currentSettings.sfxVolume / 100) * 0.6; // Slightly quieter than other SFX
      playAudioWithUnlock(rainAudioInstance, 'rain sound');
    } catch (e) {
      console.warn('Failed to load rain sound:', e);
    }
  })();
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

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('mulch.ogg');
      mulchAudioInstance = new Audio(audioUrl);
      mulchAudioInstance.loop = false;
      mulchAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(mulchAudioInstance, 'mulch sound');
    } catch (e) {
      console.warn('Failed to load mulch sound:', e);
    }
  })();
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

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('destroy.ogg');
      destroyAudioInstance = new Audio(audioUrl);
      destroyAudioInstance.loop = false;
      destroyAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(destroyAudioInstance, 'destroy sound');
    } catch (e) {
      console.warn('Failed to load destroy sound:', e);
    }
  })();
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

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('move.ogg');
      moveAudioInstance = new Audio(audioUrl);
      moveAudioInstance.loop = false;
      moveAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(moveAudioInstance, 'move sound');
    } catch (e) {
      console.warn('Failed to load move sound:', e);
    }
  })();
}

let waterAudioInstance: HTMLAudioElement | null = null;

/**
 * Play water creation sound effect (for reshape tool water creation)
 */
export function playWater(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing water sound
  if (waterAudioInstance) {
    waterAudioInstance.pause();
    waterAudioInstance = null;
  }

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('water.ogg');
      waterAudioInstance = new Audio(audioUrl);
      waterAudioInstance.loop = false;
      waterAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(waterAudioInstance, 'water sound');
    } catch (e) {
      console.warn('Failed to load water sound:', e);
    }
  })();
}

let buttonAudioInstance: HTMLAudioElement | null = null;

/**
 * Play button click sound effect (for toolbar buttons)
 */
export function playButton(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing button sound
  if (buttonAudioInstance) {
    buttonAudioInstance.pause();
    buttonAudioInstance = null;
  }

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('button.ogg');
      buttonAudioInstance = new Audio(audioUrl);
      buttonAudioInstance.loop = false;
      buttonAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(buttonAudioInstance, 'button sound');
    } catch (e) {
      console.warn('Failed to load button sound:', e);
    }
  })();
}

let menuSelectAudioInstance: HTMLAudioElement | null = null;

/**
 * Play menu select sound effect (for main menu buttons)
 */
export function playMenuSelect(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing menu select sound
  if (menuSelectAudioInstance) {
    menuSelectAudioInstance.pause();
    menuSelectAudioInstance = null;
  }

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('menu-select.ogg');
      menuSelectAudioInstance = new Audio(audioUrl);
      menuSelectAudioInstance.loop = false;
      menuSelectAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(menuSelectAudioInstance, 'menu select sound');
    } catch (e) {
      console.warn('Failed to load menu select sound:', e);
    }
  })();
}

let cancelAudioInstance: HTMLAudioElement | null = null;

/**
 * Play cancel/close sound effect (for X and cancel buttons)
 */
export function playCancel(): void {
  if (!currentSettings.sfxEnabled) return;

  // Stop any existing cancel sound
  if (cancelAudioInstance) {
    cancelAudioInstance.pause();
    cancelAudioInstance = null;
  }

  (async () => {
    try {
      const audioUrl = await loadCdnAsset('cancel.ogg');
      cancelAudioInstance = new Audio(audioUrl);
      cancelAudioInstance.loop = false;
      cancelAudioInstance.volume = currentSettings.sfxVolume / 100;
      playAudioWithUnlock(cancelAudioInstance, 'cancel sound');
    } catch (e) {
      console.warn('Failed to load cancel sound:', e);
    }
  })();
}

// ─────────────────────────────────────────────────────────────────
// Mobile Audio Unlock — unlock HTML audio on first user gesture
// ─────────────────────────────────────────────────────────────────

let audioUnlocked = false;

/**
 * Play audio with automatic unlock fallback for mobile browsers
 * On NotAllowedError, unlocks audio and retries after a short delay
 */
function playAudioWithUnlock(audio: HTMLAudioElement, soundName: string): void {
  audio.play().catch((e: any) => {
    if (e?.name === 'NotAllowedError') {
      // Mobile browsers block audio until a user gesture; unlock and retry
      unlockAudio();
      setTimeout(() => {
        audio.play().catch((retryErr) => {
          console.warn(`Failed to play ${soundName} after unlock retry:`, retryErr);
        });
      }, 100);
    } else {
      console.warn(`Failed to play ${soundName}:`, e);
    }
  });
}

/**
 * Unlock audio on mobile browsers by playing multiple silent sounds
 * Mobile browsers (especially iOS Safari) block all audio until a user gesture triggers it
 * This must be called synchronously in response to a touch/click event
 */
export function unlockAudio(): void {
  if (audioUnlocked) return;

  try {
    // iOS requires a real audio play() call during a user gesture
    // Try multiple approaches for maximum compatibility

    // Approach 1: Play a silent WAV buffer
    const silentAudio = new Audio();
    silentAudio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
    silentAudio.volume = 0;
    silentAudio.muted = false;
    silentAudio.play().catch(() => {
      // Fallback: try creating a dummy audio element with a different approach
      try {
        const dummy = new Audio();
        dummy.volume = 0;
        dummy.muted = false;
        // Try to create a small tone
        dummy.src = 'data:audio/wav;base64,UklGRiIAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
        dummy.play().catch(() => {
          // If both fail, mark as unlocked anyway - some devices may not have audio support
          audioUnlocked = true;
        });
      } catch (e) {
        audioUnlocked = true;
      }
    });

    // Mark as unlocked after a very short delay to ensure at least one play() call fired
    setTimeout(() => {
      audioUnlocked = true;
      // Record telemetry for mobile audio unlock
      try {
        const RundotGameAPI = require('@series-inc/rundot-game-sdk/api').default;
        RundotGameAPI.analytics.recordCustomEvent('audio_unlocked_mobile', {
          trigger: 'user_gesture'
        });
      } catch (e) {
        // Silently fail if telemetry not available
      }
    }, 50);
  } catch (e) {
    // If anything fails, mark as unlocked anyway
    audioUnlocked = true;
  }
}

/**
 * Setup audio unlock listeners on document
 * Call this once at app start to enable audio on first user interaction
 */
export function setupAudioUnlock(): void {
  const unlock = () => {
    unlockAudio();
    // Remove listeners after first unlock
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('click', unlock);
  };

  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('click', unlock, { once: true });
}
