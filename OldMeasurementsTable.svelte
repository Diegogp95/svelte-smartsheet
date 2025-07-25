<script lang="ts">
    import type { MeasurementData, IncidentData, Invalidity } from "$lib/types";

    export let measurementsData: MeasurementData[];
    export let incidents: IncidentData[];
    export let invalidities: Invalidity[];
    export let colors: { [key: string]: string };
    export let selectState: 'cellSelect' | 'rowSelect' | 'highlight' | 'edit' | 'none' = 'highlight';
    export let viewState: 'incidents' | 'validity' | 'none' = 'incidents';
    export let exportedData: {
        timestamp: string,
        fields?: string[] | {
            [key: string]: number
        }
    }[];

    // This is a list of columns that should not be selectable
    // for highlighting the whole column, selecting the whole column,
    // selecting the cell or editing the cell. Excluding that timestamp
    // is meant to be the index column (so index 0), so the row selection
    // should be performed on the timestamp column.
    export let unselectableColumns: string[] = ['timestamp', 'date']

    const measurementKeys = Object.keys(measurementsData[0]).map(key => {
        return {
            key: key,
            selected: false
        };
    });
    const unselecColsIndex = measurementKeys.reduce((acc, key, index) => {
        if (unselectableColumns.includes(key.key)) {
            acc.push(index);
        }
        return acc;
    }, [] as number[]);

    let expandedInvalidities: ( Invalidity | null )[];

    type cellState = 'selected' | 'default' | 'invalid' | 'cell-incident' | 'row-incident' |
            'highlighted' | 'editing' | 'edited';

    let measurementsMap: {
        values: (string | number)[],
        state: cellState[]
    }[];

    // variable for tracking the cell that is being edited
    let editingCell: { row: number, col: number } | null = null;

    // variables for tracking box selected cells
    let isDragging = false;
    let startBoxCell: { row: number, col: number } | null = null;
    let endBoxCell: { row: number, col: number } | null = null;

    // variables for tracking row selection
    let isRowSelecting = false;
    let startRow: number | null = null;
    let endRow: number | null = null;

    // variable to track the current highlighted cell
    let highlightedCell: { row: number, col: number } | null = null;

    // function for initializing and reseting the state of the table
    const onSelectModeChange = (): void => {
        highlightedCell = null;
        editingCell = null;
        isDragging = false;
        startBoxCell = null;
        endBoxCell = null;
        isRowSelecting = false;
        startRow = null;
        endRow = null;
        if (viewState === 'incidents') {
            measurementsMap = measurementsData.map((measurement, index) => {
                return {
                    values: Object.values(measurement),
                    state: measurementKeys.map((key, i) => {
                        if (incidents && expandIncident[index]) {
                            if (i === 0) {
                                return expandIncident[index].table === 'plant' ?
                                    'row-incident' : 'cell-incident';
                            } else {
                                if (expandIncident[index].table === 'plant'){
                                    return 'row-incident';
                                } else if (Object.keys(expandIncident[index]?.fields!).includes(key.key)) {
                                    return 'cell-incident';
                                } else {
                                    return 'default';
                                }
                            }
                        } else {
                            return 'default';
                        }
                    })
                };
            });
        } else if (viewState === 'validity') {
            measurementsMap = measurementsData.map((measurement, index) => {
                return {
                    values: Object.values(measurement),
                    state: measurementKeys.map((key, i) => {
                        if (expandedInvalidities[index]){
                            return 'invalid';
                        } else {
                            return 'default';
                        }
                    })
                };
            });
        } else {
            measurementsMap = measurementsData.map((measurement, index) => {
                return {
                    values: Object.values(measurement),
                    state: measurementKeys.map(() => 'default')
                };
            });
        }
    };

    // function for handling the change of the view state without affecting the
    /// selected/highlighted cells
    const onViewStateChange = (): void => {
        highlightedCell = null;
        editingCell = null;
        isDragging = false;
        startBoxCell = null;
        endBoxCell = null;
        isRowSelecting = false;
        startRow = null;
        endRow = null;
        if (viewState === 'incidents') {
            for (let i = 0; i < measurementsMap.length; i++) {
                if (incidents && expandIncident[i]) {
                    if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[0]))) {
                        measurementsMap[i].state[0] = expandIncident[i]!.table === 'plant' ?
                            'row-incident' : 'cell-incident';
                    }
                    for (let j = 1; j < measurementsMap[i].state.length; j++) {
                        if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[j]))) {
                            if (expandIncident[i]!.table === 'plant') {
                                measurementsMap[i].state[j] = 'row-incident';
                            } else {
                                if (Object.keys(expandIncident[i]?.fields!).includes(
                                    measurementKeys[j].key)) {
                                    measurementsMap[i].state[j] = 'cell-incident';
                                } else {
                                    measurementsMap[i].state[j] = 'default';
                                }
                            }
                        }
                        // if selected or highlighted, keep the state
                    }
                } else {
                    for (let j = 0; j < measurementsMap[i].state.length; j++) {
                        if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[j]))) {
                            measurementsMap[i].state[j] = 'default';
                        }
                    }
                    // if selected or highlighted, keep the state
                }
            }
        }
        else if (viewState === 'validity') {
            for (let i = 0; i < measurementsMap.length; i++) {
                if (expandedInvalidities[i]){
                    for (let j = 0; j < measurementsMap[i].state.length; j++) {
                        if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[j]))) {
                            measurementsMap[i].state[j] = 'invalid';
                        }
                    }
                }
                else {
                    for (let j = 0; j < measurementsMap[i].state.length; j++) {
                        if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[j]))) {
                            measurementsMap[i].state[j] = 'default';
                        }
                    }
                }
            }
        }
        else {
            for (let i = 0; i < measurementsMap.length; i++) {
                for (let j = 0; j < measurementsMap[i].state.length; j++) {
                    if (!(['selected', 'highlighted', 'edited'].includes(measurementsMap[i].state[j]))){
                        measurementsMap[i].state[j] = 'default';
                    }
                }
            }
        }
    };

    const expandIncident = measurementsData.map((measurement, index) => {
        for (let i = 0; i < incidents.length; i++) {
            if (incidents[i].timestamp === measurement.timestamp) {
                return incidents[i];
            }
        }
        return null;
    });

    $: {
        expandedInvalidities = measurementsData.map((measurement, index) => {
            for (let i = 0; i < invalidities.length; i++) {
                if (invalidities[i].timestamp === measurement.timestamp) {
                    return invalidities[i];
                }
            }
            return null;
        });
    }
    // funtions for handling click events on cells and rows

    let handleTimestampClick: ((row: number, col: number, event: MouseEvent) => void);
    let handleCellClick: ((row: number, col: number, event: MouseEvent) => void);
    let handleComponentClick: ((row: number, col: number, event: MouseEvent) => void);
    let handleCellDoubleClick: ((row: number, col: number, event: MouseEvent) => void);
    let handleMouseDown: ((row: number, col: number, event: MouseEvent) => void);
    let handleMouseOver: ((row: number, col: number, event: MouseEvent) => void);
    let handleMouseUp: ((row: number, col: number, event: MouseEvent) => void);
    let handleRowMouseDown: ((row: number, col: number, event: MouseEvent) => void);
    let handleRowMouseOver: ((row: number, col: number, event: MouseEvent) => void);
    let handleRowMouseUp: ((row: number, col: number, event: MouseEvent) => void);

    const onCellSelectMode = (row: number, col: number, event: MouseEvent): void => {
        // this should never be triggered by a cell in an unselectable column
        if (unselecColsIndex.includes(col)) return;
        if (measurementsMap[row].state[col] === 'selected') {
            if (viewState === 'incidents') {
                if (incidents && expandIncident[row]){
                    if (expandIncident[row]!.table === 'plant') {
                        measurementsMap[row].state[col] = 'row-incident';
                    } else if (Object.keys(expandIncident[row]?.fields!)
                        .includes(measurementKeys[col].key)) {
                        measurementsMap[row].state[col] = 'cell-incident';
                    } else {
                        measurementsMap[row].state[col] = 'default';
                    }
                } else {
                    measurementsMap[row].state[col] = 'default';
                }
            } else if (viewState === 'validity') {
                if (expandedInvalidities[row]){
                    measurementsMap[row].state[col] = 'invalid';
                } else {
                    measurementsMap[row].state[col] = 'default';
                }
            } else {
                measurementsMap[row].state[col] = 'default';
            }
        } else {
            measurementsMap[row].state[col] = 'selected';
        }
    };

    const onRowSelectMode = (row: number, col: number, event: MouseEvent): void => {
        if (measurementsMap[row].state[0] === 'selected') {
            for (let j = 0; j < measurementKeys.length; j++) {
                if (viewState === 'incidents') {
                    if (incidents && expandIncident[row]){
                        if (expandIncident[row]!.table === 'plant') {
                            measurementsMap[row].state[j] = 'row-incident';
                        } else if (Object.keys(expandIncident[row]?.fields!)
                            .includes(measurementKeys[j].key) || j === 0) {
                            measurementsMap[row].state[j] = 'cell-incident';
                        } else {
                            measurementsMap[row].state[j] = 'default';
                        }
                    } else {
                        measurementsMap[row].state[j] = 'default';
                    }
                } else if (viewState === 'validity') {
                    if (expandedInvalidities[row]){
                        measurementsMap[row].state[j] = 'invalid';
                    } else {
                        measurementsMap[row].state[j] = 'default';
                    }
                } else {
                    measurementsMap[row].state[j] = 'default';
                }
            }
        } else {
            for (let j = 0; j < measurementKeys.length; j++) {
                measurementsMap[row].state[j] = 'selected';
            }
        }
    };

    const onHighlightMode = (row: number, col: number, event: MouseEvent): void => {
        if (unselecColsIndex.includes(col)) return;
        if (highlightedCell && row === highlightedCell.row && col === highlightedCell.col) {
            return;
        }
        // reset previous highlighted cells if any
        if (highlightedCell) {
            if (viewState === 'incidents') {
                // row reset
                for (let j = 0; j < measurementKeys.length; j++) {
                    if (incidents && expandIncident[highlightedCell.row]) {
                        if (expandIncident[highlightedCell.row]!.table === 'plant') {
                            measurementsMap[highlightedCell.row].state[j] = 'row-incident';
                        } else if (j === 0) {
                            measurementsMap[highlightedCell.row].state[0] = 'cell-incident';
                        }
                        else if (Object.keys(expandIncident[highlightedCell.row]?.fields!)
                            .includes(measurementKeys[j].key)) {
                            measurementsMap[highlightedCell.row].state[j] = 'cell-incident';
                        } else {
                            measurementsMap[highlightedCell.row].state[j] = 'default';
                        }
                    }
                    else {
                        measurementsMap[highlightedCell.row].state[j] = 'default';
                    }
                }
                // column reset
                for (let i = 0; i < measurementsMap.length; i++) {
                    if (incidents && expandIncident[i]) {
                        if (expandIncident[i]!.table === 'plant') {
                            measurementsMap[i].state[highlightedCell.col] = 'row-incident';
                        } else if (Object.keys(expandIncident[i]?.fields!)
                            .includes(measurementKeys[highlightedCell.col].key)) {
                            measurementsMap[i].state[highlightedCell.col] = 'cell-incident';
                        } else {
                            measurementsMap[i].state[highlightedCell.col] = 'default';
                        }
                    } else {
                        measurementsMap[i].state[highlightedCell.col] = 'default';
                    }
                }
            } else if (viewState === 'validity') {
                for (let j = 0; j < measurementKeys.length; j++) {
                    if (expandedInvalidities[highlightedCell.row]){
                        measurementsMap[highlightedCell.row].state[j] = 'invalid';
                    } else {
                        measurementsMap[highlightedCell.row].state[j] = 'default';
                    }
                }
                for (let i = 0; i < measurementsMap.length; i++) {
                    if (expandedInvalidities[i]){
                        measurementsMap[i].state[highlightedCell.col] = 'invalid';
                    } else {
                        measurementsMap[i].state[highlightedCell.col] = 'default';
                    }
                }
            } else {
                for (let j = 0; j < measurementKeys.length; j++) {
                    measurementsMap[highlightedCell.row].state[j] = 'default';
                }
                for (let i = 0; i < measurementsMap.length; i++) {
                    measurementsMap[i].state[highlightedCell.col] = 'default';
                }
            }
        }
        // highlight the new cells
        for (let i = 0; i < measurementsMap.length; i++) {
            measurementsMap[i].state[col] = 'highlighted';
        }
        for (let j = 0; j < measurementKeys.length; j++) {
            measurementsMap[row].state[j] = 'highlighted';
        }
        highlightedCell = { row, col };
    };

    const onColumnSelect = (row: number, col: number, event: MouseEvent): void => {
        if (unselecColsIndex.includes(col)) return;
        if (measurementKeys[col].selected) {
            for (let i = 0; i < measurementsMap.length; i++) {
                if (viewState === 'incidents') {
                    if (incidents && expandIncident[i]) {
                        if (expandIncident[i]!.table === 'plant') {
                            measurementsMap[i].state[col] = 'row-incident';
                        } else if (Object.keys(expandIncident[i]?.fields!)
                            .includes(measurementKeys[col].key)) {
                            measurementsMap[i].state[col] = 'cell-incident';
                        } else {
                            measurementsMap[i].state[col] = 'default';
                        }
                    } else {
                        measurementsMap[i].state[col] = 'default';
                    }
                } else if (viewState === 'validity') {
                    if (expandedInvalidities[i]){
                        measurementsMap[i].state[col] = 'invalid';
                    } else {
                        measurementsMap[i].state[col] = 'default';
                    }
                } else {
                    measurementsMap[i].state[col] = 'default';
                }
            }
            measurementKeys[col].selected = false;
        } else {
            for (let i = 0; i < measurementsMap.length; i++) {
                measurementsMap[i].state[col] = 'selected';
            }
            measurementKeys[col].selected = true;
        }
    };

    const nullFunction = (row: number, col: number, event: MouseEvent): void => {
        return;
    };

    // function to handle cell editing
    const onEditMode = (row: number, col: number, event: MouseEvent): void => {
        // until arrow navigation is implemented, we only handle enter key
        if (typeof measurementsMap[row].values[col] === 'number') {
            measurementsMap[row].state[col] = 'editing';
            editingCell = { row, col };
            // Focus the input element
            setTimeout(() => {
                const inputElement = document.querySelector(`#cell-${row}-${col} input`);
                if (inputElement) {
                    (inputElement as HTMLInputElement).focus();
                }
            }, 0);
        }
    };

    // function to handle changes of the value of a single cell in edit mode
    // should only match with incidents view state
    const handleValueChange = (row: number, col: number, newValue: any): void => {
        if (viewState !== 'incidents') return;
        const currentValue = measurementsData[row][measurementKeys[col].key];
        // check if the value is numeric
        if (!isNaN(newValue)) {
            // check for incident
            if (incidents && expandIncident[row]) {
                // check if the new value is different from the current value
                // assign the new value anyway in case there was a different value before
                // also, make changes only for cell incidents
                if (expandIncident[row].table !== 'plant') {
                    if (Object.keys(expandIncident[row]?.fields!).includes(measurementKeys[col].key)) {
                        if (newValue !== currentValue) {
                            measurementsMap[row].values[col] = newValue;
                            measurementsMap[row].state[col] = 'edited';
                        } else {
                            measurementsMap[row].state[col] = 'cell-incident';
                        }
                    } else {
                        measurementsMap[row].state[col] = 'default';
                    }
                } else {
                    measurementsMap[row].state[col] = 'row-incident';
                }
            } else {
                measurementsMap[row].state[col] = 'default';
            }
        }
        else {
            if (incidents && expandIncident[row]) {
                if (expandIncident[row].table !== 'plant') {
                    if (Object.keys(expandIncident[row]?.fields!).includes(measurementKeys[col].key)) {
                        measurementsMap[row].state[col] = 'cell-incident';
                    } else {
                        measurementsMap[row].state[col] = 'default';
                    }
                } else {
                    measurementsMap[row].state[col] = 'row-incident';
                }
            } else {
                measurementsMap[row].state[col] = 'default';
            }
        }
    };

    // function to handle input blur
    const handleInputBlur = (event: Event, row: number, col: number): void => {
        const input = event.target as HTMLInputElement;
        const newValue = parseFloat(input.value.replace(',', '.'));
        handleValueChange(row, col, newValue);
        editingCell = null;
    };

    // function to handle input keydown
    const handleInputKeydown = (event: KeyboardEvent, row: number, col: number): void => {
        if (event.key === 'Enter') {
            const input = event.target as HTMLInputElement;
            const newValue = parseFloat(input.value.replace(',', '.'));
            handleValueChange(row, col, newValue);
            editingCell = null;
        }
    };

    // function to handle paste event
    const handlePaste = (event: ClipboardEvent): void => {
        if (editingCell) {
            const clipboardData = event.clipboardData;
            const pastedData = clipboardData?.getData('text/plain');
            if (pastedData) {
                const rows = pastedData.split('\n').map(row => row.split('\t'));
                rows.forEach((row, rowIndex) => {
                    row.forEach((cell, colIndex) => {
                        const targetRow = editingCell!.row + rowIndex;
                        const targetCol = editingCell!.col + colIndex;
                        const parsedValue = parseFloat(cell.replace(',', '.'));
                        if (targetRow < measurementsMap.length && targetCol < measurementKeys.length) {
                            handleValueChange(targetRow, targetCol, parsedValue);
                        }
                    });
                });
                event.preventDefault();
            }
        }
    };

    // add event listener for paste event
    document.addEventListener('paste', handlePaste);

    // functions for handling box selection

    const onBoxMouseDown = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        if (isDragging) return; // Workaround for mouse up event outside the table (isDragging stuck)
        isDragging = true;
        startBoxCell = { row, col };
        endBoxCell = { row, col };
    };

    const onBoxMouseOver = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        if (isDragging) {
            endBoxCell = { row, col };
        }
    };

    const onBoxMouseUp = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        if (!isDragging) return; // If the mouse down event was not triggered in the table
        isDragging = false;
        endBoxCell = { row, col };
        const minRow = Math.min(startBoxCell!.row, endBoxCell!.row);
        const maxRow = Math.max(startBoxCell!.row, endBoxCell!.row);
        const minCol = Math.min(startBoxCell!.col, endBoxCell!.col);
        const maxCol = Math.max(startBoxCell!.col, endBoxCell!.col);
        for (let i = minRow; i <= maxRow; i++) {
            for (let j = minCol; j <= maxCol; j++) {
                onCellSelectMode(i, j, event);
            }
        }
        startBoxCell = null;
        endBoxCell = null;
    };

    // function to handle row selection
    const onRowMouseDown = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        if (isRowSelecting) return; // Workaround for mouse up event outside the table (isRowSelecting stuck)
        isRowSelecting = true;
        startRow = row;
        endRow = row;
    };

    const onRowMouseOver = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        if (isRowSelecting) {
            endRow = row;
        }
    };

    const onRowMouseUp = (row: number, col: number, event: MouseEvent): void => {
        if (event.button !== 0) return; // Only trigger for left mouse button
        isRowSelecting = false;
        const minRow = Math.min(startRow!, endRow!);
        const maxRow = Math.max(startRow!, endRow!);
        for (let i = minRow; i <= maxRow; i++) {
            onRowSelectMode(i, col, event);
        }
        startRow = null;
        endRow = null;
    };

    // asing the functions to the click handlers and initializing measurementsMap
    $: {
        if (selectState === 'cellSelect') {
            handleTimestampClick = nullFunction;
            handleCellClick = nullFunction;
            handleComponentClick = onColumnSelect;
            handleCellDoubleClick = nullFunction;
            handleMouseDown = onBoxMouseDown;
            handleMouseOver = onBoxMouseOver;
            handleMouseUp = onBoxMouseUp;
            handleRowMouseDown = nullFunction;
            handleRowMouseOver = nullFunction;
            handleRowMouseUp = nullFunction;
        } else if (selectState === 'rowSelect') {
            handleTimestampClick = nullFunction;
            handleCellClick = nullFunction;
            handleComponentClick = nullFunction;
            handleCellDoubleClick = nullFunction;
            handleMouseDown = nullFunction;
            handleMouseOver = nullFunction;
            handleMouseUp = nullFunction;
            handleRowMouseDown = onRowMouseDown;
            handleRowMouseOver = onRowMouseOver;
            handleRowMouseUp = onRowMouseUp;
        } else if (selectState === 'highlight') {
            handleTimestampClick = onHighlightMode;
            handleCellClick = onHighlightMode;
            handleComponentClick = nullFunction;
            handleCellDoubleClick = nullFunction;
            handleMouseDown = nullFunction;
            handleMouseOver = nullFunction;
            handleMouseUp = nullFunction;
            handleRowMouseDown = nullFunction;
            handleRowMouseOver = nullFunction;
            handleRowMouseUp = nullFunction;
        } else if (selectState === 'edit') {
            handleTimestampClick = nullFunction;
            handleCellClick = nullFunction;
            handleComponentClick = nullFunction;
            handleCellDoubleClick = onEditMode;
            handleMouseDown = nullFunction;
            handleMouseOver = nullFunction;
            handleMouseUp = nullFunction;
            handleRowMouseDown = nullFunction;
            handleRowMouseOver = nullFunction;
            handleRowMouseUp = nullFunction;
        } else {
            handleTimestampClick = nullFunction;
            handleCellClick = nullFunction;
            handleComponentClick = nullFunction;
            handleCellDoubleClick = nullFunction;
            handleMouseDown = nullFunction;
            handleMouseOver = nullFunction;
            handleMouseUp = nullFunction;
            handleRowMouseDown = nullFunction;
            handleRowMouseOver = nullFunction;
            handleRowMouseUp = nullFunction;
        }
        onSelectModeChange();
    }

    let initialViewState = viewState;

    $: {
        if (viewState !== initialViewState) {
            onViewStateChange();
            initialViewState = viewState;
        }
    }

    $: {
        if (invalidities) {
            onViewStateChange();
        }
    }

    // exported data for incidents / invalidities editing
    // some reactive statements might be very inefficient
    // as they run on ocassions that are not necessary
    // this might be improved by using runes
    // when migrating to svelte 5
    // here the exported data will be updated even when the selectState is 'none'
    // while on highlighting mode, this is inneficient

    $: {
        if (selectState === 'cellSelect') {
            exportedData = measurementsMap.reduce((acc, measurement, index) => {
                if (measurement.state.some(state => state === 'selected')) {
                    acc.push({
                        timestamp: measurementsData[index].timestamp,
                        fields: measurementKeys
                            .filter((key, i) => measurement.state[i] === 'selected')
                            .map(key => key.key)
                    });
                }
                return acc;
            }, [] as { timestamp: string; fields?: string[] }[]);
        } else if (selectState === 'rowSelect') {
            exportedData = measurementsMap.reduce((acc, measurement, index) => {
                if (measurement.state[0] === 'selected') {
                    acc.push({
                        timestamp: measurementsData[index].timestamp
                    });
                }
                return acc;
            }, [] as { timestamp: string; }[]);
        } else if (selectState === 'edit') {
            exportedData = measurementsMap.reduce((acc, measurement, index) => {
                const editedFields = measurement.state.reduce((fields, state, i) => {
                    if (state === 'edited' && typeof measurement.values[i] === 'number') {
                        fields[measurementKeys[i].key] = measurement.values[i];
                    }
                    return fields;
                }, {} as { [key: string]: number });
                if (Object.keys(editedFields).length > 0) {
                    acc.push({
                        timestamp: measurementsData[index].timestamp,
                        fields: editedFields
                    });
                }
                return acc;
            }, [] as { timestamp: string; fields: { [key: string]: number } }[]);
        } else {
            exportedData = [];
        }
    }

</script>

<style>
    /*
        Selection of text in the cells is not desired, since the intrinsic paragraph
        style of selection for html tables does not fit the use case of this component.
        Still, we cannot disable it completely, since the navigation on selection
        is useful for click and drag selection and box selection.
        The following style is a compromise to make the selection less intrusive.
        In the future, if we can control the navigation in an overflowed table
        (scrollable table), in a custom manner, we can disable the selection completely.
     */
    .transparentSelection::selection {
        color: inherit;
        background: transparent;
    }
</style>

<table class="text-tertiaryOnBg border-separate text-sm cursor-pointer">
    <thead>
        <tr>
            {#each measurementKeys as key, index}
                <th class={`border-2 border-tertiaryOnBg px-2 sticky top-0 ${index === 0 ? 'left-0 z-20' : 'z-10'}
                    ${key.selected ? 'bg-[rgb(255,127,80)]' : 'bg-tertiaryOnHover'} transparentSelection`}
                    on:click={(e) => handleComponentClick(0, index, e)}>
                    {key.key}
                </th>
            {/each}
        </tr>
    </thead>
    <tbody>
        {#each measurementsMap as measurement, i}
            <tr>
                {#each measurement.values as value, j}
                    {#if j===0}
                        <td class={`border-2 border-tertiaryOnBg px-2 sticky left-0 z-10 transparentSelection
                            ${isRowSelecting && (startRow !== null && endRow !== null) && i >= Math.min(startRow, endRow)
                                && i <= Math.max(startRow, endRow)
                                ? 'bg-tertiary2xHighlightBg'
                                :
                                measurementsMap[i].state[j] === 'highlighted'
                                        || measurementsMap[i].state[j] === 'selected'
                                    ? 'bg-[rgb(255,127,80)]'
                                    : measurementsMap[i].state[j] === 'row-incident'
                                    ? `bg-${colors[expandIncident[i]?.fields?.['plant'] || '']}
                                        text-black`
                                    : measurementsMap[i].state[j] === 'cell-incident'
                                    ? `bg-${colors['UNK']} text-black`
                                    : measurementsMap[i].state[j] === 'invalid'
                                    ? 'bg-red-500'
                                    : 'bg-tertiaryOnHover'
                            }`}
                            on:click={(event) => handleTimestampClick(i, j, event)}
                            on:mousedown={(event) => handleRowMouseDown(i, j, event)}
                            on:mouseover={(event) => handleRowMouseOver(i, j, event)}
                            on:mouseup={(event) => handleRowMouseUp(i, j, event)}
                        >{typeof value === 'string' ? value.replace('T', ' ') : value}
                        </td>
                    {:else}
                        <td id={`cell-${i}-${j}`} class={`border-2 px-2 transparentSelection
                            ${isDragging && (startBoxCell && endBoxCell) && i >= Math.min(startBoxCell.row, endBoxCell.row)
                                && i <= Math.max(startBoxCell.row, endBoxCell.row)
                                && j >= Math.min(startBoxCell.col, endBoxCell.col)
                                && j <= Math.max(startBoxCell.col, endBoxCell.col)
                                ? 'bg-tertiary2xHighlightBg'
                                :
                                measurementsMap[i].state[j] === 'edited'
                                    ? 'border-tertiaryHighlightBorder bg-tertiaryHighlightBg'
                                    : measurementsMap[i].state[j] === 'highlighted'
                                        || measurementsMap[i].state[j] === 'selected'
                                    ? 'bg-[rgb(255,127,80)] border-tertiaryOnBg'
                                    : measurementsMap[i].state[j] === 'row-incident'
                                    ? `bg-${colors[expandIncident[i]?.fields?.['plant']
                                        || '']} border-tertiaryOnBg text-black`
                                    : measurementsMap[i].state[j] === 'cell-incident'
                                    ? `bg-${colors[expandIncident[i]?.fields?.[measurementKeys[j].key]
                                        || '']} border-tertiaryOnBg text-black`
                                    : measurementsMap[i].state[j] === 'invalid'
                                    ? 'bg-red-500 border-tertiaryOnBg'
                                    : 'bg-tertiaryBg border-tertiaryOnBg'
                            }`}
                            on:click={(e) => handleCellClick(i, j, e)}
                            on:dblclick={(e) => handleCellDoubleClick(i, j, e)}
                            on:mousedown={(e) => handleMouseDown(i, j, e)}
                            on:mouseover={(e) => handleMouseOver(i, j, e)}
                            on:mouseup={(e) => handleMouseUp(i, j, e)}>
                            {#if measurementsMap[i].state[j] === 'editing'}
                                <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={value} class="w-full
                                    bg-tertiaryOnHover border-tertiaryOnBg"
                                    on:blur={(e) => handleInputBlur(e, i, j)}
                                    on:keydown={(e) => handleInputKeydown(e, i, j)} />
                            {:else}
                                {typeof value === 'number' ? value.toFixed(3) : value}
                            {/if}
                        </td>
                    {/if}
                {/each}
            </tr>
        {/each}
    </tbody>
</table>