import { useEffect, useState } from 'react';
import { Heart, MapPin, Navigation, Trash2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

// saved donor list — favorite theke sohoje donor dekhe direct request pathay.
export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/api/favorites')
    .then(({ data }) => setFavorites(data.favorites || []))
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const remove = async (donorId) => {
    setFavorites((prev) => prev.filter((f) => f._id !== donorId));
    try { await api.delete(`/api/favorites/${donorId}`); } catch { load(); }
  };

  const directionsUrl = (donor) => {
    const coords = donor.location?.coordinates;
    if (!coords) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl pt-10">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Saved Donors</p>
          <h1 className="text-4xl font-black">My Favorites</h1>
          <p className="mt-2 text-slate-400">Donors you saved for quick access during emergencies.</p>
        </div>

        {loading ? <p className="text-slate-500">Loading...</p> : favorites.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
            <Heart className="mx-auto mb-3 h-10 w-10" />
            <p>No saved donors yet.</p>
            <Link to="/search" className="mt-3 inline-block rounded-xl bg-red-600 px-5 py-2 font-bold">Find donors</Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((donor) => (
              <div key={donor._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-red-600/20 font-black text-red-400">
                      {donor.avatar ? <img src={donor.avatar} alt="" className="h-full w-full object-cover" /> : donor.name?.[0]}
                    </div>
                    <div>
                      <p className="text-lg font-black">{donor.name}</p>
                      <p className="font-black text-red-400">{donor.bloodGroup}</p>
                    </div>
                  </div>
                  <button onClick={() => remove(donor._id)} className="rounded-lg p-2 text-slate-500 hover:text-red-400" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-400">
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{[donor.city, donor.thana, donor.district].filter(Boolean).join(', ') || 'Address not set'}</p>
                  <p className="flex items-center gap-2"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{donor.rating || 'No rating'} ({donor.ratingCount || 0})</p>
                  <p className={`font-bold ${donor.eligible ? 'text-emerald-400' : 'text-amber-400'}`}>{donor.eligible ? 'Eligible now' : 'Cooling period'}</p>
                  {donor.verified && <p className="text-xs text-emerald-400">✔ Verified donor</p>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to="/search" className="flex-1 rounded-xl bg-red-600 py-2.5 text-center text-sm font-black">Request</Link>
                  {directionsUrl(donor) && (
                    <a href={directionsUrl(donor)} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-800 px-3 py-2.5" title="Route to donor">
                      <Navigation className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
