import { useState } from 'react';

export const useErrorHandler = () => {
  const [error, setError] = useState(null);

  const showError = (message) => setError(message);
  const clearError = () => setError(null);

  return { error, showError, clearError };
};
// import { useState, useCallback } from 'react';

// export const useErrorHandler = () => {
//   const [error, setError] = useState(null);

//   const showError = useCallback((message) => {
//     setError(message);
//   }, []);

//   const clearError = useCallback(() => {
//     setError(null);
//   }, []);

//   return {
//     error,
//     showError,
//     clearError
//   };
// };