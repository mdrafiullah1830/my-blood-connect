import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, LogIn, KeyRound, ShieldCheck, RefreshCw } from 'lucide-react';
import api, { saveSession } from '../lib/api';
import { getAccuratePosition } from '../lib/geolocation';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

// ei page e user login kora hoy, ar login success hole token ar user data session e save kora hoy.
// 2FA challenge, forgot-password ar social (Google/GitHub) login e ekhanei handle hoy.
export default function Login(){
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState('password'); // password | otp
  const [challenge, setChallenge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // GitHub OAuth redirect theke ?code= pele backend e exchange kore login.
  useEffect(() => {
    const githubCode = searchParams.get('code');
    if (!githubCode) return;
    setLoading(true);
    api.post('/api/auth/social', { provider: 'github', code: githubCode, redirectUri: `${window.location.origin}/login` })
      .then(({ data }) => { saveSession(data.token, data.user); navigate('/dashboard'); })
      .catch((err) => setError(err.response?.data?.message || 'GitHub login failed'))
      .finally(() => setLoading(false));
  }, [searchParams, navigate]);

  const finishLogin = (data) => { saveSession(data.token, data.user); window.location.assign('/dashboard'); };

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('');
    try {
      let coords = {};
      try { coords = await getAccuratePosition(); } catch { /* Login continues without refreshing GPS when permission/location is unavailable. */ }
      if (forgotMode) {
        const { data } = await api.post('/api/auth/forgot-password', { email });
        setMessage(data.message + (data.devLink ? ` — dev link: ${data.devLink}` : ''));
      } else if (stage === 'password') {
        const { data } = await api.post('/api/auth/login', { email, password, ...coords });
        if (data.requires2FA) { setChallenge(data.challenge); setStage('otp'); setMessage(data.message || 'Two-factor code sent to your email'); }
        else finishLogin(data);
      } else {
        const { data } = await api.post('/api/auth/login/2fa', { challenge, code });
        finishLogin(data);
      }
    } catch (err) { setError(err.response?.data?.message || err.message || 'Login failed.'); }
    finally { setLoading(false); }
  };

  const googleLogin = () => {
    if (!googleClientId) return setError('Google login is not configured (set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID on backend).');
    if (!window.google?.accounts?.id) return setError('Google login library not loaded yet. Try again in a moment.');
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          setLoading(true);
          const { data } = await api.post('/api/auth/social', { provider: 'google', idToken: response.credential });
          finishLogin(data);
        } catch (err) { setError(err.response?.data?.message || 'Google login failed'); }
        finally { setLoading(false); }
      }
    });
    window.google.accounts.id.prompt();
  };

  const githubLogin = () => {
    if (!githubClientId) return setError('GitHub login is not configured (set VITE_GITHUB_CLIENT_ID and GITHUB_CLIENT_ID/SECRET on backend).');
    const redirectUri = `${window.location.origin}/login`;
    window.location = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email`;
  };

  // GIS script ekbar load — config thaklei.
  useEffect(() => {
    if (!googleClientId || document.querySelector('script[data-gis]')) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gis = '1';
    document.head.appendChild(script);
  }, []);

  return <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center"><div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-3xl p-8">
    <h1 className="text-4xl font-black text-red-500 text-center">{forgotMode ? 'Reset Password' : stage === 'otp' ? 'Two-Factor Check' : 'Welcome Back'}</h1>
    <p className="text-slate-400 text-center mt-2 mb-8">{forgotMode ? 'We will email you a secure reset link' : stage === 'otp' ? 'Enter the 6-digit code sent to your email' : 'Login to manage your Blood Connect account'}</p>
    {error&&<div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
    {message&&<div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{message}</div>}
    <form onSubmit={submit} autoComplete="on" className="space-y-5">
      {stage === 'otp' ? (
        <div><label className="text-xs uppercase text-slate-400">Verification code</label><div className="relative mt-2"><KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-slate-500"/><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 tracking-[0.4em]"/></div></div>
      ) : (<>
        <div><label className="text-xs uppercase text-slate-400">Email</label><div className="relative mt-2"><Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500"/><input type="email" name="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3"/></div></div>
        {!forgotMode && <div><label className="text-xs uppercase text-slate-400">Password</label><div className="relative mt-2"><Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500"/><input type="password" name="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3"/></div></div>}
      </>)}
      <button disabled={loading} className="w-full bg-red-600 rounded-xl py-3.5 font-black disabled:opacity-50">
        {loading ? 'Working...' : forgotMode ? <><Mail className="inline w-4 h-4 mr-2"/>Send reset link</> : stage === 'otp' ? <><ShieldCheck className="inline w-4 h-4 mr-2"/>Verify code</> : <><LogIn className="inline w-4 h-4 mr-2"/>Sign In</>}
      </button>
    </form>

    {!forgotMode && stage === 'password' && <>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-slate-800"/>OR CONTINUE WITH<span className="h-px flex-1 bg-slate-800"/></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={googleLogin} className="rounded-xl border border-slate-700 bg-slate-950 py-3 font-bold text-sm hover:border-slate-500">Google</button>
        <button onClick={githubLogin} className="rounded-xl border border-slate-700 bg-slate-950 py-3 font-bold text-sm hover:border-slate-500">GitHub</button>
      </div>
    </>}

    <div className="mt-6 flex flex-col gap-2 text-center text-sm">
      {stage === 'otp' && <button onClick={() => { setStage('password'); setCode(''); setError(''); }} className="text-slate-400 hover:text-white"><RefreshCw className="mr-1 inline h-4 w-4"/>Back to password</button>}
      <button onClick={() => { setForgotMode((v) => !v); setError(''); setMessage(''); }} className="text-slate-400 hover:text-white">{forgotMode ? 'Back to login' : 'Forgot password?'}</button>
      <p className="text-slate-500">No account? <Link to="/register" className="text-red-400">Create one</Link></p>
    </div>
  </div></div>;
}
