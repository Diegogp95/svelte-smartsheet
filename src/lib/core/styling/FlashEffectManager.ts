import type {
    GridPosition,
    HeaderPosition,
    CellComponent,
    HeaderComponent,
    FlashOptions,
    VisibleComponents,
    GridDimensions,
} from '../types/types.ts';
import type { FlashEffectPort } from '../ports/FlashEffectPort.ts';

/**
 * Encapsulates all flash-effect logic.
 * Knows how to resolve positions to components and delegate to FlashEffectPort.
 */
export class FlashEffectManager<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private flashEffectPort?: FlashEffectPort;

    constructor(
        private cellComponents: Map<string, CellComponent<TExtraProps>>,
        private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        private cornerHeaderComponent: HeaderComponent,
        private getGridDimensions: () => GridDimensions,
    ) {}

    setFlashEffectPort(port: FlashEffectPort): void {
        this.flashEffectPort = port;
    }

    // ── primitives ──────────────────────────────────────────────────────────

    flashCell(cell: CellComponent<TExtraProps>, options?: FlashOptions): void {
        const color = options?.color ?? 'blue';
        const duration = options?.duration ?? 600;
        this.flashEffectPort?.flash(
            { type: 'cell', row: cell.position.row, col: cell.position.col },
            { color, duration },
        );
    }

    flashHeader(header: HeaderComponent<TColHeaderProps | TRowHeaderProps>, options?: FlashOptions): void {
        const color = options?.color ?? 'blue';
        const duration = options?.duration ?? 600;
        this.flashEffectPort?.flash(
            { type: 'header', headerType: header.position.headerType, index: header.position.index },
            { color, duration },
        );
    }

    // ── batch by positions ───────────────────────────────────────────────────

    flashCells(
        positions: GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        for (const position of positions) {
            const renderedCell = visibleComponents.cells.find(
                c => c.position.row === position.row && c.position.col === position.col,
            );
            if (renderedCell) this.flashCell(renderedCell, options);
        }
    }

    flashHeaders(
        headerPositions: HeaderPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        for (const headerPos of headerPositions) {
            let header: HeaderComponent<any> | undefined;
            if (headerPos.headerType === 'row') {
                header = this.rowHeaderComponents.get(`row-${headerPos.index}`);
            } else if (headerPos.headerType === 'col') {
                header = this.colHeaderComponents.get(`col-${headerPos.index}`);
            } else if (headerPos.headerType === 'corner') {
                header = this.cornerHeaderComponent;
            }
            if (header) this.flashHeader(header, options);
        }
    }

    flashComponents(
        components: { cells?: GridPosition[]; headers?: HeaderPosition[] },
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        if (components.cells?.length) this.flashCells(components.cells, visibleComponents, options);
        if (components.headers?.length) this.flashHeaders(components.headers, visibleComponents, options);
    }

    // ── generator-based ──────────────────────────────────────────────────────

    applyFlashEffect(
        flashGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashCells(flashGenerator(this.cellComponents), visibleComponents, options);
    }

    // ── row / col combined ───────────────────────────────────────────────────

    flashRowHeaderAndCells(
        row: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        const { maxCol } = this.getGridDimensions();
        const cells: GridPosition[] = [];
        for (let col = 0; col <= maxCol; col++) cells.push({ row, col });
        this.flashComponents({ headers: [{ headerType: 'row', index: row }], cells }, visibleComponents, options);
    }

    flashColHeaderAndCells(
        col: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        const { maxRow } = this.getGridDimensions();
        const cells: GridPosition[] = [];
        for (let row = 0; row <= maxRow; row++) cells.push({ row, col });
        this.flashComponents({ headers: [{ headerType: 'col', index: col }], cells }, visibleComponents, options);
    }

    applyRowHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        for (const row of generator(this.rowHeaderComponents)) {
            this.flashRowHeaderAndCells(row, visibleComponents, options);
        }
    }

    applyColHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        for (const col of generator(this.colHeaderComponents)) {
            this.flashColHeaderAndCells(col, visibleComponents, options);
        }
    }
}
