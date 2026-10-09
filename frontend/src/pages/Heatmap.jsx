import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Flame } from 'lucide-react';
import api from '../lib/api';

const BLOOD_GROUPS = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// donor density heatmap — available eligible donor gulo district bhaag kore circle size hoy.
export default function Heatmap() {
  const [rows, setRows] = useState([]);
  const [bloodGroup, setBloodGroup] = useState('All');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/api/map/heatmap', { params: bloodGroup === 'All' ? {} : { bloodGroup } })
      .then(({ data }) => setRows(data.heatmap || []))
      .catch((err) => setError(err.response?.data?.message || 'Unable to load heatmap'))
      .finally(() => setLoading(false));
  }, [bloodGroup]);

  const max = Math.max(1, ...rows.map((r) => r.total));
  const center = rows[0]?.coordinates ? [rows[0].coordinates[1], rows[0].coordinates[0]] : [23.8103, 90.4125];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-400">Live Coverage</p>
            <h1 className="text-4xl font-black">Donor Heatmap</h1>
            <p className="mt-2 text-slate-400">Where available, eligible donors are concentrated right now.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {BLOOD_GROUPS.map((g) => (
              <button key={g} onClick={() => setBloodGroup(g)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${bloodGroup === g ? 'bg-red-600' : 'bg-slate-800 text-slate-400'}`}>{g}</button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-red-400">{error}</p>}
        {loading ? <p className="text-slate-500">Loading heatmap...</p> : rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-slate-500">No available donors for this filter yet.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-slate-800">
              <MapContainer center={center} zoom={7} style={{ height: 480, width: '100%' }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {rows.map((row) => {
                  const [lng, lat] = row.coordinates;
                  const radius = 12000 + (row.total / max) * 45000;
                  return (
                    <CircleMarker key={`${row.district}-${row.city}`} center={[lat, lng]} radius={Math.max(8, radius / 1000)} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.35 }}>
                      <Popup>
                        <strong>{row.district || row.city}</strong><br />
                        {row.total} available donor(s)
                        <br />{row.groups?.map((g) => `${g.bloodGroup}: ${g.count}`).join(' · ')}
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {rows.slice(0, 8).map((row) => (
                <div key={`${row.district}-card`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="flex items-center gap-1 font-black"><Flame className="h-4 w-4 text-red-400" />{row.district || row.city}</p>
                  <p className="text-2xl font-black text-red-400">{row.total}</p>
                  <p className="text-xs text-slate-500">{row.groups?.slice(0, 4).map((g) => `${g.bloodGroup}×${g.count}`).join(', ')}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
