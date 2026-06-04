import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const DesktopApp = lazy(() => import('./pages/DesktopApp.jsx'));

const App = () => {
  return (
    <Suspense fallback={<div className="route-loading">Loading Open-New-Jarvis...</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<DesktopApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
