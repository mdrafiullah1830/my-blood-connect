import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../lib/api';

// navbar er notification bell — unread badge + dropdown list, socket update e auto refresh.
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setUnread(data.unread || 0);
      setItems((data.notifications || []).slice(0, 8));
    } catch { /* not logged in or backend down */ }
  };

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('new-notification', refresh);
    const interval = setInterval(load, 60000);
    return () => { window.removeEventListener('new-notification', refresh); clearInterval(interval); };
  }, []);

  const markAll = async () => {
    setUnread(0);
    try { await api.patch('/api/notifications/read-all'); load(); } catch { /* ignore */ }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-xl p-2 hover:bg-slate-800" title="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black">Notifications</p>
            <button onClick={markAll} className="text-xs text-slate-400 hover:text-white">Mark all read</button>
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">No notifications yet.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.map((n) => (
                <Link key={n._id} to={n.link || '/notifications'} onClick={() => setOpen(false)} className={`block rounded-xl p-3 text-sm ${n.read ? 'opacity-60' : 'bg-slate-800/70'}`}>
                  <p className="font-bold">{n.title}</p>
                  <p className="text-slate-400">{n.message}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="mt-2 block rounded-xl bg-slate-800 py-2 text-center text-xs font-bold">Open notification center</Link>
        </div>
      )}
    </div>
  );
}
