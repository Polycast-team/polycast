import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';

// AppRouter is a wrapper component that handles routing
function AppRouter(props) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App {...props} />} />
        {/* Fallback route to redirect any other paths to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
