<script lang="ts">
	import SmartSheet from "$lib/adapters/svelte/SmartSheet.svelte";
	import { testData } from "./testdata.ts";

</script>

<h1>SmartSheet Demo</h1>
<h2>Simple show and play with demo</h2>


<div style="width: 100%; height: 400px; border: 1px solid black; overflow: auto;">
	<SmartSheet
		gridData={testData}
		fontSize="0.75rem"
		theme="dark"
	/>
</div>