import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Heart, Search, ClipboardList, LogOut, UserRound, LayoutDashboard, HandHeart, MessageCircle, HeartHandshake, Trophy, Building2, Settings, ShieldCheck, Menu, Languages, Bell, Flame } from 'lucide-react';
import { clearSession, getActiveMode, getStoredUser, setActiveMode } from '../lib/api';
import { getLang, setLang } from '../lib/i18n';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser);
  const [mode, setMode] = useState(getActiveMode);
  const [lang, setLangState] = useState(getLang);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    const syncMode = () => setMode(getActiveMode());
    window.addEventListener('session-changed', syncUser);
    window.addEventListener('storage', syncUser);
    window.addEventListener('mode-changed', syncMode);
    return () => {
      window.removeEventListener('session-changed', syncUser);
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('mode-changed', syncMode);
    };
  }, []);

  const logout = () => { clearSession(); navigate('/login'); };
  const switchMode = (nextMode) => { setActiveMode(nextMode); setMode(nextMode); navigate('/dashboard'); };
  const toggleLang = () => { const next = lang === 'bn' ? 'en' : 'bn'; setLang(next); setLangState(next); };
  const navClass = ({ isActive }) => `rounded-xl px-3 py-2 transition-colors ${isActive ? 'bg-red-600 text-white shadow-lg shadow-red-950/40' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`;

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-3 justify-between items-center">
        <Link to="/" className="flex items-center gap-2"><Heart className="text-red-500 fill-red-500"/><span className="font-black tracking-wider">BLOOD CONNECT</span></Link>
        <button onClick={() => setMenuOpen((v) => !v)} className="md:hidden rounded-xl border border-slate-700 p-2"><Menu className="w-5 h-5"/></button>
        <div className={`${menuOpen ? 'flex' : 'hidden'} md:flex w-full md:w-auto flex-wrap items-center gap-2 text-sm`}>
          {user && <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1"><button onClick={()=>switchMode('recipient')} className={`rounded-lg px-3 py-1.5 font-bold ${mode==='recipient'?'bg-red-600 text-white':'text-slate-400'}`}>Recipient</button><button onClick={()=>switchMode('donor')} className={`rounded-lg px-3 py-1.5 font-bold ${mode==='donor'?'bg-emerald-600 text-white':'text-slate-400'}`}><HandHeart className="mr-1 inline w-4 h-4"/>Donor</button></div>}
          {mode==='recipient'&&<NavLink to="/search" className={navClass}><Search className="inline w-4 h-4 mr-1"/>Search</NavLink>}
          <NavLink to="/requests" className={navClass}><ClipboardList className="inline w-4 h-4 mr-1"/>Requests</NavLink>
          <NavLink to="/heatmap" className={navClass}><Flame className="inline w-4 h-4 mr-1"/>Map</NavLink>
          <NavLink to="/banks" className={navClass}><Building2 className="inline w-4 h-4 mr-1"/>Banks</NavLink>
          <NavLink to="/leaderboard" className={navClass}><Trophy className="inline w-4 h-4 mr-1"/>Top</NavLink>
          {user && <>
            <NavLink to="/chat" className={navClass}><MessageCircle className="inline w-4 h-4 mr-1"/>Chat</NavLink>
            <NavLink to="/favorites" className={navClass}><HeartHandshake className="inline w-4 h-4 mr-1"/>Saved</NavLink>
            <NavLink to="/dashboard" className={navClass}><LayoutDashboard className="inline w-4 h-4 mr-1"/>Dashboard</NavLink>
            <NavLink to="/profile" className={navClass}><UserRound className="inline w-4 h-4 mr-1"/>Profile</NavLink>
          </>}
          <button onClick={toggleLang} title="Switch language" className="rounded-xl px-2.5 py-2 hover:bg-slate-800"><Languages className="w-4 h-4 inline mr-1"/>{lang === 'bn' ? 'বাং' : 'EN'}</button>
          {user ? <>
            <NotificationBell/>
            <NavLink to="/settings" className={navClass}><Settings className="inline w-4 h-4 mr-1"/><span className="hidden xl:inline">Settings</span></NavLink>
            {user.role === 'admin' && <NavLink to="/admin" className={navClass}><ShieldCheck className="inline w-4 h-4 mr-1"/><span className="hidden xl:inline">Admin</span></NavLink>}
            <button onClick={logout} className="bg-red-600 px-4 py-2 rounded-xl font-bold"><LogOut className="inline w-4 h-4 mr-1"/>Logout</button>
          </> : <NavLink to="/login" className={navClass}><Bell className="inline w-4 h-4 mr-1"/>Login</NavLink>}
        </div>
      </div>
    </nav>
  );
}
