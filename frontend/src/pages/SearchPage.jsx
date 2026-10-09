import { useEffect, useState } from 'react';
import { Search, MapPin, Navigation, Send, X, Heart, Star, BadgeCheck } from 'lucide-react';
import LiveMap from '../components/LiveMap';
import DateTimePicker from '../components/DateTimePicker';
import api, { API_URL, getStoredUser } from '../lib/api';
import { divisions, commonThanas } from '../data/bangladeshLocations';
import { getAccuratePosition } from '../lib/geolocation';

const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-red-500';

// ei page e recipient donor search kora hoy, ar blood group, location, ar live GPS er basis e matching donor pawa hoy.
export default function SearchPage() {
  const user = getStoredUser();
  const [filters, setFilters] = useState({ bloodGroup:'All', division:'', district:'', thana:'' });
  const [extra, setExtra] = useState({ radiusKm:'', sortBy:'distance', compatible:false, verifiedOnly:false, availableDay:'', availableTime:'' });
  const [favorites, setFavorites] = useState([]);
  const [locationOptions, setLocationOptions] = useState({ divisions, thanas:commonThanas });
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [donors, setDonors] = useState([]);
  const [lastSearchType, setLastSearchType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsMessage, setGpsMessage] = useState('Live GPS will be requested when you search.');
  const [selectedDonors, setSelectedDonors] = useState([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ patientName:'', hospitalName:'', hospitalAddress:'', contactNumber:'', bagsRequired:1, neededAt:'', priority:'normal' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/favorites').then(({ data }) => setFavorites((data.favorites || []).map((f) => f._id))).catch(() => {});
  }, []);

  const toggleFavorite = async (donor) => {
    const saved = favorites.includes(donor._id);
    setFavorites((prev) => saved ? prev.filter((id) => id !== donor._id) : [...prev, donor._id]);
    try {
      if (saved) await api.delete(`/api/favorites/${donor._id}`);
      else await api.post('/api/favorites', { donorId: donor._id });
    } catch { setFavorites((prev) => saved ? [...prev, donor._id] : prev.filter((id) => id !== donor._id)); }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/locations/hierarchy`)
      .then((response) => { if (!response.ok) throw new Error('Location service unavailable'); return response.json(); })
      .then((data) => { if (data.divisions && data.thanas) setLocationOptions({ divisions:data.divisions, thanas:data.thanas }); })
      .catch(() => {})
      .finally(() => setLocationsLoading(false));
  }, []);

  const change = (event) => setFilters((previous) => ({ ...previous, [event.target.name]:event.target.value }));
  const divisionChange = (event) => setFilters((previous) => ({ ...previous, division:event.target.value, district:'', thana:'' }));
  const districtChange = (event) => setFilters((previous) => ({ ...previous, district:event.target.value, thana:'' }));

  const search = async (useGps) => {
    setError(''); setMessage(''); setLoading(true);
    setGpsMessage(useGps ? 'Requesting your live GPS location...' : 'Searching only with your selected filters...');
    try {
      let coords = {};
      if (useGps) {
        try {
          coords = await getLiveGps();
          window.__bloodConnectRecipientLocation = coords;
          setGpsMessage('Live GPS received. Matching filters and showing nearest donors first.');
        } catch (gpsError) {
          setGpsMessage('GPS was not available. Use the Search Without GPS button.');
          throw gpsError;
        }
      }
      const params = { ...filters, ...coords, searchType:useGps ? 'gps' : 'profile' };
      if (extra.radiusKm) params.radiusKm = extra.radiusKm;
      if (extra.sortBy) params.sortBy = extra.sortBy;
      if (extra.compatible) params.compatible = 'true';
      if (extra.verifiedOnly) params.verifiedOnly = 'true';
      if (extra.availableDay) params.availableDay = extra.availableDay;
      if (extra.availableTime) params.availableTime = extra.availableTime;
      Object.keys(params).forEach((key) => { if (params[key] === '' || params[key] === undefined) delete params[key]; });
      const { data } = await api.get('/api/donors/search', { params });
      const otherDonors = (data.donors || []).filter((donor) => String(donor._id) !== String(user.id));
      setDonors(otherDonors);
      setLastSearchType(useGps ? 'gps' : 'profile');
      if (!useGps) window.__bloodConnectRecipientLocation = null;
      setSelectedDonors([]);
      if (useGps && coords.accuracy) setGpsMessage(`Live GPS received (about ${Math.round(coords.accuracy)} m accuracy). Nearest fresh-GPS donors are shown first.`);
      if (!useGps) setGpsMessage(`Search completed using only your selected filters. ${otherDonors.length} donor(s) found.`);
      if (!otherDonors.length) setGpsMessage(useGps ? 'GPS received, but no available eligible donor matched the selected filters.' : 'No available eligible donor matched the selected filters.');
    } catch (searchError) {
      setDonors([]);
      setLastSearchType(null);
      window.__bloodConnectRecipientLocation = null;
      setGpsMessage(useGps ? 'Could not complete live GPS search.' : 'Could not complete filter search.');
      setError(searchError.response?.data?.message || searchError.message || 'Could not access your live GPS location.');
    } finally { setLoading(false); }
  };

  const toggleDonor = (donor) => setSelectedDonors((previous) => previous.some((item)=>item._id===donor._id) ? previous.filter((item)=>item._id!==donor._id) : [...previous,donor]);
  const openRequest = () => { if (!selectedDonors.length) return; const groups=[...new Set(selectedDonors.map((d)=>d.bloodGroup))]; setForm((previous) => ({ ...previous, patientName:user.name, contactNumber:user.phone, bloodGroup:previous.bloodGroup||groups[0] })); setMessage(''); setRequestOpen(true); };

  const send = async (event) => {
    event.preventDefault(); setMessage('');
    try {
      if (!form.neededAt) { setMessage('Please choose when the blood is needed.'); return; }
      const bloodGroups=[...new Set(selectedDonors.map((d)=>d.bloodGroup))];
      await api.post('/api/requests/create', { ...form, bloodGroup:form.bloodGroup||bloodGroups[0], neededTime:new Date(form.neededAt), requestType:'direct', targetDonorIds:selectedDonors.map((donor)=>donor._id) });
      setMessage(`Request sent to ${selectedDonors.length} selected donor(s).`); setRequestOpen(false); setSelectedDonors([]);
    } catch (sendError) { setMessage(sendError.response?.data?.message || sendError.message || 'Request failed.'); }
  };

  return <div className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-7xl pt-10">
    <div className="mb-8"><p className="text-xs font-black uppercase tracking-widest text-red-400">Nearby Search</p><h1 className="text-4xl font-black">Find Nearby Eligible Donors</h1><p className="mt-2 text-slate-400">Your live GPS location is used to show the nearest eligible donors first.</p></div>
    <form onSubmit={(event) => event.preventDefault()} className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:grid-cols-4">
      <Select label="Blood Group" name="bloodGroup" value={filters.bloodGroup} onChange={change} options={['All','A+','A-','B+','B-','AB+','AB-','O+','O-']} />
      <Select label="Division" name="division" value={filters.division} onChange={divisionChange} disabled={locationsLoading} options={['',...Object.keys(locationOptions.divisions)]}/>
      <Select label="District" name="district" value={filters.district} onChange={districtChange} disabled={!filters.division || locationsLoading} options={['',...(locationOptions.divisions[filters.division] || [])]}/>
      <Select label={`Thana / Upazila${filters.district ? ` (${(locationOptions.thanas[filters.district] || []).length})` : ''}`} name="thana" value={filters.thana} onChange={change} disabled={!filters.district || locationsLoading} options={['',...(locationOptions.thanas[filters.district] || [])]}/>
      <div><label className="text-xs uppercase text-slate-400">Radius (km)</label><select value={extra.radiusKm} onChange={(e)=>setExtra((p)=>({...p,radiusKm:e.target.value}))} className={`${input} cursor-pointer`}><option value="">Any distance</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option><option value="50">Within 50 km</option><option value="100">Within 100 km</option></select></div>
      <div><label className="text-xs uppercase text-slate-400">Sort by</label><select value={extra.sortBy} onChange={(e)=>setExtra((p)=>({...p,sortBy:e.target.value}))} className={`${input} cursor-pointer`}><option value="distance">Nearest first</option><option value="rating">Top rated</option><option value="donationCount">Most donations</option><option value="recent">Recently donated</option></select></div>
      <div><label className="text-xs uppercase text-slate-400">Availability day</label><select value={extra.availableDay} onChange={(e)=>setExtra((p)=>({...p,availableDay:e.target.value}))} className={`${input} cursor-pointer`}><option value="">Any day</option>{['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'].map((d)=><option key={d}>{d}</option>)}</select></div>
      <div><label className="text-xs uppercase text-slate-400">Available time</label><select value={extra.availableTime} onChange={(e)=>setExtra((p)=>({...p,availableTime:e.target.value}))} className={`${input} cursor-pointer`}><option value="">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></div>
      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"><input type="checkbox" checked={extra.compatible} onChange={(e)=>setExtra((p)=>({...p,compatible:e.target.checked}))} className="h-4 w-4 accent-red-600"/>Compatible blood groups (e.g. O- donors for any group)</label>
      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"><input type="checkbox" checked={extra.verifiedOnly} onChange={(e)=>setExtra((p)=>({...p,verifiedOnly:e.target.checked}))} className="h-4 w-4 accent-red-600"/>Verified donors only</label>
      <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 md:col-span-2"><Navigation className="mr-2 h-4 w-4 shrink-0 text-emerald-400"/>{gpsMessage}</div>
      <button type="button" disabled={loading} onClick={() => search(true)} className="rounded-xl bg-red-600 py-3 font-black md:col-span-2"><Navigation className="mr-2 inline h-4 w-4"/>{loading ? 'Searching...' : 'Search with Live GPS'}</button>
      <button type="button" disabled={loading} onClick={() => search(false)} className="rounded-xl bg-slate-700 py-3 font-black md:col-span-2"><Search className="mr-2 inline h-4 w-4"/>{loading ? 'Searching...' : 'Search without GPS'}</button>
    </form>
    {error && <p className="mt-3 text-red-400">{error}</p>}{message && <p className="mt-3 text-emerald-400">{message}</p>}
    {donors.length > 0 && <div className="mt-8"><div className="mb-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-200">{lastSearchType === 'gps' ? 'Distance is shown only for donor GPS updated within 48 hours. Identical GPS coordinates always share the same location and distance.' : 'Search without GPS uses only the selected filters and profile addresses. No distance is calculated.'}</div>{lastSearchType === 'gps' && donors.some((donor) => donor.locationSource === 'gps') && <LiveMap donorsList={donors}/>}<div className="sticky top-20 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-slate-900/95 p-4 shadow-xl"><p className="font-bold"><span className="text-red-400">{selectedDonors.length}</span> donor(s) selected</p><button disabled={!selectedDonors.length} onClick={openRequest} className="rounded-xl bg-red-600 px-5 py-3 font-black"><Send className="mr-2 inline h-4 w-4"/>Request Selected Donors</button></div><div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{donors.map((donor) => {const selected=selectedDonors.some((item)=>item._id===donor._id);return <div key={donor._id} className={`rounded-3xl border p-5 ${selected?'border-emerald-500 bg-emerald-500/10':'border-slate-800 bg-slate-900/70'}`}><div className="flex justify-between"><div><p className="text-xl font-black">{donor.name}{donor.verified && <BadgeCheck className="ml-1 inline h-4 w-4 text-cyan-400"/>}</p><p className="font-black text-red-400">{donor.bloodGroup}{donor.ratingSum!=null&&donor.ratingCount>0&&<span className="ml-2 text-xs font-bold text-yellow-400"><Star className="inline h-3 w-3 fill-yellow-400"/>{(donor.ratingSum/donor.ratingCount).toFixed(1)}</span>}</p></div><div className="flex items-start gap-2"><span className="text-xs text-emerald-400">{donor.eligible ? 'Eligible' : 'Ineligible'}</span><button type="button" onClick={()=>toggleFavorite(donor)} title={favorites.includes(donor._id)?'Remove from saved':'Save donor'} className="rounded-lg p-1.5 hover:bg-slate-800"><Heart className={`h-4 w-4 ${favorites.includes(donor._id)?'fill-red-500 text-red-500':'text-slate-500'}`}/></button></div></div><div className="mt-4 space-y-2 text-sm text-slate-400"><p className="flex items-start"><MapPin className="mr-2 mt-0.5 h-4 w-4 shrink-0"/><span>Profile address: {donorAddress(donor)}</span></p>{lastSearchType === 'gps' && donor.locationSource === 'gps' && <p>Fresh GPS: {formatGps(donor.location)}</p>}<p><Navigation className="mr-1 inline h-4 w-4"/>{lastSearchType === 'gps' && donor.locationSource === 'gps' && donor.distanceKm != null ? `Estimated ${donor.distanceKm} km straight-line (GPS updated within 48 hours)` : lastSearchType === 'gps' ? 'Distance unavailable — GPS expired or not shared; matched by profile address' : 'Matched by profile address — distance not calculated'}</p></div><button onClick={() => toggleDonor(donor)} className={`mt-5 w-full rounded-xl py-3 font-bold ${selected?'bg-emerald-600':'bg-slate-700'}`}>{selected?'Selected - Click to Remove':'Select Donor'}</button></div>})}</div></div>}
    {requestOpen && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4"><form onSubmit={send} className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6"><div className="sticky -top-6 z-10 mb-5 flex justify-between border-b border-slate-800 bg-slate-900 py-4"><div><h2 className="text-2xl font-black">Send Search Request</h2><p className="text-sm text-slate-400">To {selectedDonors.length} selected donor(s)</p></div><button type="button" onClick={() => setRequestOpen(false)} className="rounded-xl bg-slate-800 p-2"><X/></button></div><div className="space-y-3">{['patientName','hospitalName','hospitalAddress','contactNumber'].map((name) => <input key={name} name={name} required value={form[name]} onChange={(event) => setForm((previous) => ({ ...previous, [name]:event.target.value }))} placeholder={name} className={input}/>)}<input type="number" min="1" max="20" name="bagsRequired" value={form.bagsRequired} onChange={(event) => setForm((previous) => ({ ...previous, bagsRequired:event.target.value }))} className={input}/><div className="grid grid-cols-2 gap-3"><div><label className="text-xs uppercase text-slate-400">Blood group</label><select value={form.bloodGroup||''} onChange={(event)=>setForm((previous)=>({...previous,bloodGroup:event.target.value}))} className={input}><option value="">Select group</option>{[...new Set(selectedDonors.map((d)=>d.bloodGroup))].map((g)=><option key={g}>{g}</option>)}</select></div><div><label className="text-xs uppercase text-slate-400">Priority</label><select value={form.priority} onChange={(event)=>setForm((previous)=>({...previous,priority:event.target.value}))} className={input}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div></div><DateTimePicker value={form.neededAt} onChange={(neededAt) => setForm((previous) => ({ ...previous, neededAt }))}/><button className="w-full rounded-xl bg-emerald-600 py-3 font-black">Send Request to {selectedDonors.length} Donor(s)</button></div></form></div>}
  </div></div>;
}

function Select({ label, name, value, onChange, options, disabled }) { return <div><label className="text-xs uppercase text-slate-400">{label}</label><select disabled={disabled} name={name} value={value} onChange={onChange} className={`${input} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}>{options.map((option) => <option key={option} value={option}>{option || 'All'}</option>)}</select></div>; }
function donorAddress(donor) { return [donor.city, donor.thana, donor.district, donor.division].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).join(', ') || 'Address not provided'; }
function formatGps(location) { const [lng,lat]=location?.coordinates || []; return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Unavailable'; }
async function getLiveGps() { try { const position=await getAccuratePosition(); return {lat:position.latitude,lng:position.longitude,accuracy:position.accuracy}; } catch(error) { const messages={1:'Location permission was denied. Please allow location access and try again.',2:'Your current location is unavailable. Please turn on GPS and try again.',3:'GPS request timed out. Please try again.'}; throw new Error(messages[error.code]||error.message||'Could not access your live GPS location.',{cause:error}); } }
