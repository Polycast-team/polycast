import React from 'react';
import PropTypes from 'prop-types';

/**
 * Solid gear icon that inherits the current text color.
 */
function SettingsIcon({ size = 20, ...props }) {
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
      <path
        fillRule="evenodd"
        d="M11.983 1a1.5 1.5 0 0 1 1.5 1.5v.764a7.09 7.09 0 0 1 1.829.76l.536-.536a1.5 1.5 0 1 1 2.122 2.121l-.536.536c.322.582.567 1.214.726 1.878h.758a1.5 1.5 0 1 1 0 3h-.758a7.09 7.09 0 0 1-.726 1.878l.536.536a1.5 1.5 0 0 1-2.122 2.121l-.536-.536a7.09 7.09 0 0 1-1.829.76v.764a1.5 1.5 0 1 1-3 0v-.764a7.09 7.09 0 0 1-1.829-.76l-.536.536a1.5 1.5 0 1 1-2.122-2.121l.536-.536a7.09 7.09 0 0 1-.726-1.878H4.5a1.5 1.5 0 0 1 0-3h.758c.159-.664.404-1.296.726-1.878l-.536-.536a1.5 1.5 0 1 1 2.122-2.121l.536.536a7.09 7.09 0 0 1 1.829-.76V2.5A1.5 1.5 0 0 1 11.983 1Zm0 8.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

SettingsIcon.propTypes = {
  size: PropTypes.number,
};

export default SettingsIcon;
