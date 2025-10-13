import React from 'react';
import PropTypes from 'prop-types';

/**
 * Fullscreen toggle icon that inherits the current text color.
 */
function FullscreenIcon({ size = 20, strokeWidth = 2.2, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9 3H5a2 2 0 0 0-2 2v4" />
      <path d="M15 3h4a2 2 0 0 1 2 2v4" />
      <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
      <path d="M3 15v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

FullscreenIcon.propTypes = {
  size: PropTypes.number,
  strokeWidth: PropTypes.number,
};

export default FullscreenIcon;
