import React, { useState } from 'react';
import authClient from '../services/authClient.js';
import { Link, useNavigate } from 'react-router-dom';

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authClient.register(
        username.trim(),
        password,
        nativeLanguage.trim(),
        targetLanguage.trim()
      );
      navigate('/');
    } catch (e2) {
      setError(e2?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>Create an account</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Native language</label>
          <input value={nativeLanguage} onChange={e => setNativeLanguage(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Target language</label>
          <input value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} style={{ width: '100%' }} />
        </div>
        {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={loading}>Create account</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}

export default Register;


