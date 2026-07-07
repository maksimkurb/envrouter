import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const V2App = React.lazy(() => import('./AppV2'));

function MainRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={null}>
        <Routes>
          {/* Redirects for pre-swap bookmarks (old /v1 and /v2 URLs) */}
          <Route path="/v2/repo" element={<Navigate to="/repo" replace />} />
          <Route path="/v1/*" element={<Navigate to="/" replace />} />
          <Route path="/v2/*" element={<Navigate to="/" replace />} />

          {/* The shadcn UI is the only interface, at the root */}
          <Route path="/*" element={<V2App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default MainRouter;
