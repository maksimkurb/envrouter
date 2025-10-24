import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import V2App from './AppV2';

function MainRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* V2 Routes (shadcn) - полностью отдельный интерфейс */}
        <Route path="/v2/*" element={<V2App />} />
        
        {/* V1 Routes (MUI) - fallback */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  )
}

export default MainRouter;
