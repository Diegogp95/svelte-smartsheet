<script lang="ts">
    import Sidebar from '../components/Sidebar.svelte';
</script>

<div class="docs-shell">
    <Sidebar />

    <!-- ── Main content ── -->
    <main class="docs-main">
        <slot />
    </main>
</div>

<style>
    .docs-shell {
        display: flex;
        flex: 1;
        overflow: hidden;
        height: 100%;
        position: relative;
    }

    .docs-main {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1.5rem 2rem;
        min-width: 0;
    }
</style>