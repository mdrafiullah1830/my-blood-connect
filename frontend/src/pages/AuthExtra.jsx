import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, KeyRound } from 'lucide-react';
import api from '../lib/api';

// token-based pages — email verify + password reset (link theke ashe ?token=...).
export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');

  const token = new URLSearchParams(location.search).get('token') || '';

  const verify = async () => {
    setState('loading');
    try {
      const { data } = await api.post('/api/auth/verify-email', { token });
      setState('done');
      setMessage(data.message || 'Email verified successfully');
      setTimeout(() => navigate('/settings'), 2000);
    } catch (err) {
      setState('error');
      setMessage(err.response?.data?.message || 'Verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-md pt-20 text-center">
        <MailCheck className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h1 className="text-3xl font-black">Verify your email</h1>
        <p className="mt-2 text-slate-400">Confirm your email address to secure your account.</p>
        {!token ? (
          <p className="mt-6 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-300">No verification token found. Request a new link from Settings.</p>
        ) : (
          <button onClick={verify} disabled={state === 'loading'} className="mt-6 w-full rounded-xl bg-red-600 py-3 font-black disabled:opacity-60">
            {state === 'loading' ? 'Verifying...' : 'Verify my email'}
          </button>
        )}
        {message && <p className={`mt-4 text-sm ${state === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>}
        <Link to="/settings" className="mt-6 inline-block text-sm text-slate-500 underline">Back to settings</Link>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/api/auth/reset-password', { token, password });
      setMessage(data.message || 'Password updated — you can log in now');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) { setError(err.response?.data?.message || 'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-md pt-20">
        <KeyRound className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h1 className="text-center text-3xl font-black">Set a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-red-500" />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-red-500" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-red-600 py-3 font-black disabled:opacity-60">{loading ? 'Updating...' : 'Update password'}</button>
        </form>
        {!token && <p className="mt-4 text-center text-xs text-amber-400">Missing reset token — request a new link from Login page.</p>}
      </div>
    </div>
  );
}
