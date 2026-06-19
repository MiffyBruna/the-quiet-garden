/**
 * Sprite loading and management system for plant and entity sprites.
 * Handles sprite sheets with multiple stages/frames.
 */

export interface SpriteDefinition {
  imagePath: string;
  spriteWidth: number;
  spriteHeight: number;
  stageCount: number; // number of stages (0-4 for plants)
}

export interface LoadedSprite {
  image: HTMLImageElement;
  definition: SpriteDefinition;
}

// Sprite sheet definitions
export const PLANT_SPRITES: Record<string, SpriteDefinition> = {
  blue_grama: {
    imagePath: '/src/game/assets/plants/blue-grama.png',
    spriteWidth: 48,
    spriteHeight: 56,
    stageCount: 5,
  },
  // Add more plants as you create them
  // sage: { imagePath: '...', spriteWidth: 48, spriteHeight: 56, stageCount: 5 },
  // lupine: { imagePath: '...', spriteWidth: 48, spriteHeight: 56, stageCount: 5 },
};

class SpriteLoader {
  private loadedSprites: Map<string, LoadedSprite> = new Map();
  private loadingPromises: Map<string, Promise<LoadedSprite>> = new Map();

  /**
   * Load a sprite sheet image asynchronously.
   * Results are cached, so multiple calls for the same sprite are fast.
   */
  async loadSprite(plantType: string): Promise<LoadedSprite> {
    // Return cached result if available
    if (this.loadedSprites.has(plantType)) {
      return this.loadedSprites.get(plantType)!;
    }

    // Return pending promise if already loading
    if (this.loadingPromises.has(plantType)) {
      return this.loadingPromises.get(plantType)!;
    }

    // Load the sprite
    const definition = PLANT_SPRITES[plantType];
    if (!definition) {
      throw new Error(`No sprite definition found for plant type: ${plantType}`);
    }

    const promise = new Promise<LoadedSprite>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const loaded: LoadedSprite = { image: img, definition };
        this.loadedSprites.set(plantType, loaded);
        resolve(loaded);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load sprite: ${definition.imagePath}`));
      };
      img.src = definition.imagePath;
    });

    this.loadingPromises.set(plantType, promise);
    return promise;
  }

  /**
   * Get cached sprite without loading (returns undefined if not loaded yet).
   */
  getLoadedSprite(plantType: string): LoadedSprite | undefined {
    return this.loadedSprites.get(plantType);
  }

  /**
   * Draw a specific stage of a plant sprite onto the canvas.
   * @param ctx Canvas context
   * @param plantType Type of plant (e.g., 'blue_grama')
   * @param stage Growth stage (0-4)
   * @param x Screen X position (center)
   * @param y Screen Y position (center)
   * @param scale Scale factor (default 1.0)
   * @returns true if sprite was drawn, false if not available
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    plantType: string,
    stage: number,
    x: number,
    y: number,
    scale: number = 1.0
  ): boolean {
    const loaded = this.getLoadedSprite(plantType);
    if (!loaded) return false; // Not loaded yet

    const { image, definition } = loaded;
    const { spriteWidth, spriteHeight } = definition;

    // Clamp stage to valid range
    const clampedStage = Math.max(0, Math.min(stage, definition.stageCount - 1));

    // Source position in sprite sheet (stages are arranged horizontally)
    const sourceX = clampedStage * spriteWidth;
    const sourceY = 0;

    // Destination size (with scale)
    const destWidth = spriteWidth * scale;
    const destHeight = spriteHeight * scale;

    // Draw centered at (x, y)
    ctx.drawImage(
      image,
      sourceX, sourceY, // source position
      spriteWidth, spriteHeight, // source size
      x - destWidth / 2, y - destHeight / 2, // destination position (centered)
      destWidth, destHeight // destination size
    );

    return true;
  }

  /**
   * Preload sprites to avoid loading delays during gameplay.
   */
  async preloadSprites(plantTypes: string[]): Promise<void> {
    await Promise.all(plantTypes.map((type) => this.loadSprite(type)));
  }
}

export const spriteLoader = new SpriteLoader();
