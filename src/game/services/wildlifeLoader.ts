/**
 * Wildlife sprite loading and management.
 * Single PNG per wildlife type.
 */

import { loadCdnAsset } from './assetLoader';

export interface WildlifeSpriteConfig {
  filename: string; // e.g., 'bee' -> 'bee.png'
}

// Wildlife sprite configurations - only includes sprites that have been uploaded
export const WILDLIFE_SPRITES: Record<string, WildlifeSpriteConfig> = {
  // Chapter 1 available sprites
  ant: { filename: 'ant' },
  beetle: { filename: 'beetle' },
  bee: { filename: 'bee' },
  hoverfly: { filename: 'hoverfly' },
  monarch: { filename: 'monarch' },
  cottontail: { filename: 'cottontail' },
  frog: { filename: 'frog' },
  quail: { filename: 'quail' },
  finch: { filename: 'finch' },
  // Chapter 2 available sprites
  painted_lady: { filename: 'paintedlady' },
  swallow: { filename: 'swallow' },
  // NPCs
  moss: { filename: 'moss' },
};

class WildlifeLoader {
  private loadedSprites: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Load a wildlife sprite asynchronously.
   */
  async loadSprite(wildlifeType: string): Promise<HTMLImageElement> {
    if (this.loadedSprites.has(wildlifeType)) {
      return this.loadedSprites.get(wildlifeType)!;
    }

    if (this.loadingPromises.has(wildlifeType)) {
      return this.loadingPromises.get(wildlifeType)!;
    }

    const config = WILDLIFE_SPRITES[wildlifeType];
    if (!config) {
      throw new Error(`No sprite configuration found for wildlife type: ${wildlifeType}`);
    }

    const promise = (async () => {
      try {
        const filename = `${config.filename}.png`;
        const blobUrl = await loadCdnAsset(filename);

        const img = new Image();
        img.src = blobUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load sprite: ${filename}`));
        });

        this.loadedSprites.set(wildlifeType, img);
        return img;
      } catch (error) {
        throw new Error(`Failed to load wildlife sprite ${wildlifeType}: ${error}`);
      }
    })();

    this.loadingPromises.set(wildlifeType, promise);
    return promise;
  }

  /**
   * Get cached sprite without loading (returns undefined if not loaded yet).
   */
  getLoadedSprite(wildlifeType: string): HTMLImageElement | undefined {
    const sprite = this.loadedSprites.get(wildlifeType);
    if (!sprite) {
      console.log(`[wildlifeLoader] getLoadedSprite(${wildlifeType}): NOT found. Cache has: ${Array.from(this.loadedSprites.keys()).join(', ')}`);
    } else {
      console.log(`[wildlifeLoader] getLoadedSprite(${wildlifeType}): Found, dimensions: ${sprite.width}x${sprite.height}`);
    }
    return sprite;
  }

  /**
   * Draw a wildlife sprite onto the canvas.
   * @param ctx Canvas context
   * @param wildlifeType Type of wildlife
   * @param x Screen X position (center)
   * @param y Screen Y position (center)
   * @param maxSize Maximum size in pixels (default 32px)
   * @returns true if sprite was drawn, false if not available
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    wildlifeType: string,
    x: number,
    y: number,
    maxSize: number = 32
  ): boolean {
    const img = this.getLoadedSprite(wildlifeType);
    if (!img) return false;

    const aspectRatio = img.width / img.height;
    let width = maxSize;
    let height = maxSize / aspectRatio;

    if (height > maxSize) {
      height = maxSize;
      width = maxSize * aspectRatio;
    }

    ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
    return true;
  }

  /**
   * Preload all wildlife sprites
   */
  async preloadAll(): Promise<void> {
    const allWildlifeTypes = Object.keys(WILDLIFE_SPRITES);
    await Promise.all(allWildlifeTypes.map((type) => this.loadSprite(type).catch(() => {})));
  }
}

export const wildlifeLoader = new WildlifeLoader();
