# SmartSheet

> An Excel-like spreadsheet component for svelte, as right now, the core is not completely decoupled from the UI, but the plan is to refactor it into a framework-agnostic engine with separate adapters for Svelte, React, etc. The Svelte adapter is the first implementation and will be published as `svelte-smartsheet` on npm.

<!-- Badges — update once published -->
![Version](https://img.shields.io/badge/version-0.0.1--unstable-orange)
![Svelte](https://img.shields.io/badge/svelte-5-ff3e00?logo=svelte)
![License](https://img.shields.io/badge/license-MIT-blue)
<!-- ![npm](https://img.shields.io/npm/v/smart-sheet) -->

---

## What is SmartSheet?

SmartSheet is an **excel-like spreadsheet-engine library** for Svelte — an real performant option for when you need to show large grids of data and need to interact with it, all of this embeded in your Svelte app. It provides a powerful API for navigation, selection, styling, and data imputation, along with built-in themes and a fully virtualized rendering engine to keep things smooth even with large datasets.

---

## Features

- **DOM virtualization** — only visible rows and columns are rendered, keeping large grids smooth
- **Keyboard navigation** — full arrow-key movement, ctrl+arrow to jump, page up/down support
- **Multi-cell selection** — click, drag, header-row/col selection with derived cell highlights
- **Inline editing** — double-click, enter or just type to edit cells, with built-in support for text and numbers
- **Cell & header styling API** — programmatic per cell background colors APIs, so you can build heatmaps, conditional formatting, etc.
- **Data imputation layer** — visual striped overlay for computed / imputed values
- **Ctrl + scroll to zoom** — which will be improved in future releases
- **5 built-in themes** — `light`, `dark`, `tech`, `glow`, `neon` — all CSS custom properties
- **TypeScript generics** — fully typed `extraProps` on cells and headers, to enhance those entities with non-visual metadata that can be used in API functions (styling, selection, navigation, imputation, etc.)
- **Copy / paste support** — clipboard integration to interact with your own spreadsheets
- **History manager** — undo/redo full support with visual feedback of affected cells
- **Export APIs** — extract your grid's data with the extraction API callbacks

---

## Themes

Apply a theme via the `theme` prop:

```svelte
<SmartSheet theme="tech" ... />
```

| Theme   | Description |
|---------|-------------|
| `light` | Clean white, default |
| `dark`  | Dark grays, subtle blue accents |
| `tech`  | GitHub-dark inspired, blue headers |
| `glow`  | Deep space / aurora, cyan & purple |
| `neon`  | High-contrast neon on near-black |

All theme tokens are CSS custom properties (`--ss-*`), so you can override any of them from your own stylesheet.

---

## Installation

> ⚠️ Not yet published to npm. Coming soon.

```bash
# npm i smart-sheet   ← placeholder, package name TBD
```

In the meantime, clone the repo and reference it locally:

```bash
git clone https://github.com/Diegogp95/svelte-smartsheet.git
```

---

## Quick Start

```svelte
<script lang="ts">
  import { SmartSheet } from 'svelte-smartsheet';

  const colHeaders = ['Score', 'Status'];
  const rowHeaders = ['Alice', 'Bob'];
  const cornerHeader = 'Players';
  const data = [
    [85, 'active'],
    [72, 'inactive'],
  ];
</script>

<!-- The spreadsheet takes the full dimensions of your container -->
<div style="width: 100%; height: 400px;">
  <SmartSheet
  	gridData={data}
  	columnHeaders={colHeaders}
  	rowHeaders={rowHeaders}
  	cornerHeader={cornerHeader}
  	theme="tech"
  />
</div>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gridData` | `CellValue[][]` | — | *(required)* 2-D array of cell values |
| `columnHeaders` | `HeaderValue[]` | `undefined` | Column header labels |
| `rowHeaders` | `HeaderValue[]` | `undefined` | Row header labels |
| `rowsTitle` | `string` | `''` | Label for the row-header column corner |
| `theme` | `'light'\|'dark'\|'tech'\|'glow'\|'neon'` | `'tech'` | Built-in visual theme |
| `fontSize` | `string` | `'1rem'` | Base font size |
| `minCellWidth` | `string` | `'6rem'` | Minimum column width |
| `minCellHeight` | `string` | `'3rem'` | Minimum row height |
| `headersReadOnly` | `boolean` | `true` | Prevent inline header editing |
| `numberFormat` | `'anglo'\|'latin'` | `'anglo'` | Decimal / thousands separator style |
| `numberDisplayOptions` | `NumberDisplayOptions` | `{ decimalPlaces: 3 }` | Number rendering configuration |
| `initialPointerPosition` | `GridPosition` | `undefined` | Cell to focus on mount (useful for re-renders) |
| `extraPropsMatrix` | `TExtraProps[][]` | `undefined` | Custom metadata matrix, typed via generic |

---

## Public API (methods on the component ref)

> Bind a ref with `bind:this={ref}` to access these.

### Navigation
| Method | Description |
|--------|-------------|
| `getPointerPosition()` | Current pointer `{ row, col }` |
| `navigateToPosition(pos)` | Move pointer to a position |
| `navigateToFirst(matcher)` | Navigate to first cell matching predicate |
| `navigateToNext(matcher)` | Navigate to next cell matching predicate |

### Selection
| Method | Description |
|--------|-------------|
| `selectPositions(positions[])` | Select an array of grid positions |
| `selectHeaders(type, indices[])` | Select row or column headers by index |
| `applySelections(generator)` | Select via function over the cell map |
| `clearSelection()` | Deselect everything |

### Styling
| Method | Description |
|--------|-------------|
| `colorizeCell(pos, color)` | Set background on a single cell |
| `colorizeHeader(type, index, color)` | Set background on a header |
| `applyBackgroundStyles(generator)` | Batch cell background styles |
| `resetAllBackgrounds()` | Clear all background overrides |
| `resetAllStyles()` | Clear all style overrides |

### Data / Imputation
| Method | Description |
|--------|-------------|
| `imputeValues(imputations[])` | Inject computed values with striped overlay |
| `applyImputations(generator)` | Batch imputation via cell-map generator |

### Processing state
| Method | Description |
|--------|-------------|
| `setExternalProcessing(msg, op?)` | Show processing overlay |
| `clearExternalProcessing()` | Clear processing overlay |

### Export
| Method | Description |
|--------|-------------|
| `exportSelectedCells()` | Export selected cells as `{ header: values[] }` |
| `extractChangedCells()` | Export only edited cells |
| `extractChangedCellsWithValues()` | Export edits as `{ header: { header: value } }` |
| `extractSelectedRows()` | Array of selected row header values |
| `extractSelectedCols()` | Array of selected column header values |

---

## APIs and generics usage (with TypeScript)
When using TypeScript, you must define a type for your extraProps if you want to fully leverage the APIs (coloring, selection, navigation, imputation, etc.).
* Define your type, the extraPropsMatrix should be a 2D array of it.
```ts
type CellStatus = {
	status: 'active' | 'inactive' | 'unknown';
};
let myExtraProps: CellStatus[][];
```
* Create a typed reference to the SmartSheet and bind it to the component.
```ts
let smartSheetRef: SmartSheet<CellStatus>;
...
<SmartSheet
	bind:this={smartSheetRef}
	...
	extraPropsMatrix={myExtraProps}
/>
```
* The types will be inferred automatically, so you’ll have full type safety when accessing extraProps inside API functions.
```ts
function colorizeByStatus() {
	if (!smartSheetRef) return; // safety check
	smartSheetRef.applyBackgroundStyles((cells) => {
		const out: [GridPosition, any][] = [];
		for (const cell of cells.values()) {
			const cellStatus = cell.extraProps.status;
			let color;
			if (!cellStatus) {
				color = undefined;
			} else if (cellStatus === 'active') {
				color = 'green';
			} else if (cellStatus === 'inactive'){
				color = 'red';
			} else {
				color = 'lightblue'
			}
			out.push([cell.position, { 'background-color': color }]);
		}
		return out;
	});
}
```
* This way, your extraProps are fully typed, making SmartSheet APIs easier to use and less error-prone.

---

## Custom Theming

All visual tokens are CSS custom properties. Override any of them on the wrapper or in your global styles:

```css
/* override just a couple of variables in the tech theme */
.my-sheet-wrapper {
  --ss-pointer-border: #f59e0b;
  --ss-cell-text: #e2e8f0;
}
```

Key variables:

| Variable | Purpose |
|----------|---------|
| `--ss-grid-bg` | Sheet background |
| `--ss-cell-bg` / `--ss-cell-text` | Cell background and text |
| `--ss-header-bg` / `--ss-header-text` | Header background and text |
| `--ss-border-color` | Grid border / separator |
| `--ss-pointer-border` / `--ss-pointer-bg` | Cell pointer ring |
| `--ss-grid-shadow` | Navigation active glow color |
| `--ss-selection-border` / `--ss-selection-bg` | Selection overlay |
| `--ss-font-family` | Font stack |

---

## Roadmap

- [ ] Live demo / playground page
- [ ] Decoulple engine and refactor
- [ ] Set up testing environment and CI with unit and integration tests
- [ ] npm publish (stable `1.0.0`)
- [ ] Documentation site
- [ ] Column and row resizing by drag
- [ ] Sort / filter integration hooks
- [ ] React adapter

---

## Contributing

<!-- TODO: add contributing guide -->

This project is in active early development. If you find a bug or have a feature idea, feel free to open an issue. Once a stable testing environment is set up, contributions will be very welcome!

---

## License

MIT © Diego Gallegos
