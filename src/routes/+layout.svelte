<script lang="ts">
    import Navbar from './components/Navbar.svelte';
</script>

<div class="layout">

    <!-- ── Navbar ── -->
    <Navbar />

    <!-- ── Page outlet ── -->
    <div class="outlet">
        <slot />
    </div>

</div>

<style>
    /* ── Global tokens ───────────────────────────────────── */
    :global(:root) {
        --layout-bg:            #0a0a0f;
        --layout-surface:       #111118;
        --layout-border:        #1e1e2e;
        --layout-text:          #c9d1d9;
        --layout-text-muted:    #6b7280;
        --layout-accent:        #58a6ff;
        --layout-accent-glow:   rgba(88, 166, 255, 0.15);
        --layout-navbar-h:      3.25rem;
        --layout-sidebar-w:     220px;
    }

    :global(*) { box-sizing: border-box; }
    :global(*::before) { box-sizing: border-box; }
    :global(*::after) { box-sizing: border-box; }
    :global(body) {
        margin: 0;
        background: var(--layout-bg);
        color: var(--layout-text);
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 0.9rem;
    }
    :global(a) { color: inherit; text-decoration: none; }

    /* ── Layout shell ────────────────────────────────────── */
    .layout {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .outlet {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }


</style>
