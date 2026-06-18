import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/**
 * Cache for loaded assets to avoid reloading the same asset multiple times
 */
const assetCache = new Map<string, Promise<string>>();

/**
 * Load a CDN asset and return its blob URL
 * This handles all large assets (>100KB) from public/cdn-assets/
 *
 * @param filename - The filename (e.g., 'landing-bg.png', 'sprite-idle.png')
 * @returns Promise<string> - A blob URL that can be used in img src or CSS background
 */
export async function loadCdnAsset(filename: string): Promise<string> {
  // Check cache first
  if (assetCache.has(filename)) {
    return assetCache.get(filename)!;
  }

  // Fetch and cache the asset
  const promise = (async () => {
    try {
      const blob = await RundotGameAPI.cdn.fetchAsset(filename);
      // Convert blob to URL
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error(`Failed to load asset: ${filename}`, error);
      throw error;
    }
  })();

  assetCache.set(filename, promise);
  return promise;
}

/**
 * Preload multiple assets at once
 * @param filenames - Array of filenames to preload
 */
export async function preloadCdnAssets(filenames: string[]): Promise<void> {
  await Promise.all(filenames.map(filename => loadCdnAsset(filename)));
}
