/**
 * Manages the scale factor and scaled dimension arrays for the virtualized grid.
 *
 * Owns the shared row-height and column-width arrays (modified in-place during
 * scaling so that other handlers holding references see the update) together
 * with their immutable base copies used to recompute scaled values.
 */
export class ScaleManager {
    private scaleFactor: number = 1.0;

    // Shared references — modified in-place so all holders see scale changes
    private rowHeights: number[] = [];
    private colWidths: number[] = [];

    // Immutable base copies used to recompute scaled arrays
    private baseRowHeights: number[] = [];
    private baseColWidths: number[] = [];

    setRowHeights(heights: number[]): void {
        this.rowHeights = heights;
        this.baseRowHeights = [...heights];
    }

    setColWidths(widths: number[]): void {
        this.colWidths = widths;
        this.baseColWidths = [...widths];
    }

    setScaleFactor(factor: number): void {
        if (factor <= 0) {
            console.warn('[ScaleManager] Scale factor must be positive');
            return;
        }
        this.scaleFactor = factor;
    }

    getScaleFactor(): number {
        return this.scaleFactor;
    }

    /**
     * Recompute shared arrays from base dimensions and the current scale factor.
     * Modifies arrays in-place so callers holding references see the update.
     */
    updateSharedDimensionsFromBase(): void {
        for (let i = 0; i < this.baseRowHeights.length; i++) {
            this.rowHeights[i] = this.baseRowHeights[i] * this.scaleFactor;
        }
        for (let i = 0; i < this.baseColWidths.length; i++) {
            this.colWidths[i] = this.baseColWidths[i] * this.scaleFactor;
        }
    }

    /**
     * Scale a CSS font-size string by the current scale factor.
     * Supports px, em, rem units. Returns the original string for unsupported formats.
     */
    getScaledFontSize(baseFontSize: string): string {
        const match = baseFontSize.match(/^([\d.]+)(px|em|rem)$/);
        if (!match) {
            console.warn(`[ScaleManager] Unsupported font size format: ${baseFontSize}`);
            return baseFontSize;
        }
        const numericSize = parseFloat(match[1]);
        const unit = match[2];
        return `${numericSize * this.scaleFactor}${unit}`;
    }

    /** Shared row-heights array reference (modified in-place during scaling). */
    getRowHeights(): number[] {
        return this.rowHeights;
    }

    /** Shared column-widths array reference (modified in-place during scaling). */
    getColWidths(): number[] {
        return this.colWidths;
    }
}
