<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { isActive } from '../utils/nav';

    const nav = [
        {
            label: 'Playground',
            href: '/playground',
        },
        {
            label: 'Documentation',
            href: '/docs',
            children: [
                { label: 'Themes',      href: '/docs/themes' },
                { label: 'Selection',   href: '/docs/selection' },
                { label: 'Navigation',  href: '/docs/navigation' },
                { label: 'Editing',     href: '/docs/editing' },
                { label: 'Styling',     href: '/docs/styling' },
                { label: 'Imputation',  href: '/docs/imputation' },
                { label: 'Export',      href: '/docs/export' },
                { label: 'TypeScript',  href: '/docs/typescript' },
            ],
        },
    ];

    let open = false;
    let isMobile = false;

    onMount(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const update = (e: MediaQueryListEvent | MediaQueryList) => {
            isMobile = e.matches;
            open = !e.matches; // open by default on desktop, closed on mobile
        };
        update(mq);
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    });

    function close() { open = false; }
</script>

<!-- Mobile backdrop -->
{#if isMobile && open}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="sidebar-backdrop" on:click={close}></div>
{/if}

<aside class="sidebar" class:sidebar--closed={!open} class:sidebar--mobile={isMobile}>
    <nav class="sidebar__nav">
        {#each nav as item}
            {@const active = isActive($page.url.pathname, item.href)}
            <div class="sidebar__group">
                <a
                    href={item.href}
                    class="sidebar__item"
                    class:sidebar__item--active={active}
                    on:click={() => isMobile && close()}
                >
                    {item.label}
                </a>
                {#if item.children && active}
                    <ul class="sidebar__children">
                        {#each item.children as child}
                            <li>
                                <a
                                    href={child.href}
                                    class="sidebar__child"
                                    class:sidebar__child--active={isActive($page.url.pathname, child.href)}
                                    on:click={() => isMobile && close()}
                                >
                                    {child.label}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        {/each}
    </nav>
    <div class="sidebar__footer">
        <button
            class="toggle-btn"
            aria-label="Collapse sidebar"
            on:click={close}
        >‹ collapse</button>
        <span>v0.0.1-unstable</span>
    </div>
</aside>

{#if !open}
    <button
        class="expand-btn"
        aria-label="Expand sidebar"
        on:click={() => (open = true)}
    >›</button>
{/if}

<style>
    /* ── Backdrop (mobile only) ─────────────────────────── */
    .sidebar-backdrop {
        position: fixed;
        inset: 0;
        z-index: 29;
        background: rgba(0, 0, 0, 0.55);
    }

    /* ── Sidebar ────────────────────────────────────────── */
    .sidebar {
        width: var(--layout-sidebar-w);
        flex-shrink: 0;
        background: var(--layout-surface);
        border-right: 1px solid var(--layout-border);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        transition: width 0.2s ease, opacity 0.2s ease, transform 0.22s ease;
    }

    .sidebar--closed {
        width: 0;
        opacity: 0;
        pointer-events: none;
    }

    /* On mobile the sidebar is a fixed overlay drawer */
    .sidebar--mobile {
        position: fixed;
        top: var(--layout-navbar-h);
        left: 0;
        height: calc(100vh - var(--layout-navbar-h));
        z-index: 30;
        width: var(--layout-sidebar-w);
        transform: translateX(0);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
        opacity: 1;
    }

    .sidebar--mobile.sidebar--closed {
        transform: translateX(-100%);
        width: var(--layout-sidebar-w); /* keep width so animation looks right */
        opacity: 0;
        pointer-events: none;
    }

    .sidebar__nav {
        padding: 1rem 0.75rem;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .sidebar__group {
        display: flex;
        flex-direction: column;
    }

    .sidebar__item {
        padding: 0.45rem 0.75rem;
        border-radius: 5px;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--layout-text-muted);
        transition: color 0.15s, background 0.15s;
        white-space: nowrap;
    }
    .sidebar__item:hover {
        color: var(--layout-text);
        background: var(--layout-accent-glow);
    }
    .sidebar__item--active {
        color: var(--layout-accent);
        background: var(--layout-accent-glow);
    }

    .sidebar__children {
        list-style: none;
        margin: 0.1rem 0 0.25rem 0;
        padding: 0 0 0 0.75rem;
        border-left: 1px solid var(--layout-border);
        margin-left: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .sidebar__child {
        display: block;
        padding: 0.35rem 0.65rem;
        border-radius: 4px;
        font-size: 0.82rem;
        color: var(--layout-text-muted);
        transition: color 0.15s, background 0.15s;
        white-space: nowrap;
    }
    .sidebar__child:hover {
        color: var(--layout-text);
        background: var(--layout-accent-glow);
    }
    .sidebar__child--active {
        color: var(--layout-accent);
        background: var(--layout-accent-glow);
    }

    .sidebar__footer {
        padding: 0.65rem 1rem;
        font-size: 0.72rem;
        color: var(--layout-text-muted);
        border-top: 1px solid var(--layout-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
    }

    .toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--layout-text-muted);
        font-size: 0.72rem;
        font-family: inherit;
        padding: 0;
        transition: color 0.15s;
    }
    .toggle-btn:hover { color: var(--layout-accent); }

    .expand-btn {
        position: absolute;
        top: calc(var(--layout-navbar-h) + 0.75rem);
        left: 0;
        z-index: 10;
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-left: none;
        color: var(--layout-text-muted);
        cursor: pointer;
        font-size: 1rem;
        padding: 0.3rem 0.4rem;
        border-radius: 0 4px 4px 0;
        transition: color 0.15s, background 0.15s;
    }
    .expand-btn:hover {
        color: var(--layout-accent);
        background: var(--layout-accent-glow);
    }

    @media (max-width: 768px) {
        /* On mobile, expand-btn is still absolute within docs-shell, but no extra navbar offset needed */
        .expand-btn {
            top: 0.75rem;
            z-index: 31; /* above sidebar backdrop */
        }
    }
</style>
