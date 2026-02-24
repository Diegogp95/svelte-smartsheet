<script lang="ts">
    import { page } from '$app/stores';
    import { isActive } from '../utils/nav';

    let menuOpen = false;

    function closeMenu() { menuOpen = false; }
</script>

<header class="navbar">
    <div class="navbar__left">
        <a href="/" class="navbar__brand" on:click={closeMenu}>
            <span class="brand-icon">⬛</span>
            <span class="brand-name">SmartSheet</span>
            <span class="brand-badge">unstable</span>
        </a>
    </div>

    <!-- Desktop nav -->
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

    <!-- Hamburger button (mobile only) -->
    <button
        class="hamburger"
        class:hamburger--open={menuOpen}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        on:click={() => (menuOpen = !menuOpen)}
    >
        <span class="hamburger__bar"></span>
        <span class="hamburger__bar"></span>
        <span class="hamburger__bar"></span>
    </button>
</header>

<!-- Mobile dropdown -->
{#if menuOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="mobile-backdrop" on:click={closeMenu}></div>
    <nav class="mobile-menu">
        <a
            href="https://github.com/Diegogp95/svelte-smartsheet"
            target="_blank"
            rel="noopener noreferrer"
            class="mobile-menu__link"
            on:click={closeMenu}
        >
            GitHub ↗
        </a>
        <a
            href="/docs"
            class="mobile-menu__link"
            class:mobile-menu__link--active={isActive($page.url.pathname, '/docs')}
            on:click={closeMenu}
        >
            Documentation
        </a>
        <a
            href="/playground"
            class="mobile-menu__link"
            class:mobile-menu__link--active={isActive($page.url.pathname, '/playground')}
            on:click={closeMenu}
        >
            Playground
        </a>
    </nav>
{/if}

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
        position: relative;
        z-index: 40;
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

    /* ── Hamburger (hidden on desktop) ──────────────────── */
    .hamburger {
        display: none;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.35rem;
        border-radius: 5px;
        transition: background 0.15s;
    }
    .hamburger:hover { background: var(--layout-accent-glow); }

    .hamburger__bar {
        display: block;
        width: 20px;
        height: 2px;
        background: var(--layout-text-muted);
        border-radius: 2px;
        transition: transform 0.2s ease, opacity 0.2s ease, background 0.15s;
        transform-origin: center;
    }
    .hamburger:hover .hamburger__bar { background: var(--layout-text); }

    /* Animate bars into X when open */
    .hamburger--open .hamburger__bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger--open .hamburger__bar:nth-child(2) { opacity: 0; }
    .hamburger--open .hamburger__bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    /* ── Mobile backdrop ─────────────────────────────────── */
    .mobile-backdrop {
        position: fixed;
        inset: 0;
        z-index: 38;
    }

    /* ── Mobile dropdown menu ────────────────────────────── */
    .mobile-menu {
        position: fixed;
        top: var(--layout-navbar-h);
        left: 0;
        right: 0;
        z-index: 39;
        background: var(--layout-surface);
        border-bottom: 1px solid var(--layout-border);
        display: flex;
        flex-direction: column;
        padding: 0.5rem 0.75rem 0.75rem;
        gap: 0.15rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .mobile-menu__link {
        padding: 0.6rem 0.75rem;
        border-radius: 5px;
        font-size: 0.9rem;
        color: var(--layout-text-muted);
        transition: color 0.15s, background 0.15s;
    }
    .mobile-menu__link:hover,
    .mobile-menu__link--active {
        color: var(--layout-text);
        background: var(--layout-accent-glow);
    }
    .mobile-menu__link--active { color: var(--layout-accent); }

    /* ── Responsive ──────────────────────────────────────── */
    @media (max-width: 768px) {
        .navbar__links { display: none; }
        .hamburger     { display: flex; }
    }
</style>
