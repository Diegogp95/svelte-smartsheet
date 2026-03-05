import type {
    GridPosition,
    CellComponent,
    CellValue,
    HeaderComponent,
    HeaderValue,
} from '../types/types.ts';

/**
 * DataTranslator — translates grid positions into structured data objects
 * by correlating cells with their row/col header values.
 *
 * Holds references to the same Maps that DataHandler owns — reads only, never mutates.
 */
export class DataTranslator<TExtraProps, TRowHeaderProps, TColHeaderProps> {
    constructor(
        private readonly cellComponents: Map<string, CellComponent<TExtraProps>>,
        private readonly rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        private readonly colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
    ) {}

	/**
	 * Translate grid positions into structured data objects.
	 * @param positions Array of grid positions to translate
	 * @param agrupation 'row' or 'col' to determine primary grouping
	 * @returns Object mapping primary headers to secondary headers and their corresponding cell values
	 */
    public translatePositionsToData(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: { [secondaryHeader: string]: CellValue } } {
        return this.translatePositionsCore(
            positions,
            agrupation,
            (_primaryKey, posArray, getSecondaryHeader, getSecondaryIndex, secondaryHeaderCache) => {
                const groupData: { [secondaryHeader: string]: CellValue } = {};

                for (const pos of posArray) {
                    const key = `${pos.row}-${pos.col}`;
                    const cellComponent = this.cellComponents.get(key);

                    if (cellComponent) {
                        const secondaryIndex = getSecondaryIndex(pos);
                        let secondaryHeader = secondaryHeaderCache.get(secondaryIndex);
                        if (secondaryHeader === undefined) {
                            secondaryHeader = getSecondaryHeader(secondaryIndex);
                            secondaryHeaderCache.set(secondaryIndex, secondaryHeader);
                        }
                        if (secondaryHeader !== null) {
                            groupData[String(secondaryHeader)] = cellComponent.value ?? '';
                        }
                    }
                }

                return groupData;
            }
        );
    }

	/**
	 * Translate grid positions into structured header lists.
	 * @param positions Array of grid positions to translate
	 * @param agrupation 'row' or 'col' to determine primary grouping
	 * @returns Object mapping primary headers to arrays of secondary headers
	 */
    public translatePositionsToListedHeaders(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: HeaderValue[] } {
        return this.translatePositionsCore(
            positions,
            agrupation,
            (_primaryKey, posArray, getSecondaryHeader, getSecondaryIndex, secondaryHeaderCache) => {
                const headers: HeaderValue[] = [];
                const addedHeaders = new Set<string>();

                for (const pos of posArray) {
                    const cellComponent = this.cellComponents.get(`${pos.row}-${pos.col}`);

                    if (cellComponent) {
                        const secondaryIndex = getSecondaryIndex(pos);
                        let secondaryHeader = secondaryHeaderCache.get(secondaryIndex);
                        if (secondaryHeader === undefined) {
                            secondaryHeader = getSecondaryHeader(secondaryIndex);
                            secondaryHeaderCache.set(secondaryIndex, secondaryHeader);
                        }
                        if (secondaryHeader !== null) {
                            const secondaryKey = String(secondaryHeader);
                            if (!addedHeaders.has(secondaryKey)) {
                                headers.push(secondaryHeader);
                                addedHeaders.add(secondaryKey);
                            }
                        }
                    }
                }

                return headers;
            }
        );
    }

    /**
     * Translate indices into header values.
     * @param indices Array of indices to translate
     * @param headerType 'row' or 'col' to determine header type
     * @returns Array of header values corresponding to the given indices
     */
    public translateIndicesToHeaderValues(
        indices: number[],
        headerType: 'row' | 'col'
    ): HeaderValue[] {
        const headers: HeaderValue[] = [];
        const headerMap = headerType === 'row' ? this.rowHeaderComponents : this.colHeaderComponents;

        for (const index of indices) {
            const header = headerMap.get(`${headerType}-${index}`);
            if (header) {
                headers.push(header.value);
            }
        }

        return headers;
    }

    // ==================== PRIVATE ====================

	/**
	 * Helper method to group positions by row or column and process each group with a provided function.
	 * @param positions Array of grid positions to group and process
	 * @param agrupation 'row' or 'col' to determine primary grouping
	 * @param processGroup Function to process each group of positions, receiving the primary header, array of positions, and header lookup functions
	 * @returns Object mapping primary headers to processed group results
	 */
    private groupPositionsByRow(positions: GridPosition[]): Map<number, GridPosition[]> {
        const rowMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!rowMap.has(pos.row)) rowMap.set(pos.row, []);
            rowMap.get(pos.row)!.push(pos);
        }
        return rowMap;
    }

	/**
	 * Helper method to group positions by column.
	 * @param positions Array of grid positions to group
	 * @returns Map of column indices to arrays of grid positions
	 */
    private groupPositionsByCol(positions: GridPosition[]): Map<number, GridPosition[]> {
        const colMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!colMap.has(pos.col)) colMap.set(pos.col, []);
            colMap.get(pos.col)!.push(pos);
        }
        return colMap;
    }

	/**
	 * Lookup methods for header values, with caching to avoid redundant Map lookups during translation.
	 * @param row Row index for row header lookup
	 * @returns Header value for the given row index, or null if not found
	 */
    private lookForRowHeader(row: number): HeaderValue | null {
        return this.rowHeaderComponents.get(`row-${row}`)?.value ?? null;
    }

	/**
	 * Lookup methods for header values, with caching to avoid redundant Map lookups during translation.
	 * @param col Column index for column header lookup
	 * @returns Header value for the given column index, or null if not found
	 */
    private lookForColHeader(col: number): HeaderValue | null {
        return this.colHeaderComponents.get(`col-${col}`)?.value ?? null;
    }

	/**
	 * Core translation method that groups positions by row or column and processes each group with a provided function.
	 * @param positions Array of grid positions to translate
	 * @param agrupation 'row' or 'col' to determine primary grouping
	 * @param processGroup Function to process each group of positions, receiving the primary header, array of positions, and header lookup functions
	 * @returns Object mapping primary headers to processed group results
	 */
    private translatePositionsCore<T>(
        positions: GridPosition[],
        agrupation: 'row' | 'col',
        processGroup: (
            primaryKey: string,
            posArray: GridPosition[],
            getSecondaryHeader: (index: number) => HeaderValue | null,
            getSecondaryIndex: (pos: GridPosition) => number,
            secondaryHeaderCache: Map<number, HeaderValue | null>
        ) => T
    ): { [primaryHeader: string]: T } {
        const result: { [primaryHeader: string]: T } = {};

        const { groupedMap, getPrimaryHeader, getSecondaryHeader, getSecondaryIndex } =
            agrupation === 'row'
                ? {
                    groupedMap: this.groupPositionsByRow(positions),
                    getPrimaryHeader: (index: number) => this.lookForRowHeader(index),
                    getSecondaryHeader: (index: number) => this.lookForColHeader(index),
                    getSecondaryIndex: (pos: GridPosition) => pos.col,
                }
                : {
                    groupedMap: this.groupPositionsByCol(positions),
                    getPrimaryHeader: (index: number) => this.lookForColHeader(index),
                    getSecondaryHeader: (index: number) => this.lookForRowHeader(index),
                    getSecondaryIndex: (pos: GridPosition) => pos.row,
                };

        const primaryHeaderCache = new Map<number, HeaderValue | null>();

        for (const [primaryIndex, posArray] of groupedMap.entries()) {
            let primaryHeader = primaryHeaderCache.get(primaryIndex);
            if (primaryHeader === undefined) {
                primaryHeader = getPrimaryHeader(primaryIndex);
                primaryHeaderCache.set(primaryIndex, primaryHeader);
            }

            if (primaryHeader !== null) {
                const primaryKey = String(primaryHeader);
                const secondaryHeaderCache = new Map<number, HeaderValue | null>();
                result[primaryKey] = processGroup(
                    primaryKey,
                    posArray,
                    getSecondaryHeader,
                    getSecondaryIndex,
                    secondaryHeaderCache
                );
            }
        }

        return result;
    }
}
