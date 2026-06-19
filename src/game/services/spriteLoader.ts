/**
 * Sprite loading and management for plant sprites.
 * Uses individual PNG files per growth stage (0-4).
 */

import { loadCdnAsset } from './assetLoader';

export interface PlantSpriteConfig {
  baseFilename: string; // e.g., 'blue-grama' (files will be 'blue-grama-0.png', 'blue-grama-1.png', etc.)
}

// Plant sprite configurations
export const PLANT_SPRITES: Record<string, PlantSpriteConfig> = {
  blue_grama: {
    baseFilename: 'blue-grama',
  },
  desert_marigold: {
    baseFilename: 'desert-marigold',
  },
  lupine: {
    baseFilename: 'lupine',
  },
  milkweed: {
    baseFilename: 'milkweed',
  },
  sage: {
    baseFilename: 'sage',
  },
  // Add more plants as you create them:
};

class SpriteLoader {
  // Maps 'blue_grama-stage' -> HTMLImageElement
  private loadedSprites: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Get the cache key for a specific plant stage
   */
  private getCacheKey(plantType: string, stage: number): string {
    return `${plantType}-${stage}`;
  }

  /**
   * Load a specific growth stage sprite asynchronously.
   */
  async loadSprite(plantType: string, stage: number): Promise<HTMLImageElement> {
    const cacheKey = this.getCacheKey(plantType, stage);

    // Return cached result if available
    if (this.loadedSprites.has(cacheKey)) {
      return this.loadedSprites.get(cacheKey)!;
    }

    // Return pending promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Get plant config
    const config = PLANT_SPRITES[plantType];
    if (!config) {
      throw new Error(`No sprite configuration found for plant type: ${plantType}`);
    }

    const promise = (async () => {
      try {
        // Load the sprite from CDN assets
        const filename = `${config.baseFilename}-${stage}.png`;
        const blobUrl = await loadCdnAsset(filename);

        // Create image and load from blob URL
        const img = new Image();
        img.src = blobUrl;

        // Wait for image to load
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load sprite: ${filename}`));
        });

        this.loadedSprites.set(cacheKey, img);
        return img;
      } catch (error) {
        throw new Error(`Failed to load sprite ${plantType} stage ${stage}: ${error}`);
      }
    })();

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Get cached sprite without loading (returns undefined if not loaded yet).
   */
  getLoadedSprite(plantType: string, stage: number): HTMLImageElement | undefined {
    return this.loadedSprites.get(this.getCacheKey(plantType, stage));
  }

  /**
   * Draw a specific growth stage sprite onto the canvas.
   * @param ctx Canvas context
   * @param plantType Type of plant (e.g., 'blue_grama')
   * @param stage Growth stage (0-4)
   * @param x Screen X position (center)
   * @param y Screen Y position (center)
   * @param maxSize Maximum size in pixels to scale to (default 20px for a 24px tile with padding)
   * @returns true if sprite was drawn, false if not available
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    plantType: string,
    stage: number,
    x: number,
    y: number,
    maxSize: number = 20
  ): boolean {
    // Clamp stage to valid range (0-4)
    const clampedStage = Math.max(0, Math.min(Math.floor(stage), 4));

    const img = this.getLoadedSprite(plantType, clampedStage);
    if (!img) return false; // Not loaded yet

    // Calculate scaled dimensions to fit within maxSize while maintaining aspect ratio
    const aspectRatio = img.width / img.height;
    let width = maxSize;
    let height = maxSize / aspectRatio;

    // If height exceeds maxSize, scale based on height instead
    if (height > maxSize) {
      height = maxSize;
      width = maxSize * aspectRatio;
    }

    // Draw centered at (x, y)
    ctx.drawImage(img, x - width / 2, y - height / 2, width, height);

    return true;
  }

  /**
   * Preload all stages of a plant to avoid loading delays during gameplay.
   */
  async preloadPlant(plantType: string): Promise<void> {
    // Load all 5 stages (0-4)
    await Promise.all([
      this.loadSprite(plantType, 0),
      this.loadSprite(plantType, 1),
      this.loadSprite(plantType, 2),
      this.loadSprite(plantType, 3),
      this.loadSprite(plantType, 4),
    ]);
  }

  /**
   * Preload multiple plants
   */
  async preloadPlants(plantTypes: string[]): Promise<void> {
    await Promise.all(plantTypes.map((type) => this.preloadPlant(type)));
  }
}

export const spriteLoader = new SpriteLoader();
