<script lang="ts">
    export let title: string = 'Coming soon';
    export let description: string = 'This section is still being written.';
</script>

<div class="uc">
    <div class="uc__icon">🚧</div>
    <h2 class="uc__title">{title}</h2>
    <p class="uc__desc">{description}</p>
    <span class="uc__badge">under construction</span>
</div>

<style>
    .uc {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 2rem;
        border: 1px dashed var(--layout-border);
        border-radius: 10px;
        background: var(--layout-surface);
        max-width: 520px;
    }

    .uc__icon {
        font-size: 2rem;
        line-height: 1;
    }

    .uc__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--layout-text);
    }

    .uc__desc {
        margin: 0;
        font-size: 0.85rem;
        color: var(--layout-text-muted);
        line-height: 1.5;
    }

    .uc__badge {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        background: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 4px;
        padding: 2px 7px;
    }
</style>
