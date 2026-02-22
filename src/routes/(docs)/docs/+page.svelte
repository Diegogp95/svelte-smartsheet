<div class="docs-index">
    <h1>Documentation</h1>
    <p class="subtitle">Coming soon — step-by-step documentation for each SmartSheet feature.</p>

    <div class="cards">
        {#each [
            { label: 'Themes',      href: '/docs/themes',     desc: 'All 5 built-in themes side by side'             },
            { label: 'Selection',   href: '/docs/selection',  desc: 'Click, drag, header and programmatic selection'  },
            { label: 'Navigation',  href: '/docs/navigation', desc: 'Keyboard navigation and pointer control'         },
            { label: 'Editing',     href: '/docs/editing',    desc: 'Inline cell and header editing'                  },
            { label: 'Styling',     href: '/docs/styling',    desc: 'Cell colorization, heatmaps, batch styling'      },
            { label: 'Imputation',  href: '/docs/imputation', desc: 'Computed value overlay with striped indicator'   },
            { label: 'Export',      href: '/docs/export',     desc: 'Extract selected and changed cells'              },
            { label: 'TypeScript',  href: '/docs/typescript', desc: 'Typed extraProps and API generics'               },
        ] as card}
            <a href={card.href} class="card">
                <span class="card__label">{card.label}</span>
                <span class="card__desc">{card.desc}</span>
                <span class="card__badge">soon</span>
            </a>
        {/each}
    </div>
</div>

<style>
    .docs-index {
        max-width: 780px;
    }

    h1 {
        margin: 0 0 0.4rem;
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--layout-text);
    }

    .subtitle {
        margin: 0 0 2rem;
        color: var(--layout-text-muted);
        font-size: 0.88rem;
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.75rem;
    }

    .card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 1rem 1.1rem;
        border: 1px solid var(--layout-border);
        border-radius: 8px;
        background: var(--layout-surface);
        transition: border-color 0.15s, background 0.15s;
        cursor: pointer;
        text-decoration: none;
    }
    .card:hover {
        border-color: var(--layout-accent);
        background: var(--layout-accent-glow);
    }

    .card__label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--layout-text);
    }

    .card__desc {
        font-size: 0.78rem;
        color: var(--layout-text-muted);
        line-height: 1.4;
    }

    .card__badge {
        position: absolute;
        top: 0.6rem;
        right: 0.75rem;
        font-size: 0.6rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--layout-text-muted);
        border: 1px solid var(--layout-border);
        border-radius: 4px;
        padding: 1px 5px;
    }
</style>
