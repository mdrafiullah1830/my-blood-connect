import { useEffect, useState } from 'react';
import { ShieldCheck, Users, Droplets, Activity, Trash2, Ban, CheckCircle2, Building2, Plus } from 'lucide-react';
import api, { getStoredUser } from '../lib/api';
import { Navigate } from 'react-router-dom';

const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-500';

// admin console — stats, user management, request moderation, blood bank stock.
export default function Admin() {
  const me = getStoredUser();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [banks, setBanks] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bankForm, setBankForm] = useState({ name: '', address: '', city: '', phone: '', emergencyPhone: '', ambulancePhone: '', type: 'blood_bank' });

  const flash = (msg, isError = false) => { setMessage(msg); setError(isError ? msg : ''); setTimeout(() => { setMessage(''); setError(''); }, 5000); };

  const load = async () => {
    try {
      const [statsRes, usersRes, reqRes, banksRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users?limit=50'),
        api.get('/api/admin/requests?limit=50'),
        api.get('/api/banks')
      ]);
      setStats(statsRes.data.stats || null);
      setUsers(usersRes.data.users || []);
      setRequests(reqRes.data.requests || []);
      setBanks(banksRes.data.banks || []);
    } catch (err) { flash(err.response?.data?.message || 'Unable to load admin data', true); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (me?.role !== 'admin') return; load(); }, []);

  // admin na hole access blocked — hook er pore return, jate hook order thik thake.
  if (me?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const verifyUser = async (id, verified) => {
    try { await api.patch(`/api/admin/users/${id}/verify`, { verified }); flash(verified ? 'User verified' : 'Verification removed'); load(); }
    catch (err) { flash(err.response?.data?.message || 'Action failed', true); }
  };

  const makeAdmin = async (id, role) => {
    try { await api.patch(`/api/admin/users/${id}/role`, { role }); flash(`Role set to ${role}`); load(); }
    catch (err) { flash(err.response?.data?.message || 'Action failed', true); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    try { await api.delete(`/api/admin/users/${id}`); flash('User deleted'); load(); }
    catch (err) { flash(err.response?.data?.message || 'Delete failed', true); }
  };

  const cancelRequest = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    try { await api.patch(`/api/admin/requests/${id}/cancel`); flash('Request cancelled'); load(); }
    catch (err) { flash(err.response?.data?.message || 'Cancel failed', true); }
  };

  const createBank = async (e) => {
    e.preventDefault();
    try { await api.post('/api/admin/banks', bankForm); setBankForm({ ...bankForm, name: '', address: '', city: '', phone: '', emergencyPhone: '', ambulancePhone: '' }); flash('Blood bank created'); load(); }
    catch (err) { flash(err.response?.data?.message || 'Create failed', true); }
  };

  const updateStock = async (id, bloodGroup, bags) => {
    try { await api.patch(`/api/banks/${id}/stock`, { bloodGroup, bags: Number(bags) }); flash('Stock updated'); }
    catch (err) { flash(err.response?.data?.message || 'Stock update failed', true); }
  };

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl pt-10">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-red-400" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-400">Admin Console</p>
            <h1 className="text-4xl font-black">Administration</h1>
          </div>
        </div>

        {message && <div className={`mb-4 rounded-xl border p-4 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{message}</div>}

        <div className="mb-6 flex flex-wrap gap-2">
          {[['stats', 'Stats'], ['users', 'Users'], ['requests', 'Requests'], ['banks', 'Blood banks']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-red-600' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
          ))}
        </div>

        {tab === 'stats' && (stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card icon={<Users />} label="Total users" value={stats.users} tone="text-cyan-400" />
            <Card icon={<ShieldCheck />} label="Verified donors" value={stats.verified} tone="text-emerald-400" />
            <Card icon={<Droplets />} label="Donation records" value={stats.donations} tone="text-red-400" />
            <Card icon={<Activity />} label="Active requests" value={stats.pending} tone="text-yellow-400" />
            <Card icon={<Users />} label="Donors available now" value={stats.available} tone="text-emerald-400" />
            <Card icon={<Droplets />} label="Fulfilled requests" value={stats.fulfilled} tone="text-emerald-400" />
            <Card icon={<Building2 />} label="Blood banks" value={stats.banks} tone="text-cyan-400" />
            <Card icon={<Activity />} label="Cancelled requests" value={stats.cancelled} tone="text-slate-400" />
          </div>
        ) : <p className="text-slate-500">Loading...</p>)}

        {tab === 'users' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Name</th><th className="p-3">Blood</th><th className="p-3">City</th><th className="p-3">Donations</th><th className="p-3">Role</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || u._id} className="border-t border-slate-800/70 bg-slate-900/40">
                    <td className="p-3 font-bold">{u.name} {u.verified && <span className="text-emerald-400">✔</span>}<br /><span className="text-xs font-normal text-slate-500">{u.email}</span></td>
                    <td className="p-3 text-red-400">{u.bloodGroup}</td>
                    <td className="p-3">{u.city}</td>
                    <td className="p-3">{u.donationCount}</td>
                    <td className="p-3 capitalize">{u.role}</td>
                    <td className="p-3">
                      <button onClick={() => verifyUser(u.id || u._id, !u.verified)} className="mr-1 rounded-lg bg-slate-800 px-2 py-1 text-xs">{u.verified ? <><Ban className="mr-1 inline h-3 w-3" />Unverify</> : <><CheckCircle2 className="mr-1 inline h-3 w-3" />Verify</>}</button>
                      <button onClick={() => makeAdmin(u.id || u._id, u.role === 'admin' ? 'user' : 'admin')} className="mr-1 rounded-lg bg-slate-800 px-2 py-1 text-xs">{u.role === 'admin' ? 'Demote' : 'Make admin'}</button>
                      <button onClick={() => deleteUser(u.id || u._id)} className="rounded-lg bg-red-600/20 px-2 py-1 text-xs text-red-300"><Trash2 className="mr-1 inline h-3 w-3" />Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'requests' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Patient</th><th className="p-3">Blood</th><th className="p-3">Location</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r._id} className="border-t border-slate-800/70 bg-slate-900/40">
                    <td className="p-3 font-bold">{r.patientName || r.name}</td>
                    <td className="p-3 text-red-400">{r.bloodGroup}</td>
                    <td className="p-3">{r.city || r.location || '—'}</td>
                    <td className="p-3 capitalize">{r.priority || 'normal'}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                    <td className="p-3">{['pending', 'open', 'active', 'urgent'].includes(r.status) && (
                      <button onClick={() => cancelRequest(r._id)} className="rounded-lg bg-red-600/20 px-2 py-1 text-xs text-red-300"><Ban className="mr-1 inline h-3 w-3" />Cancel</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'banks' && (
          <div className="space-y-6">
            <form onSubmit={createBank} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-3">
              <input required placeholder="Name" value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} className={input} />
              <input required placeholder="Address" value={bankForm.address} onChange={(e) => setBankForm({ ...bankForm, address: e.target.value })} className={input} />
              <input required placeholder="City" value={bankForm.city} onChange={(e) => setBankForm({ ...bankForm, city: e.target.value })} className={input} />
              <input placeholder="Phone" value={bankForm.phone} onChange={(e) => setBankForm({ ...bankForm, phone: e.target.value })} className={input} />
              <input placeholder="Emergency phone" value={bankForm.emergencyPhone} onChange={(e) => setBankForm({ ...bankForm, emergencyPhone: e.target.value })} className={input} />
              <input placeholder="Ambulance phone" value={bankForm.ambulancePhone} onChange={(e) => setBankForm({ ...bankForm, ambulancePhone: e.target.value })} className={input} />
              <select value={bankForm.type} onChange={(e) => setBankForm({ ...bankForm, type: e.target.value })} className={input}>
                <option value="blood_bank">Blood bank</option>
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
              </select>
              <button className="rounded-xl bg-red-600 py-2.5 font-black md:col-span-2"><Plus className="mr-1 inline h-4 w-4" />Add blood bank</button>
            </form>

            <div className="grid gap-4 md:grid-cols-2">
              {banks.map((b) => (
                <div key={b._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="font-black">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.address}, {b.city}</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {BLOOD_GROUPS.map((g) => {
                      const current = b.stock?.find((s) => s.bloodGroup === g)?.bags ?? 0;
                      return (
                        <label key={g} className="text-center text-xs">
                          <span className="mb-1 block font-bold text-red-300">{g}</span>
                          <input type="number" min="0" defaultValue={current} onBlur={(e) => updateStock(b._id, g, e.target.value)} className={`${input} px-1 text-center`} />
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">Change any number and click outside to save.</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Card = ({ icon, label, value, tone }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
    <div className={`mb-2 ${tone}`}>{icon}</div>
    <p className="text-xs uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-3xl font-black">{value ?? '—'}</p>
  </div>
);
