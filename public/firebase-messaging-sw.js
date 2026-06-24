/**
 * Firebase Cloud Messaging Service Worker
 * Ce fichier DOIT s'appeler exactement "firebase-messaging-sw.js"
 * et être placé à la racine du site (dossier public/).
 *
 * Il gère les notifications push reçues quand l'app est en BACKGROUND (fermée/minimisée).
 *
 * 🔧 SETUP: Remplace les valeurs par celles de ta console Firebase
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyB7duvaTQdMGfKmmC06dcRBWEDI8QuweVY",
  authDomain:        "nexus-chat-a205e.firebaseapp.com",
  projectId:         "nexus-chat-a205e",
  storageBucket:     "nexus-chat-a205e.firebasestorage.app",
  messagingSenderId: "538841638768",
  appId:             "1:538841638768:web:f86fe10ff56453fe67d1b5",
});

const messaging = firebase.messaging();

// Gère les messages reçus en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message reçu en background:', payload);

  const { title, body, icon } = payload.notification ?? {};

  self.registration.showNotification(title || 'Nexus Chat', {
    body:  body  || 'Nouveau message',
    icon:  icon  || '/logo192.png',
    badge: '/logo192.png',
    data:  payload.data,
  });
});
