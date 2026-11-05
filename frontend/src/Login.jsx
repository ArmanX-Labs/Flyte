import React, { useState } from 'react';
import { 
  getServerUrl, 
  setServerUrl, 
  sendAuthCode, 
  signIn, 
  checkPassword, 
  isCapacitor, 
  isTauri 
} from './api';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: phone, 2: code, 3: password
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isMobile = isCapacitor();
  const currentServer = getServerUrl();
  const [showServerConfig, setShowServerConfig] = useState(isMobile && !currentServer);
  const [customServer, setCustomServer] = useState(currentServer || '');
  const [serverSavedMsg, setServerSavedMsg] = useState('');

  const handleSaveServer = () => {
    if (!customServer.trim()) {
      setServerUrl('');
      setServerSavedMsg('Reset to default');
    } else {
      setServerUrl(customServer);
      setServerSavedMsg('Server URL saved!');
    }
    setTimeout(() => setServerSavedMsg(''), 2500);
  };

  const validateServer = () => {
    if (isMobile && !getServerUrl()) {
      setError('Please configure and save your Flyte Server URL below before signing in.');
      setShowServerConfig(true);
      return false;
    }
    return true;
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateServer()) return;

    setLoading(true);
    try {
      const data = await sendAuthCode(phone);
      if (data && data.token) {
        localStorage.setItem('flyte_token', data.token);
        localStorage.setItem('mycloud_token', data.token);
        onLoginSuccess();
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err.message || String(err));
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokenOrNull = await signIn(phone, code);
      if (tokenOrNull === null) {
        setStep(3);
      } else {
        localStorage.setItem('flyte_token', tokenOrNull);
        localStorage.setItem('mycloud_token', tokenOrNull);
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || String(err));
    }
    setLoading(false);
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await checkPassword(phone, password);
      localStorage.setItem('flyte_token', token);
      localStorage.setItem('mycloud_token', token);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || String(err));
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
              <input 
                type="text" 
                placeholder="+1234567890" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                required 
              />
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
              <input 
                type="text" 
                placeholder="12345" 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                required 
              />
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
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Verifying...' : 'Verify Password'}
            </button>
          </form>
        )}

        {/* Server URL Settings */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <button 
            type="button" 
            onClick={() => setShowServerConfig(!showServerConfig)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#888', 
              cursor: 'pointer', 
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {showServerConfig ? 'Hide Server Configuration' : 'Server Configuration'}
            {getServerUrl() && <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>●</span>}
          </button>
          
          {showServerConfig && (
            <div style={{ 
              marginTop: '0.75rem', 
              padding: '0.75rem', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '6px', 
              border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>
                {isMobile 
                  ? 'Mobile App: Enter your Flyte server URL (e.g. http://192.168.1.50:3000 or your public URL):' 
                  : isTauri() 
                    ? 'Desktop App: Connected to local server (http://127.0.0.1:3000) by default.' 
                    : 'Server URL (defaults to current host):'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder={isTauri() ? "http://127.0.0.1:3000" : "http://192.168.1.50:3000"} 
                  value={customServer} 
                  onChange={e => setCustomServer(e.target.value)} 
                  style={{ 
                    flex: 1, 
                    padding: '0.4rem 0.6rem', 
                    fontSize: '0.85rem', 
                    background: '#111', 
                    color: '#fff', 
                    border: '1px solid #333', 
                    borderRadius: '4px' 
                  }} 
                />
                <button 
                  type="button" 
                  onClick={handleSaveServer}
                  style={{ 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.85rem', 
                    background: 'var(--accent, #3b82f6)', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  Save
                </button>
              </div>
              {serverSavedMsg && (
                <div style={{ color: '#4ade80', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                  {serverSavedMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
