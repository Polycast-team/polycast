import apiService from './apiService.js';
import { registerProfileLanguages } from '../utils/profileLanguageMapping.js';

const TOKEN_KEY = 'pc_jwt';

const AUTH_EVENT = 'pc-auth-changed';

function emitAuthChanged() {
  try {
    const token = getToken();
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { token } }));
  } catch (err) {
    console.warn('[authClient] Failed to emit auth change event', err);
  }
}

function saveToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  emitAuthChanged();
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  emitAuthChanged();
}

async function login(username, password) {
  const url = `${apiService.baseUrl}/api/auth/login`;
  console.log('[authClient] POST', url, { username });
  const res = await apiService.postJson(url, { username, password });
  if (res?.token) saveToken(res.token);
  if (res?.profile) {
    registerProfileLanguages(res.profile.username, {
      nativeLanguage: res.profile.native_language,
      targetLanguage: res.profile.target_language,
    });
  }
  return res;
}

async function register(username, password, nativeLanguage, targetLanguage, proficiencyLevel = 3) {
  const url = `${apiService.baseUrl}/api/auth/register`;
  console.log('[authClient] POST', url, { username, nativeLanguage, targetLanguage, proficiencyLevel });
  const res = await apiService.postJson(url, { username, password, nativeLanguage, targetLanguage, proficiencyLevel });
  if (res?.token) saveToken(res.token);
  if (res?.profile) {
    registerProfileLanguages(res.profile.username, {
      nativeLanguage: res.profile.native_language,
      targetLanguage: res.profile.target_language,
    });
    try {
      window.pc_profileProficiency = window.pc_profileProficiency || {};
      window.pc_profileProficiency[res.profile.username] = res.profile.proficiency_level ?? 3;
    } catch(_) {}
  }
  return res;
}

async function me() {
  const url = `${apiService.baseUrl}/api/auth/me`;
  const token = getToken();
  const profile = await apiService.fetchJson(url, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });
  if (profile?.username) {
    registerProfileLanguages(profile.username, {
      nativeLanguage: profile.native_language,
      targetLanguage: profile.target_language,
    });
    try {
      window.pc_profileProficiency = window.pc_profileProficiency || {};
      window.pc_profileProficiency[profile.username] = profile.proficiency_level ?? 3;
    } catch(_) {}
  }
  return profile;
}

export default {
  login,
  register,
  me,
  getToken,
  saveToken,
  clearToken,
  AUTH_EVENT,
};
