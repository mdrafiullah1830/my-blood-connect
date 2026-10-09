import { useEffect, useState } from 'react';
import { Trophy, Star, Medal } from 'lucide-react';
import api from '../lib/api';

// public leaderboard — top donor ranking donation count + rating diye.
export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/analytics/leaderboard?limit=25')
      .then(({ data }) => setLeaders(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rankStyle = (rank) => rank === 1 ? 'bg-yellow-500/20 border-yellow-500/50' : rank === 2 ? 'bg-slate-400/10 border-slate-400/40' : rank === 3 ? 'bg-orange-600/10 border-orange-600/40' : 'bg-slate-900/70 border-slate-800';

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl pt-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Hall of Fame</p>
          <h1 className="text-4xl font-black">Top Donors</h1>
          <p className="mt-2 text-slate-400">Ranked by total donation bags and community rating.</p>
        </div>

        {loading ? <p className="text-center text-slate-500">Loading...</p> : leaders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
            <Trophy className="mx-auto mb-3 h-10 w-10" />
            <p>No donations recorded yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((donor) => (
              <div key={donor.id} className={`flex items-center gap-4 rounded-2xl border p-5 ${rankStyle(donor.rank)}`}>
                <div className="w-10 text-center">
                  {donor.rank <= 3 ? <Medal className={`mx-auto h-7 w-7 ${donor.rank === 1 ? 'text-yellow-400' : donor.rank === 2 ? 'text-slate-300' : 'text-orange-400'}`} /> : <span className="font-black text-slate-500">#{donor.rank}</span>}
                </div>
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-red-600/20 font-black text-red-400">
                  {donor.avatar ? <img src={donor.avatar} alt="" className="h-full w-full object-cover" /> : donor.name?.[0]}
                </div>
                <div className="flex-1">
                  <p className="font-black">
                    {donor.name}
                    {donor.verified && <span className="ml-2 text-xs text-emerald-400">✔ verified</span>}
                  </p>
                  <p className="text-sm text-slate-400">{donor.bloodGroup} · {donor.city || 'Bangladesh'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-red-400">{donor.donationCount}</p>
                  <p className="text-xs text-slate-500">bags donated</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1 font-bold text-yellow-400"><Star className="h-4 w-4 fill-yellow-400" />{donor.rating || '—'}</p>
                  <p className="text-xs text-slate-500">rating</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
