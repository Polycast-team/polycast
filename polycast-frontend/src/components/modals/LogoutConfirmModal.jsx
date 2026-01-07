import React from 'react';
import PropTypes from 'prop-types';
import authClient from '../../services/authClient.js';

/**
 * Modal for confirming logout action
 */
function LogoutConfirmModal({ isOpen, onClose, ui, appStrings }) {
  if (!isOpen) return null;

  const handleLogout = () => {
    try {
      authClient.clearToken();
    } catch {}
    window.location.assign('/');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        background: '#23243a',
        borderRadius: 16,
        padding: 28,
        minWidth: 360,
        textAlign: 'center',
        boxShadow: '0 4px 18px 0 rgba(60, 60, 90, 0.2)'
      }}>
        <h2 style={{ color: '#fff', marginBottom: 12 }}>Are you sure you want to log out?</h2>
        <p style={{ color: '#b3b3e7', marginBottom: 20, fontSize: 14 }}>You will be returned to the login screen.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              borderRadius: 6,
              background: '#444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {ui.cancel}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              borderRadius: 6,
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
            title={appStrings.logout}
          >
            {appStrings.logout}
          </button>
        </div>
      </div>
    </div>
  );
}

LogoutConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  ui: PropTypes.shape({
    cancel: PropTypes.string
  }).isRequired,
  appStrings: PropTypes.shape({
    logout: PropTypes.string
  }).isRequired
};

export default LogoutConfirmModal;
