import React from 'react';
import PropTypes from 'prop-types';

/**
 * Solid fullscreen toggle icon that inherits the current text color.
 */
function FullscreenIcon({ size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M4 3a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V5h3a1 1 0 1 0 0-2H4Zm16 0h-4a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1ZM9 19H6v-3a1 1 0 1 0-2 0v4a1 1 0 0 0 1 1h4a1 1 0 0 0 0-2Zm9-3v3h-3a1 1 0 1 0 0 2h4a1 1 0 0 0 1-1v-4a1 1 0 1 0-2 0Z" />
    </svg>
  );
}

FullscreenIcon.propTypes = {
  size: PropTypes.number,
};

export default FullscreenIcon;
