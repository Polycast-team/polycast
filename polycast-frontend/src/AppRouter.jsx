import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import RequireAuth from './components/RequireAuth.jsx';

// AppRouter is a wrapper component that handles routing
function AppRouter(props) {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RequireAuth><App {...props} /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Fallback route to redirect any other paths to home */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default AppRouter;
