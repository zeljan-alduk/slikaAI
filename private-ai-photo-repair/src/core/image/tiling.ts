import { createCanvas, get2dContext, imageDataToCanvas } from "./canvasUtils";

export interface Tile {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TilePlan {
  tiles: Tile[];
  cols: number;
  rows: number;
  tileSize: number;
  needsTiling: boolean;
}

/**
 * Plan a tiling grid for an image. When the image fits within a single tile,
 * a single full-image tile is returned (needsTiling = false).
 */
export function planTiles(
  width: number,
  height: number,
  tileSize: number,
): TilePlan {
  if (width <= tileSize && height <= tileSize) {
    return {
      tiles: [{ index: 0, x: 0, y: 0, width, height }],
      cols: 1,
      rows: 1,
      tileSize,
      needsTiling: false,
    };
  }
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  const tiles: Tile[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * tileSize;
      const y = row * tileSize;
      tiles.push({
        index,
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      });
      index += 1;
    }
  }
  return { tiles, cols, rows, tileSize, needsTiling: true };
}

export function extractTile(source: ImageData, tile: Tile): ImageData {
  const sourceCanvas = imageDataToCanvas(source);
  const target = createCanvas(tile.width, tile.height);
  const ctx = get2dContext(target);
  ctx.drawImage(
    sourceCanvas as CanvasImageSource,
    tile.x,
    tile.y,
    tile.width,
    tile.height,
    0,
    0,
    tile.width,
    tile.height,
  );
  return ctx.getImageData(0, 0, tile.width, tile.height);
}

/**
 * Merge processed tiles back into a single ImageData of the given output size.
 * Each processed tile may be scaled relative to its source tile (e.g. 2x).
 */
export function mergeTiles(
  outputWidth: number,
  outputHeight: number,
  placements: { tile: Tile; data: ImageData; scale: number }[],
): ImageData {
  const canvas = createCanvas(outputWidth, outputHeight);
  const ctx = get2dContext(canvas);
  for (const { tile, data, scale } of placements) {
    const tileCanvas = imageDataToCanvas(data);
    ctx.drawImage(tileCanvas as CanvasImageSource, tile.x * scale, tile.y * scale);
  }
  return ctx.getImageData(0, 0, outputWidth, outputHeight);
}
