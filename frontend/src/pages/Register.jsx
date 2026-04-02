import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';

export default function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, true); // true = register mode
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Pay<span>Flux</span></div>
        <h1 className="auth-heading">Create your account</h1>
        <p className="auth-subtext">Start managing your invoices in seconds</p>

        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Email address
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button id="register-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
