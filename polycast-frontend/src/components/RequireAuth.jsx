import React from 'react';
import { Navigate } from 'react-router-dom';
import authClient from '../services/authClient.js';

function RequireAuth({ children }) {
  const token = authClient.getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default RequireAuth;


