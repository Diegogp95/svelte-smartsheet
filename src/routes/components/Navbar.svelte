<script lang="ts">
    import { page } from '$app/stores';
    import { isActive } from '../utils/nav';
</script>

<header class="navbar">
    <div class="navbar__left">
        <a href="/" class="navbar__brand">
            <span class="brand-icon">⬛</span>
            <span class="brand-name">SmartSheet</span>
            <span class="brand-badge">unstable</span>
        </a>
    </div>
    <nav class="navbar__links">
        <a
            href="https://github.com/Diegogp95/svelte-smartsheet"
            target="_blank"
            rel="noopener noreferrer"
            class="navbar__link"
        >
            GitHub
        </a>
        <a href="/docs" class="navbar__link" class:navbar__link--active={isActive($page.url.pathname, '/docs')}>
            Documentation
        </a>
        <a href="/playground" class="navbar__link" class:navbar__link--active={isActive($page.url.pathname, '/playground')}>
            Playground
        </a>
    </nav>
</header>

<style>
    .navbar {
        height: var(--layout-navbar-h);
        background: var(--layout-surface);
        border-bottom: 1px solid var(--layout-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.25rem;
        gap: 1rem;
        flex-shrink: 0;
        z-index: 20;
    }

    .navbar__left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .navbar__brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 1rem;
        color: var(--layout-text);
    }
    .navbar__brand:hover { color: var(--layout-accent); }

    .brand-icon { font-size: 0.85rem; }

    .brand-badge {
        font-size: 0.6rem;
        font-weight: 500;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 4px;
        padding: 1px 5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .navbar__links {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .navbar__link {
        padding: 0.3rem 0.75rem;
        border-radius: 5px;
        font-size: 0.85rem;
        color: var(--layout-text-muted);
        transition: color 0.15s, background 0.15s;
    }
    .navbar__link:hover,
    .navbar__link--active {
        color: var(--layout-text);
        background: var(--layout-accent-glow);
    }
    .navbar__link--active {
        color: var(--layout-accent);
    }
</style>
