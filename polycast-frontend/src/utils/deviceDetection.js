/**
 * Device Detection Utilities
 * Handles mobile vs desktop detection for routing
 */

/**
 * Check if the current device is mobile based on screen size and user agent
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  // Check user agent for mobile devices (primary indicator)
  const mobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    navigator.userAgent
  );
  
  // Check for touch capability
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen width (secondary indicator, only for very small screens)
  const screenWidth = window.innerWidth;
  const isVerySmallScreen = screenWidth <= 480; // Much more restrictive
  
  // Mobile if (mobile user agent AND touch screen) OR very small screen
  return (mobileUserAgent && hasTouchScreen) || isVerySmallScreen;
}

/**
 * Check if device is tablet (larger mobile device)
 * @returns {boolean} True if tablet
 */
export function isTabletDevice() {
  // Check for tablet-specific user agents
  const tabletUserAgent = /iPad|Android.*Tablet|PlayBook|Kindle|Silk/i.test(navigator.userAgent);
  
  // Check for touch capability
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen width for larger touch devices
  const screenWidth = window.innerWidth;
  const isTabletSized = screenWidth > 480 && screenWidth <= 1024;
  
  // Tablet if tablet user agent OR (large touch screen AND not mobile user agent)
  const mobileUserAgent = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return tabletUserAgent || (isTabletSized && hasTouchScreen && !mobileUserAgent);
}

/**
 * Get device type string
 * @returns {'mobile' | 'tablet' | 'desktop'}
 */
export function getDeviceType() {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
}

/**
 * Check if device should use mobile app
 * @returns {boolean} True if should use mobile experience
 */
export function shouldUseMobileApp() {
  return isMobileDevice() || isTabletDevice();
}