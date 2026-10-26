/* علمی مشغولیت — Firebase Cloud Messaging سروس ورکر
   پس منظر (background) اطلاعات کے لیے۔ کنفگ وہی عوامی شناختی معلومات ہے جو ایپ میں ہے —
   اصل حفاظت Firestore قوانین سے آتی ہے۔ یہ فائل ایپ کی جڑ (index.html کے ساتھ) میں رہنا ضروری ہے۔ */
/* compat اسکرپٹس مقامی vendor فولڈر سے لوڈ ہوتی ہیں تاکہ سروس ورکر CDN تک رسائی کے بغیر بھی قابلِ اعتماد رہے */
importScripts('assets/vendor/firebase-app-compat.js');
importScripts('assets/vendor/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCLXn_IO5234t91K-DO__VjFyL535XbMdE",
  authDomain: "ilmi-mashghuliyat.firebaseapp.com",
  projectId: "ilmi-mashghuliyat",
  storageBucket: "ilmi-mashghuliyat.firebasestorage.app",
  messagingSenderId: "7165216488",
  appId: "1:7165216488:web:b71626709911dd1c2eeb5d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  const n = (payload && payload.notification) || {};
  const d = (payload && payload.data) || {};
  const title = n.title || d.title || 'علمی مشغولیت — نئی اطلاع';
  const options = {
    body: n.body || d.body || '',
    icon: 'assets/logo.png',
    dir: 'rtl',
    lang: 'ur'
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (const c of list){ if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
