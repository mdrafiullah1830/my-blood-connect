import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Droplets, MapPin, Clock, HeartHandshake, Siren } from 'lucide-react';
import api from '../lib/api';

// public share page — token diye kew (account chara) request dekhte parbe, WhatsApp/social e share.
export default function ShareRequest() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/requests/share/${token}`)
      .then(({ data }) => setRequest(data.request || data))
      .catch((err) => setError(err.response?.data?.message || 'This link is invalid or expired'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen bg-slate-950 p-10 text-center text-slate-500">Loading...</div>;
  if (error) return (
    <div className="min-h-screen bg-slate-950 p-10 text-center text-white">
      <Siren className="mx-auto mb-4 h-12 w-12 text-red-500" />
      <p className="text-xl font-black">{error}</p>
      <Link to="/" className="mt-4 inline-block rounded-xl bg-red-600 px-5 py-2 font-bold">Go to Blood Connect</Link>
    </div>
  );

  const r = request;
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-2xl pt-12">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Emergency Blood Request</p>
          <h1 className="text-4xl font-black">Share this request, save a life</h1>
        </div>

        <div className="rounded-3xl border border-red-500/30 bg-slate-900/80 p-6">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20 text-3xl font-black text-red-400">
              <Droplets className="h-8 w-8" />
            </div>
            <div>
              <p className="text-3xl font-black text-red-400">{r.bloodGroup}</p>
              <p className="text-slate-300">{r.units || r.quantity || 1} bag(s) needed{r.priority === 'emergency' ? ' · EMERGENCY' : ''}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Patient" value={r.patientName || r.name} />
            <Row label="Hospital" value={r.hospitalName || r.hospital} />
            <Row label="Location" value={r.city || r.location} icon={<MapPin className="h-4 w-4" />} />
            <Row label="Needed by" value={r.neededBy ? new Date(r.neededBy).toLocaleString() : r.contactPhone ? 'ASAP' : '—'} icon={<Clock className="h-4 w-4" />} />
            <Row label="Status" value={r.status} />
            {r.details && <Row label="Details" value={r.details} />}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" className="flex-1 rounded-xl bg-red-600 py-3 text-center font-black">
              <HeartHandshake className="mr-2 inline h-5 w-5" />I can donate
            </Link>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${r.bloodGroup} blood needed for ${r.patientName || 'a patient'} at ${r.hospitalName || r.hospital || r.city || ''} — please share: ${window.location.href}`)}`)} className="rounded-xl bg-emerald-600 px-5 py-3 font-black">Share on WhatsApp</button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">Shared via Blood Connect · Blood Connect এর মাধ্যমে শেয়ার করা হয়েছে</p>
      </div>
    </div>
  );
}

const Row = ({ label, value, icon }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className="flex items-center gap-1 font-bold text-right">{icon}{value || '—'}</dd>
  </div>
);
