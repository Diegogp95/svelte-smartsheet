import type { CellValue, GridPosition } from '../types/types.ts';
import { ValueValidator } from './ValueValidator.ts';

/**
 * ClipboardParser — stateless utilities for converting between clipboard text
 * and the grid's internal value format.
 *
 * No dependency on DataHandler state — consumes a ValueValidator for type parsing.
 */
export class ClipboardParser {
    constructor(private readonly validator: ValueValidator) {}

    parse(clipboardText: string): CellValue[][] {
        if (!clipboardText || clipboardText.trim() === '') return [];

        const lines  = clipboardText.split(/\r?\n/);
        const result: CellValue[][] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === '' && i === lines.length - 1) continue;

            const rowData: CellValue[] = [];
            for (const cellText of line.split('\t')) {
                if (cellText.toLowerCase() === 'null' || cellText.toLowerCase() === 'undefined') {
                    rowData.push(null);
                } else {
                    const result = this.validator.validate(cellText, 'auto');
                    rowData.push(result.isValid ? result.value! : cellText);
                }
            }
            result.push(rowData);
        }

        return result;
    }

    format(positions: GridPosition[], cellComponents: Map<string, { value: CellValue | null | undefined }>): string {
        if (positions.length === 0) return '';

        const rowMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!rowMap.has(pos.row)) rowMap.set(pos.row, []);
            rowMap.get(pos.row)!.push(pos);
        }

        return Array.from(rowMap.keys())
            .sort((a, b) => a - b)
            .map(rowNum =>
                rowMap.get(rowNum)!
                    .sort((a, b) => a.col - b.col)
                    .map(pos => String(cellComponents.get(`${pos.row}-${pos.col}`)?.value ?? ''))
                    .join('\t')
            )
            .join('\n');
    }
}
