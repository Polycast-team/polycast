/**
 * Touch Gesture Handler for Mobile Flashcards
 * Handles swipe, tap, and other touch interactions
 */

export class TouchGestureHandler {
  constructor(element, callbacks = {}) {
    this.element = element;
    this.callbacks = callbacks;
    this.touchStart = null;
    this.touchEnd = null;
    this.isLongPress = false;
    this.longPressTimer = null;
    
    // Gesture thresholds
    this.minSwipeDistance = 50;
    this.maxVerticalDeviation = 100;
    this.longPressDelay = 500;
    this.tapTimeout = 150; // Reduced for faster tap response
    this.moveThreshold = 5; // Pixels moved before canceling tap
    
    this.bindEvents();
  }

  bindEvents() {
    if (!this.element) return;

    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

    // Mouse events for desktop testing
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  handleTouchStart(e) {
    this.touchStart = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    this.touchEnd = null;
    this.isLongPress = false;
    this.isTap = true; // Assume tap until proven otherwise

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.isTap = false;
      this.triggerHapticFeedback('light');
      this.callbacks.onLongPress?.(e, this.touchStart);
    }, this.longPressDelay);

    this.callbacks.onTouchStart?.(e, this.touchStart);
  }

  handleTouchMove(e) {
    if (!this.touchStart) return;

    // Clear long press timer on move
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.touchEnd = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };

    // Calculate swipe distance and direction
    const deltaX = this.touchEnd.x - this.touchStart.x;
    const deltaY = this.touchEnd.y - this.touchStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Cancel tap if moved too much
    if (distance > this.moveThreshold) {
      this.isTap = false;
    }

    // Prevent scrolling on significant swipes
    if (distance > this.minSwipeDistance) {
      e.preventDefault();
    }

    // Call drag callback for real-time position updates
    console.log('[TOUCH DEBUG] Touch move:', { deltaX, deltaY, distance });
    this.callbacks.onDrag?.(e, this.touchStart, this.touchEnd, { deltaX, deltaY, distance });

    this.callbacks.onTouchMove?.(e, this.touchStart, this.touchEnd, { deltaX, deltaY, distance });
  }

  handleTouchEnd(e) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (!this.touchStart) return;

    // If it was a long press, don't process other gestures
    if (this.isLongPress) {
      this.touchStart = null;
      return;
    }

    if (this.isTap && !this.touchEnd) {
      // Simple tap - no movement detected
      const tapDuration = Date.now() - this.touchStart.time;
      if (tapDuration < this.tapTimeout) {
        this.triggerHapticFeedback('light');
        this.callbacks.onTap?.(e, this.touchStart);
      }
    } else if (!this.isTap && this.touchEnd) {
      // Movement detected - check for swipe
      this.processSwipeGesture(e);
    }

    this.touchStart = null;
    this.touchEnd = null;
    this.callbacks.onTouchEnd?.(e);
  }

  handleTouchCancel(e) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.touchStart = null;
    this.touchEnd = null;
    this.callbacks.onTouchCancel?.(e);
  }

  processSwipeGesture(e) {
    if (!this.touchStart || !this.touchEnd) return;

    const deltaX = this.touchEnd.x - this.touchStart.x;
    const deltaY = this.touchEnd.y - this.touchStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = this.touchEnd.time - this.touchStart.time;

    // Check if it's a valid swipe
    if (distance < this.minSwipeDistance || duration > 1000) {
      return;
    }

    // Determine swipe direction
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const absAngle = Math.abs(angle);
    const velocity = distance / duration;

    let direction = null;
    let isValid = false;

    if (absAngle <= 30 || absAngle >= 150) {
      // Horizontal swipe
      if (Math.abs(deltaY) <= this.maxVerticalDeviation) {
        direction = deltaX > 0 ? 'right' : 'left';
        isValid = true;
      }
    } else if (absAngle >= 60 && absAngle <= 120) {
      // Vertical swipe
      if (Math.abs(deltaX) <= this.maxVerticalDeviation) {
        direction = deltaY > 0 ? 'down' : 'up';
        isValid = true;
      }
    }

    if (isValid && direction) {
      this.triggerHapticFeedback('medium');
      this.callbacks.onSwipe?.(e, {
        direction,
        distance,
        velocity,
        deltaX,
        deltaY,
        duration,
        startPoint: this.touchStart,
        endPoint: this.touchEnd
      });
    }
  }

  // Mouse events for desktop testing
  handleMouseDown(e) {
    this.handleTouchStart({
      touches: [{ clientX: e.clientX, clientY: e.clientY }],
      preventDefault: () => e.preventDefault()
    });
  }

  handleMouseMove(e) {
    if (this.touchStart) {
      this.handleTouchMove({
        touches: [{ clientX: e.clientX, clientY: e.clientY }],
        preventDefault: () => e.preventDefault()
      });
    }
  }

  handleMouseUp(e) {
    this.handleTouchEnd({
      preventDefault: () => e.preventDefault()
    });
  }

  handleMouseLeave(e) {
    this.handleTouchCancel({
      preventDefault: () => e.preventDefault()
    });
  }

  triggerHapticFeedback(intensity = 'light') {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 50, 10],
        error: [50, 50, 50]
      };
      navigator.vibrate(patterns[intensity] || patterns.light);
    }
  }

  destroy() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    if (!this.element) return;

    // Remove touch events
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);

    // Remove mouse events
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mousemove', this.handleMouseMove);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);
  }
}

/**
 * Hook for using touch gestures in React components
 */
export function useTouchGestures(ref, callbacks) {
  React.useEffect(() => {
    if (!ref.current) return;

    const gestureHandler = new TouchGestureHandler(ref.current, callbacks);

    return () => {
      gestureHandler.destroy();
    };
  }, [ref, callbacks]);
}