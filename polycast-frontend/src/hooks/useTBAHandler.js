import { useState } from 'react';

export const useTBAHandler = () => {
  const [tba, setTba] = useState(null);
  
  const showTBA = (message) => setTba(message);
  const clearTBA = () => setTba(null);
  
  return { tba, showTBA, clearTBA };
};