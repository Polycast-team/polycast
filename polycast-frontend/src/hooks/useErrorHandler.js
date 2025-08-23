import { useState } from 'react';

export const useErrorHandler = () => {
  const [error, setError] = useState(null);

  const showError = (message) => setError(message);
  const clearError = () => setError(null);

  return { error, showError, clearError };
};
