// ei file te Bangla/English translation dictionary ar language context manage hoy.
// Navbar, pages, buttons — sob jaigai t() function diye text dekhano hoy.
import { useEffect, useState } from 'react';

export const translations = {
  en: {
    home: 'Home',
    search: 'Search',
    requests: 'Requests',
    dashboard: 'Dashboard',
    profile: 'Profile',
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    notifications: 'Notifications',
    chat: 'Chat',
    favorites: 'Favorites',
    leaderboard: 'Leaderboard',
    analytics: 'Analytics',
    admin: 'Admin',
    settings: 'Settings',
    banks: 'Blood Banks',
    donorMode: 'Donor Mode',
    recipientMode: 'Recipient Mode',
    available: 'Available',
    unavailable: 'Unavailable',
    emergencyBoard: 'Emergency Board',
    findDonors: 'Find Nearby Eligible Donors',
    searchWithGps: 'Search with Live GPS',
    searchWithoutGps: 'Search without GPS',
    bloodGroup: 'Blood Group',
    division: 'Division',
    district: 'District',
    thana: 'Thana / Upazila',
    city: 'City / Area',
    postEmergency: 'Post Emergency Need',
    accept: 'Accept',
    reject: 'Reject',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    loading: 'Loading...',
    language: 'Language',
    soundAlerts: 'Emergency sound alerts',
    pushNotifications: 'Push notifications',
    videoCall: 'Video Call',
    send: 'Send',
    message: 'Message',
    radius: 'Search radius (km)',
    sortBy: 'Sort by',
    compatibleOnly: 'Compatible donors only',
    verifiedOnly: 'Verified donors only',
    saveDonor: 'Save donor',
    saved: 'Saved',
    reviews: 'Reviews',
    donationHistory: 'Donation History',
    impactMetrics: 'Impact',
    topDonors: 'Top Donors',
    livesSaved: 'Lives Saved',
    totalDonations: 'Total Donations',
    activeRequests: 'Active Requests',
    registeredDonors: 'Registered Donors',
    tagline: 'Find donors. Share hope. Save lives.'
  },
  bn: {
    home: 'হোম',
    search: 'খুঁজুন',
    requests: 'রিকোয়েস্ট',
    dashboard: 'ড্যাশবোর্ড',
    profile: 'প্রোফাইল',
    login: 'লগইন',
    logout: 'লগআউট',
    register: 'নিবন্ধন',
    notifications: 'নোটিফিকেশন',
    chat: 'চ্যাট',
    favorites: 'পছন্দের',
    leaderboard: 'লিডারবোর্ড',
    analytics: 'অ্যানালিটিক্স',
    admin: 'অ্যাডমিন',
    settings: 'সেটিংস',
    banks: 'ব্লাড ব্যাংক',
    donorMode: 'দাতা মোড',
    recipientMode: 'গ্রহীতা মোড',
    available: 'উপলব্ধ',
    unavailable: 'অনুপলব্ধ',
    emergencyBoard: 'জরুরি বোর্ড',
    findDonors: 'কাছাকাছি যোগ্য দাতা খুঁজুন',
    searchWithGps: 'লাইভ GPS দিয়ে খুঁজুন',
    searchWithoutGps: 'GPS ছাড়া খুঁজুন',
    bloodGroup: 'রক্তের গ্রুপ',
    division: 'বিভাগ',
    district: 'জেলা',
    thana: 'থানা / উপজেলা',
    city: 'শহর / এলাকা',
    postEmergency: 'জরুরি চাহিদা দিন',
    accept: 'গ্রহণ করুন',
    reject: 'প্রত্যাখ্যান',
    cancel: 'বাতিল',
    edit: 'সম্পাদনা',
    delete: 'মুছুন',
    save: 'সংরক্ষণ',
    loading: 'লোড হচ্ছে...',
    language: 'ভাষা',
    soundAlerts: 'জরুরি শব্দ সতর্কতা',
    pushNotifications: 'পুশ নোটিফিকেশন',
    videoCall: 'ভিডিও কল',
    send: 'পাঠান',
    message: 'বার্তা',
    radius: 'অনুসন্ধান ব্যাসার্ধ (কিমি)',
    sortBy: 'সাজান',
    compatibleOnly: 'শুধু সামঞ্জস্যপূর্ণ দাতা',
    verifiedOnly: 'শুধু যাচাইকৃত',
    saveDonor: 'দাতা সংরক্ষণ',
    saved: 'সংরক্ষিত',
    reviews: 'রিভিউ',
    donationHistory: 'রক্তদানের ইতিহাস',
    impactMetrics: 'প্রভাব',
    topDonors: 'শীর্ষ দাতা',
    livesSaved: 'বাঁচানো জীবন',
    totalDonations: 'মোট রক্তদান',
    activeRequests: 'সক্রিয় রিকোয়েস্ট',
    registeredDonors: 'নিবন্ধিত দাতা',
    tagline: 'দাতা খুঁজুন। আশা শেয়ার করুন। জীবন বাঁচান।'
  }
};

const LANG_KEY = 'bc_language';

export const getLang = () => (localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en');
export const setLang = (lang) => {
  localStorage.setItem(LANG_KEY, lang === 'bn' ? 'bn' : 'en');
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  window.dispatchEvent(new Event('lang-changed'));
};

export const t = (key, lang = getLang()) => translations[lang]?.[key] || translations.en[key] || key;

// language change hole t() byapar bohul component re-render kore — ei hook diye subscribe kora hoy.
export const useLangTick = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const handler = () => setTick((value) => value + 1);
        window.addEventListener('lang-changed', handler);
        return () => window.removeEventListener('lang-changed', handler);
    }, []);
};
