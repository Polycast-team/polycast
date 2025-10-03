// Centralized UI color palettes and theme application helpers
// Four-color palettes map to semantic tokens used across the app.

export const BUILT_IN_PALETTES = {
  'Breakfast tea': {
    accent: '#FFD3AC',
    surface2: '#CCBEB1',
    surface: '#664C36',
    bg: '#331C08',
  },
  'Retro calm': {
    accent: '#81D8D0',
    surface2: '#D99E82',
    surface: '#D7D982',
    bg: '#AE82D9',
  },
  'Under the moonlight': {
    accent: '#CCCCFF',
    surface2: '#A3A3CC',
    surface: '#5C5C99',
    bg: '#292966',
  },
  'Quite clear': {
    accent: '#CBCBCB',
    surface2: '#F2F2F2',
    surface: '#174D38',
    bg: '#4D1717',
  },
};

const STORAGE_KEY = 'pc_theme_palette_v1';

export function getSavedPaletteName() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.name || null;
  } catch {
    return null;
  }
}

export function getSavedCustomOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data?.overrides || {};
  } catch {
    return {};
  }
}

export function savePaletteSelection(name, overrides = {}) {
  try {
    const payload = { name, overrides };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function chooseTextOn(bgHex) {
  // YIQ contrast for legibility
  try {
    const hex = bgHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#111827' : '#f7f7fa';
  } catch {
    return '#f7f7fa';
  }
}

export function resolvePalette(name, overrides = {}) {
  const base = BUILT_IN_PALETTES[name] || Object.values(BUILT_IN_PALETTES)[0];
  return {
    accent: overrides.accent || base.accent,
    surface2: overrides.surface2 || base.surface2,
    surface: overrides.surface || base.surface,
    bg: overrides.bg || base.bg,
  };
}

export function applyPaletteToDocument(paletteName, overrides = {}) {
  const palette = resolvePalette(paletteName, overrides);
  const root = document.documentElement;
  // Core tokens consumed by CSS
  root.style.setProperty('--pc-bg', palette.bg);
  root.style.setProperty('--pc-surface', palette.surface);
  root.style.setProperty('--pc-surface-2', palette.surface2);
  root.style.setProperty('--pc-accent', palette.accent);
  const textColor = chooseTextOn(palette.bg);
  const mutedText = chooseTextOn(palette.surface);
  root.style.setProperty('--pc-text', textColor);
  root.style.setProperty('--pc-text-muted', mutedText);
}

export function initThemeFromStorage() {
  const name = getSavedPaletteName() || 'Breakfast tea';
  const overrides = getSavedCustomOverrides();
  applyPaletteToDocument(name, overrides);
  return { name, overrides };
}


