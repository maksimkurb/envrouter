import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Code-split: v1 (MUI) and v2 (shadcn) are separate bundles, so opening one
// UI doesn't download the other.
const App = React.lazy(() => import('./App'));
const V2App = React.lazy(() => import('./AppV2'));

function MainRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={null}>
        <Routes>
          {/* V2 Routes (shadcn) - полностью отдельный интерфейс */}
          <Route path="/v2/*" element={<V2App />} />

          {/* V1 Routes (MUI) - fallback */}
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default MainRouter;
