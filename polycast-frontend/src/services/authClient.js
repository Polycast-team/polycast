import apiService from './apiService.js';

const TOKEN_KEY = 'pc_jwt';

function saveToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function login(username, password) {
  const url = `${apiService.baseUrl}/api/auth/login`;
  console.log('[authClient] POST', url, { username });
  const res = await apiService.postJson(url, { username, password });
  if (res?.token) saveToken(res.token);
  return res;
}

async function register(username, password, nativeLanguage, targetLanguage) {
  const url = `${apiService.baseUrl}/api/auth/register`;
  console.log('[authClient] POST', url, { username, nativeLanguage, targetLanguage });
  const res = await apiService.postJson(url, { username, password, nativeLanguage, targetLanguage });
  if (res?.token) saveToken(res.token);
  return res;
}

async function me() {
  const url = `${apiService.baseUrl}/api/auth/me`;
  const token = getToken();
  return apiService.fetchJson(url, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });
}

export default {
  login,
  register,
  me,
  getToken,
  saveToken,
  clearToken,
};


