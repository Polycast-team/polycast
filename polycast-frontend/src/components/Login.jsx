import React, { useMemo, useState } from 'react';
import authClient from '../services/authClient.js';
import { Link, useNavigate } from 'react-router-dom';
import { getLoginStrings, getErrorStrings, getLanguageOptions } from '../i18n/index.js';

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [interfaceLanguage, setInterfaceLanguage] = useState('en');
  const loginStrings = useMemo(() => getLoginStrings(interfaceLanguage), [interfaceLanguage]);
  const errorStrings = useMemo(() => getErrorStrings(interfaceLanguage), [interfaceLanguage]);
  const languageOptions = useMemo(() => getLanguageOptions(), []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authClient.login(username.trim(), password);
      navigate('/');
    } catch (e2) {
      setError(e2?.message || errorStrings.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>{loginStrings.title}</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>{loginStrings.languageLabel}</label>
          <select
            value={interfaceLanguage}
            onChange={(e) => setInterfaceLanguage(e.target.value)}
            style={{ width: '100%' }}
          >
            {languageOptions.map(({ code, englishName, nativeName }) => (
              <option key={code} value={code}>
                {englishName} ({nativeName})
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{loginStrings.username}</label>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{loginStrings.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
        </div>
        {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={loading}>{loginStrings.submit}</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <Link to="/register">{loginStrings.createAccountLink}</Link>
      </div>
    </div>
  );
}

export default Login;
