import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import VideoPage from './components/VideoPage.jsx';

// AppRouter is a wrapper component that handles routing
function AppRouter(props) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App {...props} />} />
        <Route path="/video" element={<VideoPage />} />
        <Route path="/video/" element={<VideoPage />} /> {/* Handle trailing slash */}
        {/* Fallback route to redirect any other paths to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
