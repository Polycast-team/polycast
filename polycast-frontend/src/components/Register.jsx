import React, { useMemo, useState } from 'react';
import authClient from '../services/authClient.js';
import { Link, useNavigate } from 'react-router-dom';
import { getRegisterStrings, getErrorStrings, getLanguageOptions } from '../i18n/index.js';
import { findLanguageByCode } from '../i18n/languages.js';

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [interfaceLanguage, setInterfaceLanguage] = useState('en');
  const [nativeLanguageCode, setNativeLanguageCode] = useState('en');
  const [targetLanguageCode, setTargetLanguageCode] = useState('es');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const registerStrings = useMemo(() => getRegisterStrings(interfaceLanguage), [interfaceLanguage]);
  const errorStrings = useMemo(() => getErrorStrings(interfaceLanguage), [interfaceLanguage]);
  const languageOptions = useMemo(() => getLanguageOptions(), []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const nativeLanguage = findLanguageByCode(nativeLanguageCode)?.englishName;
      const targetLanguage = findLanguageByCode(targetLanguageCode)?.englishName;
      if (!nativeLanguage || !targetLanguage) {
        throw new Error('Unsupported language selection.');
      }
      const res = await authClient.register(
        username.trim(),
        password,
        nativeLanguage,
        targetLanguage
      );
      navigate('/');
    } catch (e2) {
      setError(e2?.message || errorStrings.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>{registerStrings.title}</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>{registerStrings.languageLabel}</label>
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
          <label>{registerStrings.username}</label>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%' }} autoComplete="username" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{registerStrings.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} autoComplete="new-password" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{registerStrings.nativeLanguage}</label>
          <select
            value={nativeLanguageCode}
            onChange={(e) => setNativeLanguageCode(e.target.value)}
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
          <label>{registerStrings.targetLanguage}</label>
          <select
            value={targetLanguageCode}
            onChange={(e) => setTargetLanguageCode(e.target.value)}
            style={{ width: '100%' }}
          >
            {languageOptions.map(({ code, englishName, nativeName }) => (
              <option key={code} value={code}>
                {englishName} ({nativeName})
              </option>
            ))}
          </select>
        </div>
        {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={loading}>{registerStrings.submit}</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <Link to="/login">{registerStrings.backToLogin}</Link>
      </div>
    </div>
  );
}

export default Register;

