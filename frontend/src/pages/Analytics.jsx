import { useEffect, useState } from 'react';
import { TrendingUp, Heart, Users, Activity, Droplets, Building2 } from 'lucide-react';
import api from '../lib/api';

// analytics dashboard — real backend metrics + area/blood group distribution chart (CSS bars).
export default function Analytics() {
  const [metrics, setMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/analytics/impact'),
      api.get('/api/analytics/dashboard')
    ]).then(([impact, dash]) => {
      setMetrics(impact.data.metrics);
      setAnalytics(dash.data.analytics);
    }).catch((err) => setError(err.response?.data?.message || 'Unable to load analytics'));
  }, []);

  if (error) return <div className="min-h-screen bg-slate-950 p-10 text-center text-red-400">{error}</div>;

  const maxArea = Math.max(1, ...(analytics?.byArea || []).map((a) => a.requests));
  const maxGroup = Math.max(1, ...(analytics?.byBloodGroup || []).map((a) => a.requests));

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl pt-10">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Platform Analytics</p>
          <h1 className="text-4xl font-black">Impact & Analytics</h1>
          <p className="mt-2 text-slate-400">Live community metrics calculated from real donations and requests.</p>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={<Droplets />} label="Total donations (bags)" value={metrics?.totalDonations ?? '—'} tone="text-red-400" />
          <Stat icon={<Heart />} label="Lives saved (est.)" value={metrics?.livesSaved ?? '—'} tone="text-emerald-400" />
          <Stat icon={<Users />} label="Registered donors" value={metrics?.registeredDonors ?? '—'} tone="text-cyan-400" />
          <Stat icon={<Activity />} label="Available donors now" value={metrics?.availableDonors ?? '—'} tone="text-emerald-400" />
          <Stat icon={<TrendingUp />} label="Fulfilled requests" value={metrics?.fulfilledRequests ?? '—'} tone="text-yellow-400" />
          <Stat icon={<Building2 />} label="Active requests" value={metrics?.activeRequests ?? '—'} tone="text-red-400" />
        </div>

        {!analytics ? <p className="text-slate-500">Loading charts...</p> : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Requests by blood group (90 days)">
              {analytics.byBloodGroup.length === 0 ? <Empty /> : analytics.byBloodGroup.map((row) => (
                <Bar key={row._id} label={row._id} value={row.requests} max={maxGroup} sub={`${row.fulfilled} fulfilled`} color="bg-red-500" />
              ))}
            </Card>
            <Card title="Area-wise demand (top districts)">
              {analytics.byArea.length === 0 ? <Empty /> : analytics.byArea.map((row) => (
                <Bar key={row._id} label={row._id || 'Unknown'} value={row.requests} max={maxArea} sub={`${row.fulfilled} fulfilled`} color="bg-cyan-500" />
              ))}
            </Card>
            <Card title="Monthly donations">
              {analytics.monthly.length === 0 ? <Empty /> : analytics.monthly.map((row) => (
                <Bar key={row._id} label={row._id} value={row.bags} max={Math.max(1, ...analytics.monthly.map((m) => m.bags))} sub={`${row.donations} records`} color="bg-emerald-500" />
              ))}
            </Card>
            <Card title="Top hospitals by fulfilled requests">
              {analytics.topHospitals.length === 0 ? <Empty /> : analytics.topHospitals.map((row) => (
                <Bar key={row._id} label={row._id} value={row.fulfilled} max={Math.max(1, ...analytics.topHospitals.map((h) => h.fulfilled))} color="bg-yellow-500" />
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

const Stat = ({ icon, label, value, tone }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
    <div className={`mb-2 ${tone}`}>{icon}</div>
    <p className="text-xs uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-3xl font-black">{value}</p>
  </div>
);

const Card = ({ title, children }) => (
  <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
    <h2 className="mb-4 font-black">{title}</h2>
    <div className="space-y-3">{children}</div>
  </div>
);

const Bar = ({ label, value, max, sub, color }) => (
  <div>
    <div className="mb-1 flex justify-between text-sm">
      <span className="text-slate-300">{label}</span>
      <span className="font-bold">{value}{sub ? ` · ${sub}` : ''}</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
    </div>
  </div>
);

const Empty = () => <p className="py-6 text-center text-sm text-slate-600">No data yet for this period.</p>;
