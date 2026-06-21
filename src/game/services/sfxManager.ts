/**
 * Sound Effects Manager — generates and caches game sound effects using Audio Generation API
 * Falls back to user-uploaded audio files if available (e.g., footsteps)
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { loadCdnAsset } from './assetLoader';
import { getSfxVolume, isSfxEnabled } from './audioManager';

interface CachedSFX {
  url: string;
  timestamp: number;
}

const CACHE_KEY = 'quiet-garden-sfx-cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Sound descriptions for garden ambience
const SOUND_DESCRIPTIONS = {
  footstep: {
    type: 'sfx' as const,
    description: 'Soft footsteps on dirt garden path, gentle crunching, earthy and peaceful',
    durationSec: 0.8,
  },
  planting: {
    type: 'sfx' as const,
    description: 'Gentle digging and planting sound, soft soil shifting, placing a seed, minimal impact',
    durationSec: 1.2,
  },
  rain: {
    type: 'sfx' as const,
    description: 'Soft rain falling on garden, light patter, soothing and calming, natural ambience',
    durationSec: 3,
  },
  bund: {
    type: 'sfx' as const,
    description: 'Gentle digging and shaping earth, soft scraping sound, moving soil carefully, earthy thud',
    durationSec: 1.0,
  },
  undo: {
    type: 'sfx' as const,
    description: 'Soft whoosh sound, reversing action, magical undo effect, light and whimsical',
    durationSec: 0.6,
  },
  confirm: {
    type: 'sfx' as const,
    description: 'Confirmation sound, gentle belt handle click, satisfying action confirm',
    durationSec: 0.5,
  },
};

type SFXType = keyof typeof SOUND_DESCRIPTIONS;

let sfxCache: Record<SFXType, CachedSFX | null> = {
  footstep: null,
  planting: null,
  rain: null,
  bund: null,
  undo: null,
  confirm: null,
};

let isGenerating: Record<SFXType, boolean> = {
  footstep: false,
  planting: false,
  rain: false,
  bund: false,
  undo: false,
  confirm: false,
};

/**
 * Load cached sound effects from localStorage
 */
function loadCache(): void {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();

      for (const key in parsed) {
        const sfxKey = key as SFXType;
        if (parsed[sfxKey] && now - parsed[sfxKey].timestamp < CACHE_DURATION) {
          sfxCache[sfxKey] = parsed[sfxKey];
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load SFX cache:', e);
  }
}

/**
 * Save sound effects cache to localStorage
 */
function saveCache(): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sfxCache));
  } catch (e) {
    console.warn('Failed to save SFX cache:', e);
  }
}

/**
 * Generate a sound effect using the Audio Generation API
 */
async function generateSFX(sfxType: SFXType): Promise<string | null> {
  if (isGenerating[sfxType]) {
    // Wait for existing generation to complete
    let attempts = 0;
    while (isGenerating[sfxType] && attempts < 100) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    return sfxCache[sfxType]?.url ?? null;
  }

  isGenerating[sfxType] = true;

  try {
    const description = SOUND_DESCRIPTIONS[sfxType];
    const result = await RundotGameAPI.audioGen.generate({
      ...description,
      clientRef: `quiet-garden-${sfxType}`,
    });

    sfxCache[sfxType] = {
      url: result.audioUrl,
      timestamp: Date.now(),
    };
    saveCache();

    RundotGameAPI.analytics.recordCustomEvent('sfx_generated', { type: sfxType });
    return result.audioUrl;
  } catch (e) {
    console.warn(`Failed to generate SFX for ${sfxType}:`, e);
    return null;
  } finally {
    isGenerating[sfxType] = false;
  }
}

/**
 * Get or generate a sound effect
 */
export async function getSFX(sfxType: SFXType): Promise<string | null> {
  // Return cached version if available
  if (sfxCache[sfxType]) {
    return sfxCache[sfxType]!.url;
  }

  // Generate new one
  return generateSFX(sfxType);
}

/**
 * Play a sound effect — tries user-uploaded audio files first, then falls back to generated audio
 */
export async function playSFX(sfxType: SFXType, volume: number = 0.7): Promise<void> {
  try {
    // Check if SFX is enabled
    if (!isSfxEnabled()) return;

    let url: string | null = null;

    // For footsteps, try to load user-uploaded footstep sounds first
    if (sfxType === 'footstep') {
      try {
        // Randomly pick one of the two footstep sound variants
        const variant = Math.floor(Math.random() * 2);
        const filename = variant === 0 ? 'footstep00.ogg' : 'footstep01.ogg';
        console.log(`Trying to load footstep audio: ${filename}`);
        url = await loadCdnAsset(filename);
        console.log(`Successfully loaded footstep: ${filename}`);
      } catch (e) {
        console.warn(`User footstep audio not available (${e}), falling back to generated`);
        url = null; // Fall back to generated audio
      }
    }

    // For bund digging, try to load user-uploaded leather handle sounds first
    if (sfxType === 'bund') {
      try {
        // Randomly pick one of two leather handle sound variants
        const variant = Math.floor(Math.random() * 2);
        const filename = variant === 0 ? 'handleSmallLeather.ogg' : 'handleSmallLeather2.ogg';
        url = await loadCdnAsset(filename);
      } catch (e) {
        console.debug(`User bund audio not available, falling back to generated: ${e}`);
        url = null; // Fall back to generated audio
      }
    }

    // For confirm (mesquite/bund placement confirmation), try to load user-uploaded sound first
    if (sfxType === 'confirm') {
      try {
        url = await loadCdnAsset('beltHandle2.ogg');
      } catch (e) {
        console.debug(`User confirm audio not available, falling back to generated: ${e}`);
        url = null; // Fall back to generated audio
      }
    }

    // If no user audio was loaded, get generated SFX
    if (!url) {
      url = await getSFX(sfxType);
    }

    if (url) {
      const audio = new Audio(url);
      // Apply both the passed-in volume and the global SFX volume setting (0-100)
      const sfxVolume = getSfxVolume() / 100;
      audio.volume = volume * sfxVolume;

      // Wait for the audio to be loadable before playing
      return new Promise<void>((resolve) => {
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          audio.play().catch((e) => {
            console.warn(`Failed to play SFX ${sfxType}:`, e);
          });
          RundotGameAPI.analytics.recordCustomEvent('sfx_played', { type: sfxType });
          resolve();
        };

        const handleError = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          console.warn(`Failed to load SFX ${sfxType}: ${url}`);
          resolve();
        };

        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);

        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          audio.play().catch((e) => {
            console.warn(`SFX ${sfxType} timeout, play error:`, e);
          });
          resolve();
        }, 5000);

        audio.addEventListener('canplay', () => clearTimeout(timeout), { once: true });
      });
    } else {
      console.warn(`No URL generated for SFX ${sfxType}`);
    }
  } catch (e) {
    console.warn(`Error playing SFX ${sfxType}:`, e);
  }
}

/**
 * Preload sound effects for faster playback
 */
export async function preloadSFX(): Promise<void> {
  loadCache();

  // Generate all sounds in background (don't await)
  for (const sfxType of Object.keys(SOUND_DESCRIPTIONS) as SFXType[]) {
    if (!sfxCache[sfxType]) {
      generateSFX(sfxType).catch((e) => {
        console.warn(`Failed to preload ${sfxType}:`, e);
      });
    }
  }
}

/**
 * Clear SFX cache (if needed for debugging)
 */
export function clearSFXCache(): void {
  sfxCache = {
    footstep: null,
    planting: null,
    rain: null,
    bund: null,
    undo: null,
    confirm: null,
  };
  localStorage.removeItem(CACHE_KEY);
}
