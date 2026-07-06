import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MainRouter from './MainRouter';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const renderApp = () => {
  root.render(
    <React.StrictMode>
        <MainRouter/>
    </React.StrictMode>
  );
};

// Enable MSW in development only - tree-shaking friendly
if (import.meta.env.DEV) {
  // Dynamic import ensures MSW is not bundled in production
  import('./mocks/index').then(async ({ worker, setupMockSSE }) => {
    // Start MSW and wait for it to be ready
    await worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    })

    // Setup mock SSE
    setupMockSSE()

    // Render app AFTER MSW is ready
    renderApp()
  }).catch((err) => {
    console.error('Failed to initialize MSW:', err)
    // Render app anyway if MSW fails
    renderApp()
  })
} else {
  // Production mode - render immediately
  renderApp()
}
