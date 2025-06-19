/**
 * Device Detection Utilities
 * Handles mobile vs desktop detection for routing
 */

/**
 * Check if the current device is mobile based on screen size and user agent
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  // Check screen width first (primary indicator)
  const screenWidth = window.innerWidth;
  const isMobileWidth = screenWidth <= 768;
  
  // Check user agent for mobile devices
  const mobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    navigator.userAgent
  );
  
  // Check for touch capability
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Mobile if narrow screen OR (mobile user agent AND touch screen)
  return isMobileWidth || (mobileUserAgent && hasTouchScreen);
}

/**
 * Check if device is tablet (larger mobile device)
 * @returns {boolean} True if tablet
 */
export function isTabletDevice() {
  const screenWidth = window.innerWidth;
  return screenWidth > 768 && screenWidth <= 1024 && 'ontouchstart' in window;
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