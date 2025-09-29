import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import apiService from '../services/apiService';
import authClient from '../services/authClient';
import { getSRSSettings, saveSRSSettings } from '../utils/srsSettings';

const popoverContainerStyle = {
  position: 'fixed',
  top: 20,
  left: 20,
  zIndex: 1100,
};

const buttonStyle = {
  background: 'rgba(35, 35, 58, 0.9)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  width: 44,
  height: 44,
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
};

const panelStyle = {
  marginTop: 8,
  width: 300,
  background: '#111827',
  color: '#e5e7eb',
  borderRadius: 10,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  border: '1px solid #1f2937',
  padding: 16,
};

const rowStyle = { marginBottom: 14 };
const labelStyle = { display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13 };
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #374151',
  background: '#0b1220',
  color: '#e5e7eb',
  fontSize: 14,
};
const helperStyle = { fontSize: 12, color: '#94a3b8', marginTop: 6 };

const dangerButtonStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #7f1d1d',
  background: '#991b1b',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer'
};

const actionRowStyle = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 };
const secondaryButtonStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #374151', background: '#0b1220', color: '#e5e7eb', cursor: 'pointer' };
const primaryButtonStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #2563eb', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' };

export default function SettingsButton({ onSrsChange }) {
  const [open, setOpen] = useState(false);
  const [newCardsPerDay, setNewCardsPerDay] = useState(getSRSSettings().newCardsPerDay || 5);
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    // Keep in sync if settings change elsewhere
    setNewCardsPerDay(getSRSSettings().newCardsPerDay || 5);
  }, []);

  const handleSave = () => {
    const current = getSRSSettings();
    const next = { ...current, newCardsPerDay: Math.max(0, Math.min(50, Number(newCardsPerDay) || 0)) };
    const ok = saveSRSSettings(next);
    if (ok && typeof onSrsChange === 'function') onSrsChange(next);
    setOpen(false);
  };

  const handleDeleteAccount = async () => {
    try {
      const confirmed = window.confirm('Delete your account and all saved words? This cannot be undone.');
      if (!confirmed) return;
      const url = `${apiService.baseUrl}/api/auth/account`;
      await apiService.fetchJson(url, { method: 'DELETE' });
      try { authClient.clearToken(); } catch {}
      window.location.assign('/');
    } catch (e) {
      alert(e?.message || 'Failed to delete account');
    }
  };

  return (
    <div style={popoverContainerStyle}>
      <button
        aria-label="Open Settings"
        title="Settings"
        onClick={() => setOpen(v => !v)}
        style={buttonStyle}
      >
        ⚙️
      </button>

      {open && (
        <div ref={panelRef} style={panelStyle}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Settings</div>

          <div style={rowStyle}>
            <label style={labelStyle}>New Cards Per Day</label>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={newCardsPerDay}
              onChange={(e) => setNewCardsPerDay(e.target.value)}
              style={inputStyle}
            />
            <div style={helperStyle}>Maximum new cards per day (0-50)</div>
          </div>

          <div style={actionRowStyle}>
            <button onClick={() => setOpen(false)} style={secondaryButtonStyle}>Cancel</button>
            <button onClick={handleSave} style={primaryButtonStyle}>Save</button>
          </div>

          <div style={{ height: 1, background: '#1f2937', margin: '14px 0' }} />

          <div style={{ marginTop: 8 }}>
            <button onClick={handleDeleteAccount} style={dangerButtonStyle}>Delete Account</button>
          </div>
        </div>
      )}
    </div>
  );
}

SettingsButton.propTypes = {
  onSrsChange: PropTypes.func,
};


