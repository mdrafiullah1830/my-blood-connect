import { useEffect, useState } from 'react';
import { Save, MapPin, UserRound, CalendarDays, ShieldCheck, Camera, Phone, HeartPulse, Clock, Star } from 'lucide-react';
import api, { API_URL, getStoredUser, saveSession } from '../lib/api';
import { divisions as fallbackDivisions, commonThanas as fallbackThanas } from '../data/bangladeshLocations';

const DAYS = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
const TIMES = ['morning','afternoon','evening'];

export default function Profile() {
  const [user, setUser] = useState(getStoredUser());
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const [locations, setLocations] = useState({ divisions:fallbackDivisions, thanas:fallbackThanas });
  const [otpStage, setOtpStage] = useState('idle');
  const [otpCode, setOtpCode] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [savingSection, setSavingSection] = useState(false);

  useEffect(() => {
    api.get('/api/auth/profile').then(({ data }) => { setUser(data.user); setForm(data.user); saveSession(localStorage.getItem('token'), data.user); }).catch(() => {});
    fetch(`${API_URL}/api/locations/hierarchy`).then((response)=>response.json()).then((data)=>{if(data.divisions&&data.thanas)setLocations({divisions:data.divisions,thanas:data.thanas});}).catch(()=>{});
    api.get(`/api/favorites/reviews/${getStoredUser()?.id}`).then(({ data }) => setReviews(data.reviews || [])).catch(() => {});
  }, []);

  const flash = (msg, isError = false) => { setMessage(isError ? '' : msg); setError(isError ? msg : ''); setTimeout(() => { setMessage(''); setError(''); }, 6000); };

  const change = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const changeDivision = (e) => setForm((p) => ({ ...p, division: e.target.value, district: '', thana: '' }));
  const changeDistrict = (e) => setForm((p) => ({ ...p, district: e.target.value, thana: '' }));
  const getLocation = () => navigator.geolocation?.getCurrentPosition((p) => setForm((v) => ({ ...v, latitude: p.coords.latitude, longitude: p.coords.longitude })));

  const save = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    try { const { data } = await api.put('/api/auth/profile', form); setUser(data.user); saveSession(localStorage.getItem('token'), data.user); setEditing(false); setMessage('Profile saved successfully.'); }
    catch (err) { setError(err.response?.data?.message || err.message || 'Profile update failed.'); }
  };

  // avatar upload — file base64 convert hoy, backend e ≤400KB data URL hisebe jay.
  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    if (file.size > 400 * 1024) { setAvatarError('Image must be under 400KB.'); return; }
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
      const { data } = await api.put('/api/auth/profile', { avatar: dataUrl });
      setUser(data.user); setForm((p) => ({ ...p, avatar: data.user.avatar })); saveSession(localStorage.getItem('token'), data.user);
      flash('Profile photo updated.');
    } catch (err) { setAvatarError(err.response?.data?.message || 'Avatar upload failed.'); }
  };

  const sendPhoneOtp = async () => {
    try { const { data } = await api.post('/api/auth/otp/phone/send'); setOtpStage('verify'); flash(data.message || 'OTP sent to your phone.'); }
    catch (err) { flash(err.response?.data?.message || 'Could not send OTP.', true); }
  };
  const verifyPhoneOtp = async () => {
    try { const { data } = await api.post('/api/auth/otp/phone/verify', { code: otpCode }); setOtpStage('idle'); setOtpCode(''); setUser(data.user); setForm((p) => ({ ...p, phoneVerified: true })); saveSession(localStorage.getItem('token'), data.user); flash(data.message || 'Phone verified.'); }
    catch (err) { flash(err.response?.data?.message || 'Invalid OTP.', true); }
  };

  const saveHealth = async () => {
    setSavingSection(true);
    try { const { data } = await api.put('/api/auth/profile', { health: form.health || {} }); setUser(data.user); saveSession(localStorage.getItem('token'), data.user); flash('Health details saved.'); }
    catch (err) { flash(err.response?.data?.message || 'Health save failed.', true); }
    finally { setSavingSection(false); }
  };

  const saveSlots = async () => {
    setSavingSection(true);
    try { const { data } = await api.put('/api/auth/profile', { availabilitySlots: form.availabilitySlots || [] }); setUser(data.user); saveSession(localStorage.getItem('token'), data.user); flash('Availability schedule saved.'); }
    catch (err) { flash(err.response?.data?.message || 'Schedule save failed.', true); }
    finally { setSavingSection(false); }
  };

  const toggleSlot = (day, time) => {
    setForm((p) => {
      const slots = Array.isArray(p.availabilitySlots) ? [...p.availabilitySlots] : [];
      const exists = slots.find((s) => s.day === day && s.time === time);
      const next = exists ? slots.filter((s) => !(s.day === day && s.time === time)) : [...slots, { day, time }];
      return { ...p, availabilitySlots: next.slice(0, 14) };
    });
  };

  const health = form.health || {};
  const setHealth = (patch) => setForm((p) => ({ ...p, health: { ...(p.health || {}), ...patch } }));
  const slots = Array.isArray(form.availabilitySlots) ? form.availabilitySlots : [];
  const avgRating = user.ratingCount > 0 ? user.rating : null;

  if (!user) return <div className="min-h-screen bg-slate-950 text-white p-10 text-center">Please log in first.</div>;

  return <div className="min-h-screen bg-slate-950 text-white p-6"><div className="max-w-4xl mx-auto pt-10">
    <div className="flex justify-between items-center mb-8"><div><p className="text-red-400 text-xs font-black uppercase tracking-widest">Shared Profile</p><h1 className="text-4xl font-black">My Account Profile</h1><p className="mt-2 text-slate-400">Changes apply to both Donor and Recipient modes.</p></div><button onClick={() => setEditing(!editing)} className="px-5 py-3 rounded-xl bg-red-600 font-bold">{editing ? 'Cancel' : 'Edit Profile'}</button></div>
    {message && <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">{message}</div>}
    {error && <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>}
    <form onSubmit={save} className="bg-slate-900/70 border border-slate-800 rounded-3xl p-7 grid md:grid-cols-2 gap-5">
      {['name','phone','age','weight','lastDonationDate','nidDocument','birthCertificateDocument'].map((name) => <div key={name}><label className="block text-xs text-slate-400 uppercase mb-2">{name === 'nidDocument' ? 'NID / Document URL' : name === 'birthCertificateDocument' ? 'Birth Certificate / Document URL' : name === 'lastDonationDate' ? 'Last Donation Date' : name}</label><input disabled={!editing} name={name} max={name === 'lastDonationDate' ? new Date().toISOString().slice(0,10) : undefined} value={name === 'lastDonationDate' && form[name] ? new Date(form[name]).toISOString().slice(0,10) : (form[name] ?? '')} onChange={change} type={['age','weight'].includes(name) ? 'number' : name === 'lastDonationDate' ? 'date' : 'text'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 disabled:opacity-60 [color-scheme:dark]" /></div>)}
      <div><label className="block text-xs text-slate-400 uppercase mb-2">Blood Group</label><select disabled={!editing} name="bloodGroup" value={form.bloodGroup || ''} onChange={change} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3"><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>
      <div><label className="block text-xs text-slate-400 uppercase mb-2">Division</label><select disabled={!editing} name="division" value={form.division || ''} onChange={changeDivision} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3"><option value="">Choose</option>{Object.keys(locations.divisions).map((d) => <option key={d}>{d}</option>)}</select></div>
      <div><label className="block text-xs text-slate-400 uppercase mb-2">District</label><select disabled={!editing} name="district" value={form.district || ''} onChange={changeDistrict} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3"><option value="">Choose</option>{(locations.divisions[form.division] || []).map((d) => <option key={d}>{d}</option>)}</select></div>
      <div><label className="block text-xs text-slate-400 uppercase mb-2">Thana / Upazila</label><select disabled={!editing} name="thana" value={form.thana || ''} onChange={change} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3"><option value="">Choose</option>{(locations.thanas[form.district] || []).map((t) => <option key={t}>{t}</option>)}</select></div>
      <div><label className="block text-xs text-slate-400 uppercase mb-2">City / Area</label><input disabled={!editing} name="city" value={form.city || ''} onChange={change} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3" /></div>
      <div className="md:col-span-2 flex flex-wrap gap-3"><button type="button" onClick={getLocation} disabled={!editing} className="px-4 py-3 rounded-xl border border-slate-700 disabled:opacity-40"><MapPin className="inline w-4 h-4 mr-2" />Use Current Location</button>{editing && <button className="px-5 py-3 rounded-xl bg-emerald-600 font-bold"><Save className="inline w-4 h-4 mr-2" />Save Changes</button>}</div>
    </form>
    <div className="grid md:grid-cols-3 gap-4 mt-5"><Info icon={<UserRound />} label="Account" value="Donor + Recipient" /><Info icon={<ShieldCheck />} label="Donor Availability" value={user.isAvailable ? 'Available' : 'Unavailable'} /><Info icon={<CalendarDays />} label="Last Donation" value={user.lastDonationDate ? new Date(user.lastDonationDate).toLocaleDateString() : 'Never'} /><Info icon={<Star />} label="Community Rating" value={avgRating ? `${avgRating} / 5 (${user.ratingCount} reviews)` : 'No reviews yet'} /><Info icon={<HeartPulse />} label="Donations" value={`${user.donationCount || 0} bag(s)`} /><Info icon={<ShieldCheck />} label="Verification" value={[user.emailVerified ? 'Email ✓' : null, user.phoneVerified ? 'Phone ✓' : 'Phone ✗', user.verified ? 'ID ✓' : null].filter(Boolean).join(' · ') || 'Not verified'} /></div>

    {/* avatar + phone OTP */}
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Camera className="h-5 w-5 text-red-400" />Photo & Phone Verification</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-red-600/20 text-3xl font-black text-red-400">
          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.name || '?')[0]}
        </div>
        <label className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold hover:bg-slate-700">
          Upload photo
          <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
        </label>
        {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}
        <div className="ml-auto text-center">
          <p className="flex items-center gap-1 text-sm font-bold"><Phone className="h-4 w-4" />{user.phone}</p>
          {user.phoneVerified ? <p className="text-xs text-emerald-400">✔ Verified</p> : otpStage === 'verify' ? (
            <div className="mt-2 flex gap-2">
              <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} placeholder="6-digit OTP" className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button onClick={verifyPhoneOtp} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold">Verify</button>
            </div>
          ) : <button onClick={sendPhoneOtp} className="mt-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold">Send OTP</button>}
        </div>
      </div>
    </div>

    {/* health details */}
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><HeartPulse className="h-5 w-5 text-red-400" />Health Details (private)</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs uppercase text-slate-400">Hemoglobin (g/dL)
          <input type="number" min="5" max="25" step="0.1" value={health.hemoglobin ?? ''} onChange={(e) => setHealth({ hemoglobin: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-xs uppercase text-slate-400">Last checkup date
          <input type="date" value={health.lastCheckupDate ? String(health.lastCheckupDate).slice(0, 10) : ''} onChange={(e) => setHealth({ lastCheckupDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 [color-scheme:dark]" />
        </label>
        <label className="text-xs uppercase text-slate-400">Known conditions (comma separated)
          <input value={(health.diseases || []).join(', ')} onChange={(e) => setHealth({ diseases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="none" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <label className="text-xs uppercase text-slate-400 md:col-span-3">Current medications (comma separated)
          <input value={(health.medications || []).join(', ')} onChange={(e) => setHealth({ medications: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="none" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
      </div>
      <button onClick={saveHealth} disabled={savingSection} className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold disabled:opacity-50"><Save className="mr-1 inline h-4 w-4" />Save health</button>
    </div>

    {/* availability calendar */}
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-black"><Clock className="h-5 w-5 text-red-400" />Donation Availability</h2>
      <p className="mb-4 text-sm text-slate-500">Pick slots when you can donate. Recipients can filter donors by these slots. Max 14 slots.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm">
          <thead><tr className="text-slate-500"><th className="p-2 text-left">Day</th>{TIMES.map((t) => <th key={t} className="p-2 capitalize">{t}</th>)}</tr></thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} className="border-t border-slate-800">
                <td className="p-2 text-left font-bold">{day}</td>
                {TIMES.map((time) => {
                  const active = slots.some((s) => s.day === day && s.time === time);
                  return (
                    <td key={time} className="p-2">
                      <button onClick={() => toggleSlot(day, time)} className={`h-8 w-full rounded-lg text-xs font-bold ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{active ? 'Free' : '—'}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={saveSlots} disabled={savingSection} className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 font-bold disabled:opacity-50"><Save className="mr-1 inline h-4 w-4" />Save schedule</button>
    </div>

    {/* reviews */}
    <div className="mt-6 mb-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Star className="h-5 w-5 text-yellow-400" />Reviews About Me</h2>
      {reviews.length === 0 ? <p className="text-sm text-slate-500">No reviews yet. Reviews appear after you complete a donation.</p> : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="rounded-xl border border-slate-800 p-4">
              <p className="text-sm font-bold text-yellow-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              <p className="mt-1 text-sm text-slate-300">{r.comment}</p>
              <p className="mt-1 text-xs text-slate-600">— {r.reviewerName || 'Anonymous'} · {new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div></div>;
}
function Info({ icon, label, value }) { return <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5"><div className="text-red-400 mb-2">{icon}</div><p className="text-xs uppercase text-slate-500">{label}</p><p className="font-bold mt-1">{value}</p></div>; }
