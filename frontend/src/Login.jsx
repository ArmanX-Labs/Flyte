import React, { useState } from 'react';
import { getServerUrl, setServerUrl } from './api';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: phone, 2: code, 3: password
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServer, setCustomServer] = useState(getServerUrl());

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/auth/send_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('flyte_token', data.token);
        localStorage.setItem('mycloud_token', data.token);
        onLoginSuccess();
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/auth/sign_in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      });
      if (!res.ok) throw new Error(await res.text());
      const tokenOrNull = await res.json();
      if (tokenOrNull === null) {
        setStep(3);
      } else {
        localStorage.setItem('flyte_token', tokenOrNull);
        localStorage.setItem('mycloud_token', tokenOrNull);
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/auth/check_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      if (!res.ok) throw new Error(await res.text());
      const token = await res.json();
      localStorage.setItem('flyte_token', token);
      localStorage.setItem('mycloud_token', token);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Flyte Login</h2>
        <p>Connect your Telegram account to sync your files.</p>
        
        {error && <div className="error-msg">{error}</div>}

        {step === 1 && (
          <form onSubmit={handleSendCode}>
            <div className="input-group">
              <label>Phone Number</label>
              <input type="text" placeholder="+1234567890" value={phone} onChange={e => setPhone(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSignIn}>
            <div className="input-group">
              <label>Telegram Code</label>
              <input type="text" placeholder="12345" value={code} onChange={e => setCode(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handlePassword}>
            <div className="input-group">
              <label>2FA Password</label>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Verifying...' : 'Verify Password'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <button 
            type="button" 
            onClick={() => setShowServerConfig(!showServerConfig)} 
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showServerConfig ? 'Hide Server URL' : 'Custom Server URL'}
          </button>
          {showServerConfig && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="https://your-flyte-server.com" 
                value={customServer} 
                onChange={e => setCustomServer(e.target.value)} 
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px' }} 
              />
              <button 
                type="button" 
                onClick={() => { setServerUrl(customServer); setShowServerConfig(false); }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
