import './index.css';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { theme, applyTheme } from './theme';
import { installUnhandledRejectionGuard } from './services/_runtime';
import { track } from './services/analytics';

// Last-resort net so a single missed .catch() on an SDK call can't crash the
// host. Per-call wrapping in src/services/* is still the real defense.
installUnhandledRejectionGuard();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[stay-awhile-jam-kit] Root element not found');
}

const root = createRoot(rootElement);

const render = (node: ReactNode) => {
  root.render(<StrictMode>{node}</StrictMode>);
};

applyTheme(theme);

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Boot beacon. track() is fire-and-forget and self-catching. Wire your own
// game's lifecycle (pause/resume/save) via src/services/lifecycles.ts.
track('game_opened', { entry_point: 'boot' });
