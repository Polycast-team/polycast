# MobileFlashcardMode Performance Analysis

## Root Causes of Performance Issues

### 1. **Excessive Re-renders from State Updates**
- The component re-renders on every touch move event during dragging
- Non-memoized callbacks are recreated on each render
- State updates trigger cascading re-renders

### 2. **Heavy Render Calculations**
- Example sentences are parsed on every render
- Card styling calculations happen inline
- No memoization of expensive computations

### 3. **CSS Performance Issues**
- Complex box-shadows calculated dynamically during drag
- Multiple gradient backgrounds with backdrop filters
- Animations running on non-optimized properties

## Recommended Fixes

### 1. **Throttle Touch Move Events**
```javascript
// Add throttling to touch move handler
const throttledSetDragState = useCallback(
  throttle((newState) => {
    setDragState(newState);
  }, 16), // ~60fps
  []
);
```

### 2. **Memoize Heavy Calculations**
```javascript
// Memoize parsed sentences
const parsedSentences = useMemo(() => {
  if (!currentCard?.exampleSentencesGenerated) return null;
  const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
  const interval = currentCard?.srsData?.interval || 1;
  const sentenceIndex = ((interval - 1) % 5) * 2;
  return {
    english: parts[sentenceIndex] || parts[0] || '',
    translation: parts[sentenceIndex + 1] || parts[1] || ''
  };
}, [currentCard]);
```

### 3. **Use CSS Transform for Drag Feedback**
Instead of updating box-shadow and background-color during drag, use CSS transforms and pre-defined classes:
```css
.mobile-flashcard.dragging-left {
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.5);
}
.mobile-flashcard.dragging-right {
  box-shadow: 0 0 30px rgba(34, 197, 94, 0.5);
}
```

### 4. **Debounce useEffect Updates**
Add a flag to prevent rapid useEffect executions:
```javascript
const [isUpdatingDueCards, setIsUpdatingDueCards] = useState(false);

useEffect(() => {
  if (isUpdatingDueCards || processingCardRef.current) return;
  
  setIsUpdatingDueCards(true);
  // ... update logic
  setTimeout(() => setIsUpdatingDueCards(false), 100);
}, [availableCards, todaysNewCards]);
```

### 5. **Use RAF for Smooth Animations**
```javascript
const updateDragState = useCallback((deltaX, deltaY) => {
  requestAnimationFrame(() => {
    const rotation = deltaX * 0.1;
    const opacity = Math.max(0.3, 1 - (Math.abs(deltaX) / 200));
    const colorIntensity = Math.min(1, Math.abs(deltaX) / 200);
    
    setDragState({
      isDragging: true,
      deltaX,
      deltaY: 0,
      rotation,
      opacity,
      colorIntensity
    });
  });
}, []);
```

### 6. **Optimize CSS Animations**
- Remove `will-change` from always-visible elements
- Use `transform` and `opacity` only for animations
- Pre-calculate gradients and shadows
- Use CSS containment: `contain: layout style paint`

### 7. **Reduce Component Complexity**
Consider splitting the component into smaller, memoized sub-components:
- `FlashcardFront`
- `FlashcardBack`
- `AnswerButtons`
- `ProgressBar`

This will help React optimize re-renders more efficiently.

## Quick Wins

1. Add `React.memo()` to child components
2. Use `useMemo()` for expensive calculations
3. Throttle touch move events to 60fps
4. Pre-calculate styles outside render
5. Use CSS classes instead of inline styles for drag states