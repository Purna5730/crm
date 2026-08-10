import React, { useState } from 'react';
import api from '../api';

interface Props { onLogin: (token: string, user: any) => void; }

const ROLES = [
  { value: 'admin',     label: 'Admin',     icon: '🛡️', desc: 'Full system access' },
  { value: 'sales',     label: 'Sales',     icon: '💼', desc: 'Manage customers & leads' },
  { value: 'warehouse', label: 'Warehouse', icon: '🏭', desc: 'Inventory & stock' },
  { value: 'accounts',  label: 'Accounts',  icon: '💰', desc: 'Finance & billing' },
];

type Page = 'login' | 'signup';
type Step = 'role' | 'credentials';

const Login: React.FC<Props> = ({ onLogin }) => {
  const [page, setPage] = useState<Page>('login');

  // shared
  const [selectedRole, setSelectedRole] = useState('');
  const [step, setStep] = useState<Step>('role');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // login
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // signup
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [success, setSuccess] = useState('');

  const reset = () => {
    setSelectedRole(''); setStep('role'); setError(''); setSuccess('');
    setLoginForm({ email: '', password: '' });
    setSignupForm({ name: '', email: '', password: '', confirm: '' });
  };

  const switchPage = (p: Page) => { reset(); setPage(p); };

  const handleRoleSelect = (role: string) => { setSelectedRole(role); setStep('credentials'); setError(''); };
  const handleBack = () => { setStep('role'); setSelectedRole(''); setError(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { ...loginForm, role: selectedRole });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(token, user);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (signupForm.password !== signupForm.confirm) { setError('Passwords do not match'); return; }
    if (signupForm.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: signupForm.name, email: signupForm.email,
        password: signupForm.password, role: selectedRole,
      });
      setSuccess(`Account created! You can now sign in as ${selectedRole}.`);
      setTimeout(() => switchPage('login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const activeRole = ROLES.find(r => r.value === selectedRole);

  return (
    <div className="auth-bg">
      <div className="auth-card">

        {/* ── HEADER ── */}
        <div className="auth-header">
          <div className="auth-logo">CRM</div>
          <h1>{page === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
          <p>{page === 'login' ? 'Sign in to your account' : 'Register to get started'}</p>
        </div>

        {/* ── TAB SWITCHER ── */}
        <div className="auth-tabs">
          <button className={page === 'login' ? 'tab-active' : ''} onClick={() => switchPage('login')}>Sign In</button>
          <button className={page === 'signup' ? 'tab-active' : ''} onClick={() => switchPage('signup')}>Sign Up</button>
        </div>

        {/* ── ROLE STEP (shared) ── */}
        {step === 'role' && (
          <div className="role-section">
            <p className="role-label">Select your role to continue</p>
            <div className="role-scroll-container">
              {ROLES.map(role => (
                <div key={role.value} className="role-card" onClick={() => handleRoleSelect(role.value)}>
                  <span className="role-icon">{role.icon}</span>
                  <div className="role-info">
                    <span className="role-name">{role.label}</span>
                    <span className="role-desc">{role.desc}</span>
                  </div>
                  <span className="role-arrow">›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGIN CREDENTIALS ── */}
        {step === 'credentials' && page === 'login' && (
          <div className="credentials-section">
            <div className="selected-role-badge" onClick={handleBack}>
              <span>{activeRole?.icon}</span>
              <span>{activeRole?.label}</span>
              <span className="change-role">Change ✕</span>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your email"
                  value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" placeholder="Enter your password"
                  value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <p className="toggle-link" onClick={() => switchPage('signup')}>
              Don't have an account? <strong>Sign Up</strong>
            </p>
          </div>
        )}

        {/* ── SIGNUP CREDENTIALS ── */}
        {step === 'credentials' && page === 'signup' && (
          <div className="credentials-section">
            <div className="selected-role-badge" onClick={handleBack}>
              <span>{activeRole?.icon}</span>
              <span>{activeRole?.label}</span>
              <span className="change-role">Change ✕</span>
            </div>
            {error && <div className="error-msg">{error}</div>}
            {success && <div className="success-msg">✅ {success}</div>}
            <form onSubmit={handleSignup}>
              <div className="input-group">
                <label>Full Name</label>
                <input placeholder="Enter your full name"
                  value={signupForm.name} onChange={e => setSignupForm({ ...signupForm, name: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your email"
                  value={signupForm.email} onChange={e => setSignupForm({ ...signupForm, email: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" placeholder="Min 6 characters"
                  value={signupForm.password} onChange={e => setSignupForm({ ...signupForm, password: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Confirm Password</label>
                <input type="password" placeholder="Re-enter your password"
                  value={signupForm.confirm} onChange={e => setSignupForm({ ...signupForm, confirm: e.target.value })} required />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            <p className="toggle-link" onClick={() => switchPage('login')}>
              Already have an account? <strong>Sign In</strong>
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;
