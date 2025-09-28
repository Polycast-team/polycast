import React, { useMemo, useState } from 'react';
import authClient from '../services/authClient.js';
import { Link, useNavigate } from 'react-router-dom';
import { getLoginStrings, getErrorStrings, getLanguageOptions } from '../i18n/index.js';
import './auth/AuthLayout.css';

function determineInterfaceLanguage() {
  const options = getLanguageOptions();
  if (typeof navigator === 'undefined') return 'en';
  const raw = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (!raw) return 'en';

  const candidates = [raw];
  const segment = raw.split('-')[0];
  if (segment && segment !== raw) candidates.push(segment);

  for (const candidate of candidates) {
    const byCode = options.find(({ code }) => code === candidate);
    if (byCode) return byCode.code;
  }

  for (const candidate of candidates) {
    const byName = options.find(({ englishName, nativeName }) =>
      englishName.toLowerCase() === candidate || nativeName.toLowerCase() === candidate
    );
    if (byName) return byName.code;
  }

  return 'en';
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const interfaceLanguage = useMemo(determineInterfaceLanguage, []);
  const loginStrings = useMemo(() => getLoginStrings(interfaceLanguage), [interfaceLanguage]);
  const errorStrings = useMemo(() => getErrorStrings(interfaceLanguage), [interfaceLanguage]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authClient.login(username.trim(), password);
      navigate('/app');
    } catch (e2) {
      setError(e2?.message || errorStrings.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-nav">
        <Link className="auth-brand" to="/">Polycast</Link>
        <Link to="/register">{loginStrings.createAccountLink}</Link>
      </div>

      <div className="auth-content">
        <div className="auth-card">
          <h2>{loginStrings.title}</h2>
          <p className="auth-subtitle">Sign in to continue your lessons and live sessions.</p>
          <form onSubmit={onSubmit} className="auth-form">
            <div className="auth-field">
              <label>{loginStrings.username}</label>
              <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="auth-field">
              <label>{loginStrings.password}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>{loginStrings.submit}</button>
          </form>
          <div className="auth-switch">
            <Link to="/register">{loginStrings.createAccountLink}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
