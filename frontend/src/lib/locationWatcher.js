import api, { getStoredUser } from './api';

// background location watcher — donor er live position stream kore ar 2km geofence alert check kore.
// app e logged-in thakle App.jsx ekbar call kore; logout e stop() call hoy.

let watcherId = null;
let lastSentAt = 0;
let lastGeofenceAt = 0;

const STREAM_INTERVAL_MS = 45000;   // live location share hole 45s ontone ekbar push
const GEOFENCE_INTERVAL_MS = 120000; // geofence check 2 minute ontone

export const startLocationWatcher = () => {
  if (watcherId !== null || !navigator.geolocation) return () => {};
  watcherId = navigator.geolocation.watchPosition(
    (position) => handlePosition(position),
    () => { /* permission denied / unavailable — silently skip */ },
    { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 }
  );
  return stopLocationWatcher;
};

export const stopLocationWatcher = () => {
  if (watcherId !== null) {
    navigator.geolocation.clearWatch(watcherId);
    watcherId = null;
  }
};

const handlePosition = async (position) => {
  const user = getStoredUser();
  if (!user) return;
  const { latitude, longitude, accuracy } = position.coords;
  const now = Date.now();

  // live location streaming — Settings e ON thakle sob somoy.
  if (user.shareLiveLocation && now - lastSentAt > STREAM_INTERVAL_MS) {
    lastSentAt = now;
    api.post('/api/map/stream-location', { latitude, longitude, accuracy }).catch(() => {});
  }

  // geofence — donor available + eligible holei check hoy.
  if (user.isAvailable && now - lastGeofenceAt > GEOFENCE_INTERVAL_MS) {
    lastGeofenceAt = now;
    try {
      const { data } = await api.post('/api/map/geofence/check', { latitude, longitude });
      (data.alerts || []).forEach((alert) => {
        window.dispatchEvent(new CustomEvent('geofence-alert', { detail: alert }));
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🩸 Blood request near you', {
            body: `${alert.hospitalName} — only ${alert.distanceKm} km away.`,
            icon: '/icon-192.svg'
          }).onclick = () => window.focus();
        }
      });
    } catch { /* backend offline — next interval e try hobe */ }
  }
};
