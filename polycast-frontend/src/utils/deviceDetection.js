/**
 * Device Detection Utilities
 * Handles mobile vs desktop detection for routing
 */

/**
 * Check if the current device is mobile based on user agent and touch capability
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  // Check user agent for mobile devices (primary indicator)
  const mobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    navigator.userAgent
  );
  
  // Check for touch capability
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Mobile only if mobile user agent AND touch screen (no window size dependency)
  return mobileUserAgent && hasTouchScreen;
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
  
  // Tablet only if tablet user agent AND touch screen (no window size dependency)
  return tabletUserAgent && hasTouchScreen;
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
  const mobile = isMobileDevice();
  const tablet = isTabletDevice();
  const shouldUseMobile = mobile || tablet;
  
  console.log('[DEVICE DETECTION]', {
    userAgent: navigator.userAgent,
    isMobile: mobile,
    isTablet: tablet,
    shouldUseMobileApp: shouldUseMobile
  });
  
  return shouldUseMobile;
}