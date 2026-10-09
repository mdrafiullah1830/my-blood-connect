import { useEffect, useMemo, useState } from 'react';
import { Search, Phone, Ambulance, MapPin, Droplets, Building2 } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import api from '../lib/api';

const BLOOD_GROUPS = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-red-500';

// hospital/blood bank search + live stock + emergency/ambulance contact + map markers.
export default function BloodBanks() {
  const [banks, setBanks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', bloodGroup: 'All', type: 'All' });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.bloodGroup !== 'All') params.bloodGroup = filters.bloodGroup;
      if (filters.type !== 'All') params.type = filters.type;
      const [banksRes, contactsRes] = await Promise.all([
        api.get('/api/banks', { params }),
        api.get('/api/banks/emergency-contacts')
      ]);
      setBanks(banksRes.data.banks || []);
      setContacts(contactsRes.data.contacts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load blood banks');
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filters.bloodGroup, filters.type]);

  const search = (e) => { e.preventDefault(); load(); };

  const withCoords = useMemo(() => banks.filter((b) => b.location?.coordinates?.length === 2), [banks]);
  const center = withCoords[0]?.location?.coordinates || [90.4125, 23.8103];

  const totalStock = (bank) => (bank.stock || []).reduce((sum, s) => sum + (s.bags || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl pt-10">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Hospitals & Stock</p>
          <h1 className="text-4xl font-black">Blood Banks Near You</h1>
          <p className="mt-2 text-slate-400">Live blood stock, hospital contacts and ambulance numbers.</p>
        </div>

        <form onSubmit={search} className="mb-6 grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:grid-cols-4">
          <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Search name or address" className={`${input} md:col-span-2`} />
          <select value={filters.bloodGroup} onChange={(e) => setFilters((p) => ({ ...p, bloodGroup: e.target.value }))} className={input}>
            {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
          <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className={input}>
            <option value="All">All types</option>
            <option value="hospital">Hospital</option>
            <option value="blood_bank">Blood bank</option>
            <option value="clinic">Clinic</option>
          </select>
          <button className="md:col-span-4 rounded-xl bg-red-600 py-3 font-black"><Search className="mr-2 inline h-4 w-4" />Search</button>
        </form>

        {error && <p className="mb-4 text-red-400">{error}</p>}

        {withCoords.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-slate-800">
            <MapContainer center={[center[1], center[0]]} zoom={11} style={{ height: 340, width: '100%' }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {withCoords.map((bank) => {
                const [lng, lat] = bank.location.coordinates;
                return (
                  <Marker key={bank._id} position={[lat, lng]}>
                    <Popup>
                      <strong>{bank.name}</strong><br />
                      {bank.address}<br />
                      Stock bags: {totalStock(bank)}
                      {bank.emergencyPhone && <><br />Emergency: {bank.emergencyPhone}</>}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {loading ? <p className="text-slate-500">Loading...</p> : banks.length === 0 ? (
            <p className="col-span-full rounded-3xl border border-dashed border-slate-800 p-10 text-center text-slate-500">No blood banks matched your filters.</p>
          ) : banks.map((bank) => (
            <div key={bank._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="flex items-center gap-2 text-lg font-black"><Building2 className="h-4 w-4 text-red-400" />{bank.name}</p>
                  <p className="mt-1 text-sm text-slate-400"><MapPin className="mr-1 inline h-3.5 w-3.5" />{bank.address}, {bank.city}</p>
                </div>
                <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs capitalize">{bank.type.replace('_', ' ')}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(bank.stock || []).length === 0 ? <span className="text-xs text-slate-600">No stock info</span> :
                  bank.stock.map((s) => (
                    <span key={s.bloodGroup} className={`rounded-lg px-2.5 py-1 text-xs font-black ${s.bags > 0 ? 'bg-emerald-600/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                      <Droplets className="mr-1 inline h-3 w-3" />{s.bloodGroup}: {s.bags}
                    </span>
                  ))}
              </div>
              {(bank.emergencyPhone || bank.ambulancePhone || bank.phone) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {bank.emergencyPhone && <a href={`tel:${bank.emergencyPhone}`} className="rounded-xl bg-red-600/20 px-3 py-2 text-sm font-bold text-red-300"><Phone className="mr-1 inline h-4 w-4" />{bank.emergencyPhone}</a>}
                  {bank.ambulancePhone && <a href={`tel:${bank.ambulancePhone}`} className="rounded-xl bg-cyan-600/20 px-3 py-2 text-sm font-bold text-cyan-300"><Ambulance className="mr-1 inline h-4 w-4" />Ambulance</a>}
                </div>
              )}
            </div>
          ))}
        </div>

        {contacts.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-2xl font-black">Emergency Contacts</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {contacts.slice(0, 12).map((c) => (
                <a key={c._id} href={`tel:${c.emergencyPhone || c.ambulancePhone || c.phone}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-red-500/40">
                  <p className="font-black">{c.name}</p>
                  <p className="text-sm text-slate-400">{c.city}</p>
                  <p className="mt-2 font-bold text-red-400">{c.emergencyPhone || c.ambulancePhone || c.phone}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
