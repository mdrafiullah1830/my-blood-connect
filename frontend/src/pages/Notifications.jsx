import { useEffect, useState } from 'react';
import { CheckCheck, Trash2, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

// notification center — shob in-app notification ek jaygay, unread count shoho.
export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch { /* keep old list */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    try { await api.patch(`/api/notifications/${id}/read`); } catch { /* optimistic */ }
  };

  const markAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.patch('/api/notifications/read-all'); } catch { /* optimistic */ }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all notifications?')) return;
    setNotifications([]);
    setUnread(0);
    try { await api.delete('/api/notifications'); } catch { /* optimistic */ }
  };

  const iconFor = (type) => {
    if (type === 'reminder') return '⏰';
    if (type === 'chat') return '💬';
    if (type === 'geofence') return '📍';
    if (type === 'escalation') return '🚨';
    if (type === 'verification') return '✅';
    if (type === 'request') return '🩸';
    return '🔔';
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl pt-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-400">Notification Center</p>
            <h1 className="text-4xl font-black">Notifications</h1>
            {unread > 0 && <p className="mt-1 text-sm text-slate-400">{unread} unread</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={markAll} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold" title="Mark all read">
              <CheckCheck className="mr-1 inline h-4 w-4" />Read all
            </button>
            <button onClick={clearAll} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-bold text-red-300" title="Clear all">
              <Trash2 className="mr-1 inline h-4 w-4" />Clear
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
            <Inbox className="mx-auto mb-3 h-10 w-10" />
            <p>No notifications yet.</p>
            <Link to="/requests" className="mt-3 inline-block rounded-xl bg-red-600 px-5 py-2 font-bold">Browse requests</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => markRead(n._id)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  n.read ? 'border-slate-800 bg-slate-900/50 opacity-70' : 'border-red-500/30 bg-slate-900'
                }`}
              >
                <span className="text-xl">{iconFor(n.type)}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-black">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-red-500" />}
                  </span>
                  <span className="block text-sm text-slate-400">{n.message}</span>
                  <span className="mt-1 block text-xs text-slate-600">{new Date(n.createdAt).toLocaleString()}</span>
                </span>
                {n.link && <Link to={n.link} onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-red-400">Open</Link>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
