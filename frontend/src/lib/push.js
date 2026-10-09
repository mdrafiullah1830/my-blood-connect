import api from './api';

// PWA push subscription backend e save kore — service worker push permission neiye.
export const enablePushNotifications = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, message: 'Push notifications are not supported in this browser' };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, message: 'Notification permission denied' };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const p256dh = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!p256dh) return { ok: false, message: 'Push is not configured (set VITE_VAPID_PUBLIC_KEY)' };
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(p256dh)
      });
    }
    const json = subscription.toJSON();
    await api.post('/api/notifications/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' }
    });
    return { ok: true, message: 'Push notifications enabled' };
  } catch (error) {
    return { ok: false, message: error.message || 'Unable to enable push notifications' };
  }
};

export const disablePushNotifications = async () => {
  try {
    const registration = await navigator.serviceWorker?.ready;
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      await api.post('/api/notifications/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    return { ok: true, message: 'Push notifications disabled' };
  } catch {
    return { ok: false, message: 'Unable to disable push notifications' };
  }
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};
