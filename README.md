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