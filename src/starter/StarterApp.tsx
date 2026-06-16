// src/starter/StarterApp.tsx
/**
 * StarterApp: the kit's default app, and deliberately almost nothing.
 *
 * A blank welcome screen. There is no game here on purpose: this is a
 * cozy-jam scaffold, not a template to clone. Delete this folder and build
 * your own world. AGENTS.md lists the SDK surfaces worth reaching for.
 */
import { getSafeArea } from '../services/environment';
import { theme } from '../theme';

const EXAMPLE_PROMPTS = [
  'Build a tiny tea shop where regulars wander in and I slowly learn their favorite orders.',
  'I want a balcony garden. Seeds sprout overnight, and I can send a friend a cutting.',
  "A lighthouse keeper's journal: one new page each morning, soft ambient sound, nothing to lose.",
];

export function StarterApp() {
  const safeArea = getSafeArea();
  const c = theme.colors;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: c.background,
        color: c.text.primary,
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
      }}
    >
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <div style={{ fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, letterSpacing: '-0.02em' }}>
          Stay Awhile
        </div>
        <p style={{ fontSize: theme.fontSize.lg, color: c.text.muted, margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
          Your cozy game starts here. This screen is a blank scaffold, not a game.
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.lg,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <div
            style={{
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.semibold,
              color: c.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Try telling your agent
          </div>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <div
              key={prompt}
              style={{
                border: `1px solid ${c.border}`,
                background: c.surface,
                borderRadius: theme.borderRadius.sm,
                padding: theme.spacing.md,
                fontSize: theme.fontSize.sm,
                lineHeight: 1.5,
                textAlign: 'left',
              }}
            >
              &ldquo;{prompt}&rdquo;
            </div>
          ))}
        </div>

        <p style={{ fontSize: theme.fontSize.sm, color: c.text.muted, margin: 0 }}>
          Bring your own art and sound, or grab free assets from{' '}
          <a
            href="https://github.com/series-ai/jam-ready-assets"
            target="_blank"
            rel="noreferrer"
            style={{ color: c.primary, fontWeight: theme.fontWeight.semibold }}
          >
            jam-ready-assets
          </a>
        </p>
      </main>
    </div>
  );
}

export default StarterApp;
