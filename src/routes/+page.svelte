<script lang="ts">
	import SmartSheet from "$lib/adapters/svelte/SmartSheet.svelte";
	import { testData } from "./testdata.ts";

</script>
<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>


<div style="width: 100%; height: 400px; border: 1px solid black; overflow: auto;">
	<SmartSheet gridData={testData} />
</div>