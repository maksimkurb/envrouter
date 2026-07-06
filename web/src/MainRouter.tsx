import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Code-split: v1 (MUI) and v2 (shadcn) are separate bundles, so opening one
// UI doesn't download the other.
const App = React.lazy(() => import('./App'));
const V2App = React.lazy(() => import('./AppV2'));

function MainRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={null}>
        <Routes>
          {/* Legacy v1 UI (MUI) lives in a subfolder */}
          <Route path="/v1/*" element={<App />} />

          {/* Redirects for pre-swap bookmarks */}
          <Route path="/v2/repo" element={<Navigate to="/repo" replace />} />
          <Route path="/v2/*" element={<Navigate to="/" replace />} />

          {/* V2 (shadcn) is the default interface at the root */}
          <Route path="/*" element={<V2App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default MainRouter;
