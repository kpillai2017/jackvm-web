/**
 * Display Module
 * 
 * Renders the 512×256 bitmapped display from Jack VM RAM.
 * 
 * Memory layout (Hack Computer):
 * - Video RAM: 16384..24575 (8192 words)
 * - Each word (16-bit) represents 16 pixels (LSB = leftmost pixel)
 * - Total: 512 × 256 pixels
 * - 32 words per row (512 pixels / 16 bits per word)
 * 
 * Rendering strategy:
 * - Use ImageData and putImageData for efficient pixel updates
 * - Support partial updates for performance
 * - Pixelated rendering for authenticity
 */

export class Display {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas to render to (512x256)
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false });
    
    // Ensure canvas is 512x256
    this.canvas.width = 512;
    this.canvas.height = 256;

    // Create image data for pixel manipulation
    this.imageData = this.ctx.createImageData(512, 256);
    this.pixels = this.imageData.data; // Uint8ClampedArray: RGBA format

    // Video RAM address space (Hack Computer standard)
    this.VRAM_START = 16384;
    this.VRAM_END = 24576;
    this.VRAM_SIZE = this.VRAM_END - this.VRAM_START; // 8192 words
    this.WORDS_PER_ROW = 32; // 512 pixels / 16 bits per word

    // Dirty cache for optimization - track which VRAM regions changed
    this.lastRam = new Int16Array(this.VRAM_SIZE);
    this.dirtyStart = 0;
    this.dirtyEnd = this.VRAM_SIZE;

    // Initialize display (black background)
    this.clear();
  }

  /**
   * Clear the display (all black) and invalidate cache
   */
  clear() {
    // Fill with black (RGBA: 0, 0, 0, 255)
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = 0;     // R
      this.pixels[i + 1] = 0; // G
      this.pixels[i + 2] = 0; // B
      this.pixels[i + 3] = 255; // A
    }
    this.ctx.putImageData(this.imageData, 0, 0);
    
    // Invalidate cache
    this.lastRam.fill(0);
    this.dirtyStart = 0;
    this.dirtyEnd = this.VRAM_SIZE;
  }

  /**
   * Detect dirty region in VRAM (changed words)
   * @param {Int16Array} ram - The VM's RAM
   * @returns {[number, number]} - [dirtyStart, dirtyEnd] or null if clean
   */
  detectDirty(ram) {
    let start = -1, end = -1;
    
    for (let i = 0; i < this.VRAM_SIZE; i++) {
      const addr = this.VRAM_START + i;
      if (ram[addr] !== this.lastRam[i]) {
        if (start === -1) start = i;
        end = i;
        this.lastRam[i] = ram[addr];
      }
    }
    
    return start === -1 ? null : [start, end + 1];
  }

  /**
   * Render the display from RAM with dirty cache optimization
   * @param {Int16Array} ram - The VM's RAM (32768 words)
   */
  render(ram) {
    if (!ram || ram.length < this.VRAM_END) {
      console.warn('Display.render: Invalid RAM provided');
      return;
    }

    // Detect which VRAM region changed
    const dirty = this.detectDirty(ram);
    if (!dirty) return; // Nothing changed

    const [dirtyStart, dirtyEnd] = dirty;
    const startAddr = this.VRAM_START + dirtyStart;
    const endAddr = this.VRAM_START + dirtyEnd;

    // Render only changed region
    for (let vramAddr = startAddr; vramAddr < endAddr; vramAddr++) {
      const word = ram[vramAddr];
      const offset = vramAddr - this.VRAM_START;

      // Calculate row and column in word grid
      const rowInWords = Math.floor(offset / this.WORDS_PER_ROW);
      const colInWords = offset % this.WORDS_PER_ROW;

      // For each of 16 bits in the word (LSB first = leftmost pixel)
      for (let bit = 0; bit < 16; bit++) {
        const pixelX = colInWords * 16 + bit;
        const pixelY = rowInWords;

        // Check if bit is set (pixel on = white, pixel off = black)
        const pixelOn = (word >> bit) & 1;

        // Update pixel in ImageData (RGBA format)
        const pixelIdx = (pixelY * 512 + pixelX) * 4;

        if (pixelOn) {
          // White pixel
          this.pixels[pixelIdx] = 255;
          this.pixels[pixelIdx + 1] = 255;
          this.pixels[pixelIdx + 2] = 255;
          this.pixels[pixelIdx + 3] = 255;
        } else {
          // Black pixel
          this.pixels[pixelIdx] = 0;
          this.pixels[pixelIdx + 1] = 0;
          this.pixels[pixelIdx + 2] = 0;
          this.pixels[pixelIdx + 3] = 255;
        }
      }
    }

    // Push updated pixels to canvas
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Render a region of the display (for optimization)
   * @param {Int16Array} ram - The VM's RAM
   * @param {number} startAddr - Starting VRAM address
   * @param {number} endAddr - Ending VRAM address (exclusive)
   */
  renderRegion(ram, startAddr, endAddr) {
    if (!ram) return;

    // Clamp to VRAM bounds
    startAddr = Math.max(startAddr, this.VRAM_START);
    endAddr = Math.min(endAddr, this.VRAM_END);

    for (let vramAddr = startAddr; vramAddr < endAddr; vramAddr++) {
      const word = ram[vramAddr];
      const offset = vramAddr - this.VRAM_START;

      const rowInWords = Math.floor(offset / this.WORDS_PER_ROW);
      const colInWords = offset % this.WORDS_PER_ROW;

      for (let bit = 0; bit < 16; bit++) {
        const pixelX = colInWords * 16 + bit;
        const pixelY = rowInWords;
        const pixelOn = (word >> bit) & 1;
        const pixelIdx = (pixelY * 512 + pixelX) * 4;

        if (pixelOn) {
          this.pixels[pixelIdx] = 255;
          this.pixels[pixelIdx + 1] = 255;
          this.pixels[pixelIdx + 2] = 255;
          this.pixels[pixelIdx + 3] = 255;
        } else {
          this.pixels[pixelIdx] = 0;
          this.pixels[pixelIdx + 1] = 0;
          this.pixels[pixelIdx + 2] = 0;
          this.pixels[pixelIdx + 3] = 255;
        }
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Get current pixel state at (x, y)
   * @param {number} x - X coordinate (0-511)
   * @param {number} y - Y coordinate (0-255)
   * @returns {boolean} - True if pixel is on (white)
   */
  getPixel(x, y) {
    if (x < 0 || x >= 512 || y < 0 || y >= 256) return false;

    const pixelIdx = (y * 512 + x) * 4;
    return this.pixels[pixelIdx] > 128; // Check if bright enough
  }

  /**
   * Get canvas element for direct manipulation if needed
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Get current image data snapshot
   * @returns {ImageData}
   */
  getImageData() {
    return this.imageData;
  }
}
