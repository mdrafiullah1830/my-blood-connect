import { useCallback, useEffect, useState } from 'react';
import { Check, X, HeartPulse, UserRound, CalendarDays, Pencil, Trash2, FileDown, Plus, Trophy, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getActiveMode, getStoredUser, saveSession } from '../lib/api';
import DateTimePicker from '../components/DateTimePicker';

const daysUntilEligible = (date) => date ? Math.max(0, 90 - Math.floor((Date.now() - new Date(date).getTime()) / 86400000)) : 0;

// ei dashboard e donor ar recipient duijoner dashboard logic alada alada kora hoy.
export default function Dashboard() {
  const [user] = useState(getStoredUser);
  const [mode, setMode] = useState(getActiveMode);
  const [requests, setRequests] = useState([]);
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [donations, setDonations] = useState([]);
  const [donationForm, setDonationForm] = useState({ bloodGroup:'A+', hospitalName:'', city:'', bags:1, donatedAt:'', note:'' });
  const [donationError, setDonationError] = useState('');

  const loadDonations = useCallback(async () => {
    try { const { data } = await api.get('/api/donations/mine'); setDonations(data.donations || []); } catch { /* donation list optional */ }
  }, []);

  const addDonation = async (event) => {
    event.preventDefault(); setDonationError('');
    try {
      await api.post('/api/donations', { ...donationForm, donatedAt: new Date(donationForm.donatedAt) });
      setDonationForm({ ...donationForm, hospitalName:'', city:'', note:'', donatedAt:'' });
      await loadDonations();
      const profileRes = await api.get('/api/auth/profile'); setProfile(profileRes.data.user); saveSession(localStorage.getItem('token'), profileRes.data.user);
      setMessage('Donation recorded. Thank you for saving lives!');
    } catch (err) { setDonationError(err.response?.data?.message || 'Could not record donation.'); }
  };

  const downloadReport = async () => {
    try {
      const month = new Date().toISOString().slice(0, 7);
      const response = await api.get(`/api/donations/report.pdf?month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `donation-report-${month}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setMessage(err.response?.data?.message || 'Report download failed.'); }
  };

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const profileRes = await api.get('/api/auth/profile'); setProfile(profileRes.data.user); saveSession(localStorage.getItem('token'), profileRes.data.user);
      if (mode === 'donor') {
        const [directRes, emergencyRes] = await Promise.all([
          api.get('/api/requests/incoming'),
          api.get('/api/requests/incoming/emergency')
        ]);
        setRequests(directRes.data.requests || []);
        setEmergencyRequests(emergencyRes.data.requests || []);
      } else {
        const [directRes, emergencyRes] = await Promise.all([
          api.get('/api/requests/mine/direct'),
          api.get('/api/requests/mine/emergency')
        ]);
        setRequests(directRes.data.requests || []);
        setEmergencyRequests(emergencyRes.data.requests || []);
      }
    } catch (err) { setMessage(err.response?.data?.message || err.message || 'Unable to load dashboard.'); }
    finally { setLoading(false); loadDonations(); }
  }, [user, mode, loadDonations]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const syncMode=()=>setMode(getActiveMode()); window.addEventListener('mode-changed',syncMode); return()=>window.removeEventListener('mode-changed',syncMode); }, []);

  const respond = async (id, status) => { try { await api.patch(`/api/requests/${id}/respond`, { status }); setMessage(`Request ${status}.`); load(); } catch (err) { setMessage(err.response?.data?.message || err.message || 'Action failed.'); } };
  const availability = async (value) => { try { const { data } = await api.patch('/api/auth/availability', { isAvailable: value }); setProfile(data.user); saveSession(localStorage.getItem('token'), data.user); } catch (err) { setMessage(err.response?.data?.message || err.message || 'Could not update availability.'); } };
  const openEdit = (request) => { setEditError(''); setEditing(request); setEditForm({ patientName:request.patientName, bloodGroup:request.bloodGroup, hospitalName:request.hospitalName, hospitalAddress:request.hospitalAddress, contactNumber:request.contactNumber, bagsRequired:request.bagsRequired, neededAt:toLocalInputValue(new Date(request.neededTime)) }); };
  const saveEdit = async (event) => { event.preventDefault(); if (saving) return; setSaving(true); setEditError(''); try { await api.put(`/api/requests/${editing._id}`, { ...editForm, neededTime:new Date(editForm.neededAt) }); setMessage('Request updated successfully.'); setEditing(null); setEditForm(null); await load(); } catch (err) { setEditError(err.response?.data?.message || err.message || 'Update failed.'); } finally { setSaving(false); } };
  const removeRequest = async (id) => { if (!window.confirm('Delete this blood request permanently?')) return; try { await api.delete(`/api/requests/${id}`); setMessage('Request deleted successfully.'); load(); } catch (err) { setMessage(err.response?.data?.message || err.message || 'Delete failed.'); } };

  if (!user) return <div className="min-h-screen bg-slate-950 text-white p-10 text-center">Please log in first.</div>;
  const accepted = (r) => (r.responses || []).filter((x) => x.status === 'accepted').length;

  return <div className="min-h-screen bg-slate-950 text-white p-6"><div className="max-w-6xl mx-auto pt-10">
    <div className="flex flex-col md:flex-row justify-between gap-5 mb-8"><div><p className={`text-xs font-black uppercase tracking-widest ${mode==='donor'?'text-emerald-400':'text-red-400'}`}>{mode === 'donor' ? 'Donor Mode' : 'Recipient Mode'}</p><h1 className="text-4xl font-black">Welcome, {profile?.name}</h1><p className="text-slate-400 mt-2">{mode === 'donor' ? 'Manage incoming blood requests and your donor availability.' : 'Search donors and manage your blood requests.'}</p></div>{mode === 'donor' && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-xs text-slate-500 uppercase">Eligibility</p><p className="font-black text-lg">{daysUntilEligible(profile.lastDonationDate) === 0 ? 'Eligible now' : `${daysUntilEligible(profile.lastDonationDate)} days left`}</p>{(!profile?.age||!profile?.weight)&&<p className="mt-2 text-xs text-amber-400">Add age and weight in your shared profile to become available.</p>}<button onClick={() => availability(!profile.isAvailable)} className={`mt-2 px-4 py-2 rounded-lg text-xs font-bold ${profile.isAvailable ? 'bg-emerald-600' : 'bg-slate-700'}`}>{profile.isAvailable ? 'Available' : 'Unavailable'}</button></div>}</div>
    {message && <div className="mb-5 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">{message}</div>}
    <div className="grid md:grid-cols-3 gap-4 mb-8"><Stat icon={<HeartPulse />} title="Blood Group" value={profile?.bloodGroup} /><Stat icon={<UserRound />} title="Location" value={`${profile?.district || profile?.city || 'Not set'}`} /><Stat icon={<CalendarDays />} title="Last Donation" value={formatDonationDate(profile?.lastDonationDate)} /></div>
    {mode === 'donor' ? <div className="space-y-10">
      <RequestList title="Incoming Search Requests" empty="No donor-search requests yet." requests={requests} loading={loading} donor accepted={accepted} onRespond={respond} />
      <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5 md:p-7">
        <RequestList title="Emergency Requests" empty="No emergency requests right now." requests={emergencyRequests} loading={loading} donor accepted={accepted} onRespond={respond} emergency />
      </section>
    </div> : <div className="space-y-10">
      <RequestList title="My Search Requests" empty="No donor-search requests yet." requests={requests} loading={loading} accepted={accepted} onRespond={respond} onEdit={openEdit} onDelete={removeRequest} />
      <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5 md:p-7">
        <RequestList title="My Emergency Requests" empty="No emergency requests yet." requests={emergencyRequests} loading={loading} accepted={accepted} onRespond={respond} onEdit={openEdit} onDelete={removeRequest} emergency />
      </section>
    </div>}
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <Link to="/analytics" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-red-500/40"><Activity className="mb-2 h-5 w-5 text-cyan-400" /><p className="font-black">Platform Analytics</p><p className="text-xs text-slate-500">Live impact metrics and charts</p></Link>
      <Link to="/leaderboard" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-red-500/40"><Trophy className="mb-2 h-5 w-5 text-yellow-400" /><p className="font-black">Leaderboard</p><p className="text-xs text-slate-500">See the top donors in the community</p></Link>
      <button onClick={downloadReport} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left hover:border-red-500/40"><FileDown className="mb-2 h-5 w-5 text-emerald-400" /><p className="font-black">Monthly Report (PDF)</p><p className="text-xs text-slate-500">Download this month's donation report</p></button>
    </div>
    <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-5 md:p-7">
      <div className="mb-5 flex items-center gap-3"><h2 className="text-2xl font-black">My Donation History</h2><span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black">{donations.length} record(s)</span></div>
      <form onSubmit={addDonation} className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-3">
        <select value={donationForm.bloodGroup} onChange={(e)=>setDonationForm((p)=>({...p,bloodGroup:e.target.value}))} className={donationInput}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((g)=><option key={g}>{g}</option>)}</select>
        <input required placeholder="Hospital / blood bank" value={donationForm.hospitalName} onChange={(e)=>setDonationForm((p)=>({...p,hospitalName:e.target.value}))} className={donationInput} />
        <input placeholder="City" value={donationForm.city} onChange={(e)=>setDonationForm((p)=>({...p,city:e.target.value}))} className={donationInput} />
        <input type="number" min="1" max="4" placeholder="Bags" value={donationForm.bags} onChange={(e)=>setDonationForm((p)=>({...p,bags:e.target.value}))} className={donationInput} />
        <input required type="date" max={new Date().toISOString().slice(0,10)} value={donationForm.donatedAt} onChange={(e)=>setDonationForm((p)=>({...p,donatedAt:e.target.value}))} className={`${donationInput} [color-scheme:dark]`} />
        <input placeholder="Note (optional)" value={donationForm.note} onChange={(e)=>setDonationForm((p)=>({...p,note:e.target.value}))} className={donationInput} />
        {donationError && <p className="text-sm text-red-400 md:col-span-3">{donationError}</p>}
        <button className="rounded-xl bg-red-600 py-3 font-black md:col-span-3"><Plus className="mr-1 inline h-4 w-4" />Record donation</button>
      </form>
      {donations.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500">No donations recorded yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Blood</th><th className="p-3">Hospital</th><th className="p-3">City</th><th className="p-3">Bags</th><th className="p-3">Certificate</th><th className="p-3"></th></tr></thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d._id} className="border-t border-slate-800">
                  <td className="p-3">{new Date(d.donatedAt).toLocaleDateString()}</td>
                  <td className="p-3 font-bold text-red-400">{d.bloodGroup}</td>
                  <td className="p-3">{d.hospitalName || '—'}</td>
                  <td className="p-3">{d.city || '—'}</td>
                  <td className="p-3">{d.bags}</td>
                  <td className="p-3 text-xs text-slate-500">{d.certificateId || '—'}</td>
                  <td className="p-3"><button onClick={async()=>{if(!window.confirm('Delete this donation record?'))return;try{await api.delete(`/api/donations/${d._id}`);loadDonations();}catch(err){setMessage(err.response?.data?.message||'Delete failed.');}}} className="rounded-lg bg-red-600/20 px-2 py-1 text-xs text-red-300"><Trash2 className="inline h-3 w-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    {editing && editForm && <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/75 p-4"><form onSubmit={saveEdit} className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6"><div className="sticky -top-6 z-10 mb-5 flex items-center justify-between border-b border-slate-800 bg-slate-900 py-4"><div><p className="text-xs font-black uppercase tracking-widest text-red-400">Edit Request</p><h2 className="text-2xl font-black">Update blood request</h2></div><button type="button" disabled={saving} onClick={()=>setEditing(null)} aria-label="Close edit form" className="rounded-xl bg-slate-800 p-2 text-white"><X/></button></div>{editError && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-300">{editError}</div>}<fieldset disabled={saving} className="grid gap-3 md:grid-cols-2"><EditInput label="Patient Name" name="patientName" value={editForm.patientName} onChange={setEditForm}/><EditInput label="Hospital Name" name="hospitalName" value={editForm.hospitalName} onChange={setEditForm}/><EditInput label="Hospital Address" name="hospitalAddress" value={editForm.hospitalAddress} onChange={setEditForm}/><EditInput label="Contact Number" name="contactNumber" value={editForm.contactNumber} onChange={setEditForm}/><label className="text-xs font-bold uppercase text-slate-400">Blood Group<select value={editForm.bloodGroup} onChange={e=>setEditForm(p=>({...p,bloodGroup:e.target.value}))} className={editInputClass}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group=><option key={group}>{group}</option>)}</select></label><EditInput label="Bags Required" name="bagsRequired" type="number" min="1" max="20" value={editForm.bagsRequired} onChange={setEditForm}/><DateTimePicker value={editForm.neededAt} onChange={neededAt=>setEditForm(p=>({...p,neededAt}))}/></fieldset><button disabled={saving} className="mt-4 w-full rounded-xl bg-red-600 py-3 font-black">{saving?'Saving Changes...':'Save Changes'}</button></form></div>}
  </div></div>;
}
function Stat({ icon, title, value }) { return <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5"><div className="text-red-400 mb-2">{icon}</div><p className="text-xs text-slate-500 uppercase">{title}</p><p className="font-bold mt-1">{value || 'Not set'}</p></div>; }
function RequestList({ title, empty, requests, loading, donor = false, accepted, onRespond, emergency = false, onEdit, onDelete }) { return <section><div className="flex items-center gap-3 mb-5"><h2 className="text-2xl font-black">{title}</h2>{emergency && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase">Emergency</span>}</div>{loading ? <p className="text-slate-500">Loading...</p> : requests.length === 0 ? <div className="p-10 rounded-3xl border border-dashed border-slate-800 text-center text-slate-500">{empty}</div> : <div className="grid lg:grid-cols-2 gap-5">{requests.map((r) => <RequestCard key={r._id} request={r} donor={donor} accepted={accepted(r)} onRespond={onRespond} emergency={emergency} onEdit={onEdit} onDelete={onDelete} />)}</div>}</section>; }
function RequestCard({ request, donor, accepted, onRespond, emergency, onEdit, onDelete }) { const ownResponse = donor ? request.responses?.find((x) => String(x.donorId?._id || x.donorId) === String(getStoredUser()?.id)) : null; return <div className={`bg-slate-900/70 border rounded-3xl p-6 ${emergency ? 'border-red-500/40' : 'border-slate-800'}`}><div className="flex justify-between gap-4"><div><span className="inline-block px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-black">{request.bloodGroup}</span><h3 className="text-xl font-black mt-3">Patient: {request.patientName}</h3></div><div className="text-right"><p className="text-xs text-slate-500">Accepted</p><p className="text-2xl font-black text-emerald-400">{accepted}</p></div></div><div className="mt-4 space-y-2 text-sm text-slate-400"><p>Hospital: <span className="text-slate-200">{request.hospitalName}</span></p><p>Address: <span className="text-slate-200">{request.hospitalAddress}</span></p><p>Needed: <span className="text-slate-200">{new Date(request.neededTime).toLocaleString()}</span></p><p>Contact: <span className="text-slate-200">{request.contactNumber}</span></p></div>{donor && <div className="flex gap-3 mt-5">{ownResponse?.status === 'accepted' ? <span className="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 font-bold">Accepted</span> : ownResponse?.status === 'rejected' ? <span className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold">Rejected</span> : <><button onClick={() => onRespond(request._id, 'accepted')} className="flex-1 bg-emerald-600 rounded-xl py-3 font-bold"><Check className="inline w-4 h-4 mr-1" />Accept</button><button onClick={() => onRespond(request._id, 'rejected')} className="flex-1 bg-slate-800 rounded-xl py-3 font-bold"><X className="inline w-4 h-4 mr-1" />Reject</button></>}</div>}{!donor && onEdit && onDelete && (accepted > 0 ? <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm font-bold text-emerald-300">Accepted by a donor — editing and deleting are locked.</div> : <div className="mt-5 flex gap-3 border-t border-slate-800 pt-4"><button onClick={()=>onEdit(request)} className="flex-1 rounded-xl bg-slate-700 py-3 font-bold"><Pencil className="mr-1 inline h-4 w-4"/>Edit</button><button onClick={()=>onDelete(request._id)} className="flex-1 rounded-xl bg-red-600/20 py-3 font-bold text-red-300"><Trash2 className="mr-1 inline h-4 w-4"/>Delete</button></div>)}</div>; }
const editInputClass='mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500';
const donationInput='w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-red-500';
function EditInput({ label, name, onChange, ...props }) { return <label className="text-xs font-bold uppercase text-slate-400">{label}<input name={name} required {...props} onChange={event=>onChange(previous=>({...previous,[name]:event.target.value}))} className={editInputClass}/></label>; }
function toLocalInputValue(date) { const offset=date.getTimezoneOffset()*60000; return new Date(date.getTime()-offset).toISOString().slice(0,16); }
function formatDonationDate(value) { const date=value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) && date.getUTCFullYear() > 1970 ? date.toLocaleDateString() : 'Never'; }
