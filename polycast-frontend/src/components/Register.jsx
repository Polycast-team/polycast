import React, { useMemo, useState } from 'react';
import authClient from '../services/authClient.js';
import { Link, useNavigate } from 'react-router-dom';
import { getRegisterStrings, getErrorStrings, getLanguageOptions } from '../i18n/index.js';
import { findLanguageByCode } from '../i18n/languages.js';
import './auth/AuthLayout.css';

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nativeLanguageCode, setNativeLanguageCode] = useState('en');
  const [targetLanguageCode, setTargetLanguageCode] = useState('es');
  const [proficiencyLevel, setProficiencyLevel] = useState(3);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const registerStrings = useMemo(() => getRegisterStrings(nativeLanguageCode), [nativeLanguageCode]);
  const errorStrings = useMemo(() => getErrorStrings(nativeLanguageCode), [nativeLanguageCode]);
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
        targetLanguage,
        proficiencyLevel
      );
      navigate('/app');
    } catch (e2) {
      setError(e2?.message || errorStrings.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-nav">
        <Link className="auth-brand" to="/">Polycast</Link>
        <Link to="/login">{registerStrings.backToLogin}</Link>
      </div>

      <div className="auth-content">
        <div className="auth-card">
          <h2>{registerStrings.title}</h2>
          <p className="auth-subtitle">Create your profile, choose your languages, and start teaching or learning.</p>
          <form onSubmit={onSubmit} className="auth-form">
            <div className="auth-field">
              <label>{registerStrings.username}</label>
              <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="auth-field">
              <label>Proficiency (1-5)</label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(Number(e.target.value))}
              >
                {[1,2,3,4,5].map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label>{registerStrings.password}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="auth-field">
              <label>{registerStrings.nativeLanguage}</label>
              <select
                value={nativeLanguageCode}
                onChange={(e) => setNativeLanguageCode(e.target.value)}
              >
                {languageOptions.map(({ code, englishName, nativeName }) => (
                  <option key={code} value={code}>
                    {englishName} ({nativeName})
                  </option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label>{registerStrings.targetLanguage}</label>
              <select
                value={targetLanguageCode}
                onChange={(e) => setTargetLanguageCode(e.target.value)}
              >
                {languageOptions.map(({ code, englishName, nativeName }) => (
                  <option key={code} value={code}>
                    {englishName} ({nativeName})
                  </option>
                ))}
              </select>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>{registerStrings.submit}</button>
          </form>
          <div className="auth-switch">
            <Link to="/login">{registerStrings.backToLogin}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
