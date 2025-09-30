import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import apiService from '../services/apiService';
import authClient from '../services/authClient';
import { getSRSSettings, saveSRSSettings } from '../utils/srsSettings';
import { 
  BUILT_IN_PALETTES,
  applyPaletteToDocument,
  getSavedPaletteName,
  getSavedCustomOverrides,
  savePaletteSelection,
  resolvePalette
} from '../theme/palettes';

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
  background: 'var(--pc-surface)',
  color: 'var(--pc-text)',
  borderRadius: 10,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 16,
};

const rowStyle = { marginBottom: 14 };
const labelStyle = { display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13 };
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #374151',
  background: 'var(--pc-bg)',
  color: 'var(--pc-text)',
  fontSize: 14,
};
const helperStyle = { fontSize: 12, color: 'var(--pc-text-muted)', marginTop: 6 };

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
const secondaryButtonStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #374151', background: 'var(--pc-bg)', color: 'var(--pc-text)', cursor: 'pointer' };
const primaryButtonStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--pc-accent)', background: 'var(--pc-accent)', color: '#111', fontWeight: 700, cursor: 'pointer' };

export default function SettingsButton({ onSrsChange }) {
  const [open, setOpen] = useState(false);
  const [newCardsPerDay, setNewCardsPerDay] = useState(getSRSSettings().newCardsPerDay || 5);
  const panelRef = useRef(null);
  const [paletteName, setPaletteName] = useState(getSavedPaletteName() || 'Breakfast tea');
  const [overrides, setOverrides] = useState(() => {
    const o = getSavedCustomOverrides();
    return { accent: o.accent || '', surface2: o.surface2 || '', surface: o.surface || '', bg: o.bg || '' };
  });

  const effectivePalette = resolvePalette(paletteName, overrides);

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
    // Save theme selection
    savePaletteSelection(paletteName, {
      accent: overrides.accent || undefined,
      surface2: overrides.surface2 || undefined,
      surface: overrides.surface || undefined,
      bg: overrides.bg || undefined,
    });
    setOpen(false);
  };

  const applyLive = (name, o) => {
    try { applyPaletteToDocument(name, o); } catch {}
  };

  const handlePaletteChange = (e) => {
    const name = e.target.value;
    setPaletteName(name);
    applyLive(name, overrides);
  };

  const setOverride = (key, value) => {
    const next = { ...overrides, [key]: value };
    setOverrides(next);
    applyLive(paletteName, next);
  };

  const handleResetOverrides = () => {
    const empty = { accent: '', surface2: '', surface: '', bg: '' };
    setOverrides(empty);
    applyLive(paletteName, empty);
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
            <label style={labelStyle}>Color Palette</label>
            <select
              value={paletteName}
              onChange={handlePaletteChange}
              style={{ ...inputStyle, width: '100%', height: 36 }}
            >
              {Object.keys(BUILT_IN_PALETTES).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div style={helperStyle}>Choose a preset palette to apply to the UI.</div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Background</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={effectivePalette.bg} onChange={(e)=> setOverride('bg', e.target.value)} style={{ width: 44, height: 36, padding: 0, border: 'none', background: 'transparent' }} />
              <input type="text" value={effectivePalette.bg} onChange={(e)=> setOverride('bg', e.target.value)} style={{ ...inputStyle }} />
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Surface</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={effectivePalette.surface} onChange={(e)=> setOverride('surface', e.target.value)} style={{ width: 44, height: 36, padding: 0, border: 'none', background: 'transparent' }} />
              <input type="text" value={effectivePalette.surface} onChange={(e)=> setOverride('surface', e.target.value)} style={{ ...inputStyle }} />
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Surface 2</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={effectivePalette.surface2} onChange={(e)=> setOverride('surface2', e.target.value)} style={{ width: 44, height: 36, padding: 0, border: 'none', background: 'transparent' }} />
              <input type="text" value={effectivePalette.surface2} onChange={(e)=> setOverride('surface2', e.target.value)} style={{ ...inputStyle }} />
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Accent</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={effectivePalette.accent} onChange={(e)=> setOverride('accent', e.target.value)} style={{ width: 44, height: 36, padding: 0, border: 'none', background: 'transparent' }} />
              <input type="text" value={effectivePalette.accent} onChange={(e)=> setOverride('accent', e.target.value)} style={{ ...inputStyle }} />
            </div>
            <div style={helperStyle}>Pick any hex to customize the preset.</div>
          </div>

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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 10 }}>
            <button onClick={handleResetOverrides} style={secondaryButtonStyle}>Reset Colors</button>
            <div style={actionRowStyle}>
            <button onClick={() => setOpen(false)} style={secondaryButtonStyle}>Cancel</button>
            <button onClick={handleSave} style={primaryButtonStyle}>Save</button>
            </div>
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


