import { useEffect, useState } from 'react';
import { ShieldCheck, Volume2, Globe, BellRing, MapPin, LogOut, KeyRound, Languages, MonitorSmartphone } from 'lucide-react';
import api, { saveSession, getStoredUser } from '../lib/api';
import { getLang, setLang, t, useLangTick } from '../lib/i18n';
import { soundEnabled, setSoundEnabled } from '../lib/sound';
import { enablePushNotifications, disablePushNotifications } from '../lib/push';

// settings hub — 2FA, language, sound, push, live location, sessions, password reset.
export default function Settings() {
  useLangTick();
  const [user, setUser] = useState(getStoredUser());
  const [lang, setLangState] = useState(getLang());
  const [sound, setSoundState] = useState(soundEnabled());
  const [pushOn, setPushOn] = useState(Notification?.permission === 'granted');
  const [twoFA, setTwoFA] = useState(user?.twoFactorEnabled || false);
  const [otpStage, setOtpStage] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);

  const refresh = () => api.get('/api/auth/profile').then(({ data }) => {
    setUser(data.user);
    saveSession(localStorage.getItem('token'), data.user);
    setTwoFA(data.user.twoFactorEnabled);
  }).catch(() => {});

  useEffect(() => { refresh(); api.get('/api/auth/sessions').then(({ data }) => setSessions(data.sessions || [])).catch(() => {}); }, []);

  const flash = (msg, isError = false) => { setMessage(msg); setError(isError ? msg : ''); setTimeout(() => { setMessage(''); setError(''); }, 5000); };

  const changeLang = (next) => { setLang(next); setLangState(next); flash(next === 'bn' ? 'ভাষা বাংলা করা হয়েছে' : 'Language set to English'); };
  const toggleSound = () => { const next = !sound; setSoundEnabled(next); setSoundState(next); };

  const togglePush = async () => {
    if (pushOn) {
      const result = await disablePushNotifications();
      setPushOn(false);
      flash(result.message);
    } else {
      const result = await enablePushNotifications();
      setPushOn(result.ok);
      flash(result.message, !result.ok);
    }
  };

  const toggle2FA = async () => {
    try {
      const { data } = await api.post('/api/auth/2fa', { enabled: !twoFA });
      if (data.requiresOtp) { setOtpStage('enable'); flash(data.message); }
      else { setTwoFA(false); flash(data.message); }
    } catch (err) { flash(err.response?.data?.message || '2FA update failed', true); }
  };

  const confirm2FA = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/api/auth/2fa/confirm', { code });
      setTwoFA(true); setOtpStage(null); setCode('');
      flash(data.message);
    } catch (err) { flash(err.response?.data?.message || 'Invalid code', true); }
  };

  const revokeSessions = async () => {
    if (!window.confirm('Revoke all sessions? You will need to log in again.')) return;
    try { const { data } = await api.delete('/api/auth/sessions'); flash(data.message); setSessions([]); }
    catch (err) { flash(err.response?.data?.message || 'Revoke failed', true); }
  };

  const sendReset = async () => {
    try {
      const { data } = await api.post('/api/auth/forgot-password', { email: user.email });
      flash(data.message + (data.devLink ? ` — dev link: ${data.devLink}` : ''));
    } catch (err) { flash(err.response?.data?.message || 'Request failed', true); }
  };

  const toggleLiveLocation = async () => {
    try {
      const { data } = await api.put('/api/auth/profile', { shareLiveLocation: !user.shareLiveLocation });
      setUser(data.user); saveSession(localStorage.getItem('token'), data.user);
      flash(data.user.shareLiveLocation ? 'Live location sharing ON — your position updates while you browse' : 'Live location sharing OFF');
    } catch (err) { flash(err.response?.data?.message || 'Update failed', true); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl pt-10">
        <p className="text-xs font-black uppercase tracking-widest text-red-400">Preferences & Security</p>
        <h1 className="mb-8 text-4xl font-black">{t('settings')}</h1>

        {message && <div className={`mb-5 rounded-xl border p-4 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{message}</div>}

        <Section icon={<Languages />} title={`${t('language')} / Language`}>
          <div className="flex gap-2">
            <button onClick={() => changeLang('en')} className={`rounded-xl px-4 py-2 font-bold ${lang === 'en' ? 'bg-red-600' : 'bg-slate-800'}`}>English</button>
            <button onClick={() => changeLang('bn')} className={`rounded-xl px-4 py-2 font-bold ${lang === 'bn' ? 'bg-red-600' : 'bg-slate-800'}`}>বাংলা</button>
          </div>
        </Section>

        <Section icon={<Volume2 />} title={t('soundAlerts')}>
          <Toggle checked={sound} onChange={toggleSound} label={sound ? 'Sound ON' : 'Sound OFF'} />
        </Section>

        <Section icon={<BellRing />} title={t('pushNotifications')}>
          <Toggle checked={pushOn} onChange={togglePush} label={pushOn ? 'Push enabled' : 'Enable browser push'} />
          <p className="mt-2 text-xs text-slate-500">Get notified about blood requests even when the tab is in background (PWA).</p>
        </Section>

        <Section icon={<ShieldCheck />} title="Two-factor authentication (2FA)">
          <Toggle checked={twoFA} onChange={toggle2FA} label={twoFA ? '2FA is ON (email code on login)' : 'Enable 2FA'} />
          {otpStage === 'enable' && (
            <form onSubmit={confirm2FA} className="mt-3 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" maxLength={6} required className="w-40 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
              <button className="rounded-xl bg-emerald-600 px-4 py-2 font-bold">Confirm</button>
            </form>
          )}
        </Section>

        <Section icon={<KeyRound />} title="Password & sessions">
          <button onClick={sendReset} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold">Email me a password reset link</button>
          <button onClick={revokeSessions} className="ml-2 rounded-xl bg-red-600/20 px-4 py-2 text-sm font-bold text-red-300"><LogOut className="mr-1 inline h-4 w-4" />Revoke all sessions</button>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p className="flex items-center gap-1 font-bold text-slate-400"><MonitorSmartphone className="h-3.5 w-3.5" />Active sessions: {sessions.length}</p>
            {sessions.map((s) => <p key={s.id}>• {new Date(s.createdAt).toLocaleString()} {s.ip && `— ${s.ip}`}</p>)}
          </div>
        </Section>

        <Section icon={<MapPin />} title="Live location sharing">
          <Toggle checked={Boolean(user?.shareLiveLocation)} onChange={toggleLiveLocation} label={user?.shareLiveLocation ? 'Streaming to nearby users' : 'Share my live position'} />
          <p className="mt-2 text-xs text-slate-500">When ON, donors near emergency requests get real-time updates of your map position.</p>
        </Section>

        <Section icon={<Globe />} title="Email verification">
          <p className="text-sm text-slate-400">{user?.emailVerified ? '✅ Email verified' : 'Email not verified yet'}</p>
          {!user?.emailVerified && (
            <button onClick={() => api.post('/api/auth/email/send-verification').then(({ data }) => flash(data.message + (data.devLink ? ` — dev link: ${data.devLink}` : ''))).catch((e) => flash(e.response?.data?.message || 'Failed', true))} className="ml-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold">Send verification email</button>
          )}
        </Section>
      </div>
    </div>
  );
}

const Section = ({ icon, title, children }) => (
  <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
    <h2 className="mb-3 flex items-center gap-2 font-black"><span className="text-red-400">{icon}</span>{title}</h2>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <button onClick={onChange} className={`rounded-xl px-4 py-2 text-sm font-bold ${checked ? 'bg-emerald-600' : 'bg-slate-700'}`}>{label}</button>
);
