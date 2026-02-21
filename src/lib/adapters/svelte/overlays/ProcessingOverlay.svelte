<script lang="ts">
    export let message: string = "Processing...";
</script>

<div class="ss-processing-overlay">
    <div class="ss-processing-overlay__content">
        <div class="ss-processing-overlay__spinner"></div>
        <div class="ss-processing-overlay__message">{message}</div>
    </div>
</div>

<style>
    .ss-processing-overlay {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 500ms;
        background-color: var(--ss-processing-bg, rgba(0, 0, 0, 0.25));
    }

    .ss-processing-overlay__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: var(--ss-processing-spinner, #ffffff);
        user-select: none;
        pointer-events: none;
    }

    .ss-processing-overlay__spinner {
        width: 3rem;
        height: 3rem;
        border: 4px solid var(--ss-processing-spinner, #ffffff);
        border-top-color: transparent;
        border-radius: 50%;
        animation: ss-spin 0.75s linear infinite;
    }

    @keyframes ss-spin {
        to { transform: rotate(360deg); }
    }

    .ss-processing-overlay__message {
        font-size: 2.25rem;
        font-weight: 700;
        font-family: serif;
        letter-spacing: 0.05em;
    }
</style>