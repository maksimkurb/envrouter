import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MainRouter from './MainRouter';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MainRouter/>
  </React.StrictMode>
);
