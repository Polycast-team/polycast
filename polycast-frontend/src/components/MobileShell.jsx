import React from 'react';
import PropTypes from 'prop-types';
import '../mobile.css';

function MobileShell({ children }) {
  // Scope all mobile overrides under this wrapper class
  return (
    <div className="pc-mobile" style={{
      minHeight: '100vh',
      width: '100vw',
      overflowX: 'hidden',
      WebkitTapHighlightColor: 'transparent'
    }}>
      {children}
    </div>
  );
}

MobileShell.propTypes = {
  children: PropTypes.node
};

export default MobileShell;


