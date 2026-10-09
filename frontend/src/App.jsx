import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import { X, Bell } from 'lucide-react';

// ei app e main route setup kora hoy, ar realtime notification er jonno socket connection initialize kora hoy.
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SearchPage from './pages/SearchPage';
import EmergencyBoard from './pages/EmergencyBoard';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import Chat from './pages/Chat';
import Favorites from './pages/Favorites';
import Leaderboard from './pages/Leaderboard';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import BloodBanks from './pages/BloodBanks';
import Heatmap from './pages/Heatmap';
import Settings from './pages/Settings';
import ShareRequest from './pages/ShareRequest';
import { VerifyEmail, ResetPassword } from './pages/AuthExtra';
import { API_URL, getStoredUser, getToken } from './lib/api';
import { playEmergencyAlert } from './lib/sound';
import { startLocationWatcher } from './lib/locationWatcher';

// ei protected route diye login na thakle user-ke login page e pathano hoy.
// ei logic diye authenticated user chara sensitive page access thakbe na.
function ProtectedRoute({ children }) {
 const user = getStoredUser();
 if (!getToken() || !user) return <Navigate to="/login" replace />;
 return children;
}

// admin-only route — role check na hole dashboard e ferot.
function AdminRoute({ children }) {
 const user = getStoredUser();
 if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;
 return children;
}

export default function App(){
 const [alert,setAlert]=useState(null); const [show,setShow]=useState(false);
 // ei useEffect e logged-in user er jonno real-time socket connection set kora hoy.
 // request receive hole alert popup show kora hoy, jate user instantly update peye jay.
 useEffect(()=>{
  const token=getToken(); if(!token)return undefined;
  // background location watcher — live stream + geofence alert er jonno.
  const stopWatcher=startLocationWatcher();
  const onGeofence=(event)=>{const detail=event.detail||{};setAlert({message:detail.hospitalName?`You are within ${detail.distanceKm} km of a blood request at ${detail.hospitalName}.`:'A blood request is near you.'});setShow(true);playEmergencyAlert();};
  window.addEventListener('geofence-alert',onGeofence);
  const socket=io(API_URL,{auth:{token},transports:['websocket','polling']});
  const onRequest=(data)=>{setAlert(data);setShow(true);playEmergencyAlert();};
  const onNotification=()=>{window.dispatchEvent(new Event('new-notification'));};
  const onChat=(data)=>{window.dispatchEvent(new CustomEvent('bc_chat_message',{detail:data}));};
  socket.on('blood_request_received',onRequest);
  socket.on('request_response_updated',onRequest);
  socket.on('blood_request_cancelled',onRequest);
  socket.on('notification',onNotification);
  socket.on('chat_message',onChat);
  return ()=>{window.removeEventListener('geofence-alert',onGeofence);stopWatcher();socket.off('blood_request_received',onRequest);socket.off('request_response_updated',onRequest);socket.off('blood_request_cancelled',onRequest);socket.off('notification',onNotification);socket.off('chat_message',onChat);socket.disconnect();};
 },[]);
 return (
  <Router>
   <Navbar/>
   {show&&alert&&<div className="fixed top-20 right-4 z-50 w-[min(380px,calc(100%-2rem))] bg-slate-900 border border-red-500 rounded-2xl p-5 shadow-2xl"><button onClick={()=>setShow(false)} className="absolute top-3 right-3"><X className="w-4 h-4"/></button><Bell className="text-red-400 mb-2"/><p className="font-black">Blood Connect Update</p><p className="text-sm text-slate-300 mt-1">{alert.message||`Blood request ${alert.type||'updated'}.`}</p></div>}
   <Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/search" element={<ProtectedRoute><SearchPage/></ProtectedRoute>}/>
    <Route path="/requests" element={<ProtectedRoute><EmergencyBoard/></ProtectedRoute>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Register/>}/>
    <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/>
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
    <Route path="/notifications" element={<ProtectedRoute><Notifications/></ProtectedRoute>}/>
    <Route path="/chat" element={<ProtectedRoute><Chat/></ProtectedRoute>}/>
    <Route path="/chat/:id" element={<ProtectedRoute><Chat/></ProtectedRoute>}/>
    <Route path="/favorites" element={<ProtectedRoute><Favorites/></ProtectedRoute>}/>
    <Route path="/leaderboard" element={<Leaderboard/>}/>
    <Route path="/analytics" element={<ProtectedRoute><Analytics/></ProtectedRoute>}/>
    <Route path="/banks" element={<BloodBanks/>}/>
    <Route path="/heatmap" element={<ProtectedRoute><Heatmap/></ProtectedRoute>}/>
    <Route path="/settings" element={<ProtectedRoute><Settings/></ProtectedRoute>}/>
    <Route path="/admin" element={<AdminRoute><Admin/></AdminRoute>}/>
    <Route path="/share/:token" element={<ShareRequest/>}/>
    <Route path="/verify-email" element={<ProtectedRoute><VerifyEmail/></ProtectedRoute>}/>
    <Route path="/reset-password" element={<ResetPassword/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
   </Routes>
  </Router>
 );
}
