import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MainRouter from './MainRouter';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const renderApp = () => {
  root.render(
    <React.StrictMode>
        <MainRouter/>
    </React.StrictMode>
  );
  
  reportWebVitals();
};

// Enable MSW in development
if (import.meta.env.DEV) {
  import('./mocks').then(async ({ worker, setupMockSSE }) => {
    // Start MSW and wait for it to be ready
    await worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    })
    

    // Setup mock SSE
    setupMockSSE()
    
    // Render app AFTER MSW is ready
    renderApp()
  })
} else {
  // Production mode - render immediately
  renderApp()
}
