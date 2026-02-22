<script lang="ts">
    import SmartSheet from '$lib/adapters/svelte/SmartSheet.svelte';
    import type { HeaderValue } from '$lib/core/types/types';

    const features = [
        { icon: '⚡', title: 'DOM Virtualization',    desc: 'Only visible cells are rendered. Large datasets stay smooth.' },
        { icon: '⌨️', title: 'Keyboard Navigation',   desc: 'Full arrow-key movement, Ctrl+arrow jumps, Page Up/Down.' },
        { icon: '🎯', title: 'Multi-cell Selection',  desc: 'Click, drag, header selection, and programmatic select APIs.' },
        { icon: '✏️', title: 'Inline Editing',        desc: 'Double-click or just type to edit cells and headers in place.' },
        { icon: '🎨', title: 'Styling API',           desc: 'Colorize cells programmatically. Build heatmaps, highlights.' },
        { icon: '🔢', title: 'TypeScript Generics',   desc: 'Fully typed extraProps on cells and headers for your metadata.' },
        { icon: '📋', title: 'Clipboard Support',     desc: 'Copy and paste with your own spreadsheet or browser clipboard.' },
        { icon: '🎁', title: '5 Built-in Themes',     desc: 'light, dark, tech, glow, neon — all in CSS custom properties.' },
    ];

    const columnHeaders: HeaderValue[] = ['Q1-1', 'Q1-2', 'Q1-3', 'Q1-24', 'Q2-1', 'Q2-2', 'Q2-3', 'Q2-4'];
    const rowHeaders: HeaderValue[] = ['Revenue', 'COGS', 'Gross Profit', 'OpEx', 'EBITDA', 'Net Income', 'EPS', 'YoY Growth'];
    const gridData = [
        [142000, 158000, 171000, 183000, 195000, 210000, 240000, 270000],
        [ 68000,  74000,  80000,  85000,  90000,  95000, 100000, 110000],
        [ 74000,  84000,  91000,  98000, 105000, 115000, 140000, 160000],
        [ 31000,  34000,  36000,  38000,  40000,  42000,  45000,  48000],
        [ 43000,  50000,  55000,  60000,  65000,  73000,  95000, 112000],
		[ 31000,  40000,  45000,  50000,  55000,  62000,  90000, 120000],
		[   0.22,   0.27,   0.32,   0.37,   0.42,   0.50,   0.75,    1.0],
		[   '5%',    '6%',    '7%',    '8%',    '9%',   '10%',   '15%',   '20%'],
    ];
</script>

<div class="landing">

    <!-- ── Hero ── -->
    <section class="hero">
        <div class="hero__text">
            <div class="hero__eyebrow">Svelte component library</div>
            <h1 class="hero__title">
                Spreadsheets,<br>
                <span class="hero__title--accent">done right.</span>
            </h1>
            <p class="hero__desc">
                SmartSheet is a virtualized, Excel-like spreadsheet component for Svelte.
                Built with a framework-agnostic engine, a powerful TypeScript API, and five
                ready-to-use themes — no Tailwind required.
            </p>
            <div class="hero__ctas">
                <a href="/playground" class="cta cta--primary">Try the Playground →</a>
                <a href="/docs" class="cta cta--secondary">Documentation</a>
                <a
                    href="https://github.com/Diegogp95/svelte-smartsheet"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cta cta--ghost"
                >GitHub ↗</a>
            </div>
            <p class="hero__warning">
                ⚠️ Early unstable release — APIs may change.
            </p>
        </div>

        <div class="hero__demo">
            <div class="demo-label">Live embed — fully interactive</div>
            <div class="demo-sheet">
                <SmartSheet
                    {gridData}
                    {columnHeaders}
                    {rowHeaders}
                    rowsTitle="P&L"
                    theme="tech"
                    fontSize="0.625rem"
                />
            </div>
        </div>
    </section>

    <!-- ── Features ── -->
    <section class="features">
        <h2 class="section-title">What's inside</h2>
        <div class="feature-grid">
            {#each features as f}
                <div class="feature-card">
                    <span class="feature-card__icon">{f.icon}</span>
                    <div>
                        <div class="feature-card__title">{f.title}</div>
                        <div class="feature-card__desc">{f.desc}</div>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- ── Quick start ── -->
    <section class="quickstart">
        <h2 class="section-title">Quick start</h2>
        <pre class="code-block"><code
>&lt;script lang="ts"&gt;
  import &#123; SmartSheet &#125; from 'svelte-smartsheet';

  const data = [
    ['Name',  'Score', 'Status'],
    ['Alice',  94,     'active'],
    ['Bob',    72,  'inactive'],
  ];
&lt;/script&gt;

&lt;div style="width:100%; height:400px;"&gt;
  &lt;SmartSheet gridData=&#123;data&#125; theme="tech" /&gt;
&lt;/div&gt;</code></pre>
    </section>

    <footer class="landing__footer">
        MIT © Diego Gallegos &nbsp;·&nbsp;
        <a href="https://github.com/Diegogp95/svelte-smartsheet" target="_blank" rel="noopener noreferrer">
            GitHub
        </a>
    </footer>

</div>

<style>
    .landing {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* ── Hero ────────────────────────────────────────────── */
    .hero {
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: 2.5rem;
        align-items: start;
        padding: 4rem 4rem 3rem;
        max-width: 1280px;
        margin: 0 auto;
    }

    .hero__eyebrow {
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--layout-accent);
        margin-bottom: 0.75rem;
    }

    .hero__title {
        font-size: 3rem;
        font-weight: 800;
        line-height: 1.1;
        margin: 0 0 1.25rem;
        color: var(--layout-text);
    }

    .hero__title--accent {
        color: var(--layout-accent);
    }

    .hero__desc {
        font-size: 1rem;
        line-height: 1.65;
        color: var(--layout-text-muted);
        margin: 0 0 1.75rem;
        max-width: 460px;
    }

    .hero__ctas {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
    }

    .cta {
        display: inline-flex;
        align-items: center;
        padding: 0.55rem 1.1rem;
        border-radius: 6px;
        font-size: 0.87rem;
        font-weight: 500;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        text-decoration: none;
    }
    .cta--primary {
        background: var(--layout-accent);
        color: #0a0a0f;
        border: 1px solid var(--layout-accent);
    }
    .cta--primary:hover {
        background: #79b8ff;
        border-color: #79b8ff;
    }
    .cta--secondary {
        background: var(--layout-accent-glow);
        color: var(--layout-accent);
        border: 1px solid var(--layout-accent);
    }
    .cta--secondary:hover {
        background: rgba(88, 166, 255, 0.25);
    }
    .cta--ghost {
        background: transparent;
        color: var(--layout-text-muted);
        border: 1px solid var(--layout-border);
    }
    .cta--ghost:hover {
        color: var(--layout-text);
        border-color: var(--layout-text-muted);
    }

    .hero__warning {
        margin: 0;
        font-size: 0.75rem;
        color: var(--layout-text-muted);
    }

    .hero__demo {
        display: flex;
        width: 100%;
        min-width: 0;   /* grid items default to min-width:auto — this lets the cell shrink */
        flex-direction: column;
        gap: 0.5rem;
        align-self: start;
    }

    .demo-label {
        font-size: 0.72rem;
        color: var(--layout-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .demo-sheet {
        width: 100%;
        height: 360px;
        position: relative;  /* establishes a containing block for the grid's absolute children */
        overflow: hidden;    /* prevents the virtualizer from expanding the container */
        border-radius: 8px;
        border: 1px solid var(--layout-border);
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }

    /* ── Features ────────────────────────────────────────── */
    .features {
        padding: 2.5rem 4rem;
        max-width: 1200px;
        margin: 0 auto;
        border-top: 1px solid var(--layout-border);
    }

    .section-title {
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--layout-text);
        margin: 0 0 1.5rem;
    }

    .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.75rem;
    }

    .feature-card {
        display: flex;
        gap: 0.85rem;
        align-items: flex-start;
        padding: 1rem;
        border: 1px solid var(--layout-border);
        border-radius: 8px;
        background: var(--layout-surface);
        transition: border-color 0.15s;
    }
    .feature-card:hover {
        border-color: rgba(88, 166, 255, 0.4);
    }

    .feature-card__icon {
        font-size: 1.2rem;
        flex-shrink: 0;
        margin-top: 0.1rem;
    }

    .feature-card__title {
        font-size: 0.87rem;
        font-weight: 600;
        color: var(--layout-text);
        margin-bottom: 0.2rem;
    }

    .feature-card__desc {
        font-size: 0.78rem;
        color: var(--layout-text-muted);
        line-height: 1.45;
    }

    /* ── Quick start ─────────────────────────────────────── */
    .quickstart {
        padding: 2.5rem 4rem 3rem;
        max-width: 1200px;
        margin: 0 auto;
        border-top: 1px solid var(--layout-border);
    }

    .code-block {
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-radius: 8px;
        padding: 1.25rem 1.5rem;
        overflow-x: auto;
        font-size: 0.82rem;
        line-height: 1.6;
        color: #c9d1d9;
        font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
        margin: 0;
    }

    /* ── Footer ──────────────────────────────────────────── */
    .landing__footer {
        border-top: 1px solid var(--layout-border);
        padding: 1.25rem 4rem;
        text-align: center;
        font-size: 0.78rem;
        color: var(--layout-text-muted);
        max-width: 1200px;
        margin: 0 auto;
    }
    .landing__footer a {
        color: var(--layout-accent);
    }
    .landing__footer a:hover {
        text-decoration: underline;
    }

    /* ── Responsive ──────────────────────────────────────── */

    /* Medium: two columns but tighter */
    @media (max-width: 1100px) {
        .hero {
            gap: 1.75rem;
            padding: 3rem 2.5rem 2.5rem;
        }
        .hero__title { font-size: 2.5rem; }
        .demo-sheet { height: 320px; }
        .features, .quickstart { padding-left: 2.5rem; padding-right: 2.5rem; }
        .landing__footer { padding-left: 2.5rem; padding-right: 2.5rem; }
    }

    /* Small: single column, demo below text */
    @media (max-width: 760px) {
        .hero {
            grid-template-columns: 1fr;
            padding: 2.25rem 1.25rem 1.75rem;
        }
        .hero__title { font-size: 2rem; }
        .demo-sheet { height: 280px; }
        .features, .quickstart { padding-left: 1.25rem; padding-right: 1.25rem; }
        .landing__footer { padding-left: 1.25rem; padding-right: 1.25rem; }
    }
</style>
