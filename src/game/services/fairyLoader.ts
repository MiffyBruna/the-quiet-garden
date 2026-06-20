/**
 * Fairy sprite loading and management.
 * Single PNG per fairy type.
 */

import { loadCdnAsset } from './assetLoader';

export interface FairySpriteConfig {
  filename: string; // e.g., 'sprig' -> 'sprig.png'
}

// Fairy sprite configurations
export const FAIRY_SPRITES: Record<string, FairySpriteConfig> = {
  sprig: { filename: 'sprig' },
  nima: { filename: 'nima' },
  bloom: { filename: 'bloom' },
  ripple: { filename: 'ripple' },
  tampopo: { filename: 'tampopo' },
};

class FairyLoader {
  private loadedSprites: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Load a fairy sprite asynchronously.
   */
  async loadSprite(fairyType: string): Promise<HTMLImageElement> {
    if (this.loadedSprites.has(fairyType)) {
      return this.loadedSprites.get(fairyType)!;
    }

    if (this.loadingPromises.has(fairyType)) {
      return this.loadingPromises.get(fairyType)!;
    }

    const config = FAIRY_SPRITES[fairyType];
    if (!config) {
      throw new Error(`No sprite configuration found for fairy type: ${fairyType}`);
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

        this.loadedSprites.set(fairyType, img);
        return img;
      } catch (error) {
        throw new Error(`Failed to load fairy sprite ${fairyType}: ${error}`);
      }
    })();

    this.loadingPromises.set(fairyType, promise);
    return promise;
  }

  /**
   * Get cached sprite without loading (returns undefined if not loaded yet).
   */
  getLoadedSprite(fairyType: string): HTMLImageElement | undefined {
    return this.loadedSprites.get(fairyType);
  }

  /**
   * Draw a fairy sprite onto the canvas.
   * @param ctx Canvas context
   * @param fairyType Type of fairy
   * @param x Screen X position (center)
   * @param y Screen Y position (center)
   * @param maxSize Maximum size in pixels (default 48px)
   * @returns true if sprite was drawn, false if not available
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    fairyType: string,
    x: number,
    y: number,
    maxSize: number = 48
  ): boolean {
    const img = this.getLoadedSprite(fairyType);
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
   * Preload all fairy sprites
   */
  async preloadAll(): Promise<void> {
    const allFairyTypes = Object.keys(FAIRY_SPRITES);
    await Promise.all(allFairyTypes.map((type) => this.loadSprite(type).catch(() => {})));
  }
}

export const fairyLoader = new FairyLoader();
