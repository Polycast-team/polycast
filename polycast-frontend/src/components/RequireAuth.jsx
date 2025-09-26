import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import authClient from '../services/authClient.js';

function RequireAuth({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = authClient.getToken();
      if (!token) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      try {
        // Verify token is still valid by calling /api/auth/me
        await authClient.me();
        setIsAuthenticated(true);
      } catch (error) {
        console.warn('Token validation failed:', error);
        // Clear invalid token
        authClient.clearToken();
        setIsAuthenticated(false);
      }
      setIsChecking(false);
    };

    checkAuth();
  }, []);

  if (isChecking) {
    return <div>Checking authentication...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default RequireAuth;


