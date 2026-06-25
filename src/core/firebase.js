/**
 * Firebase Configuration & Initialization
 * Auth + FCM (Cloud Messaging)
 *
 * 🔧 SETUP: Remplace les valeurs ci-dessous par celles de ta console Firebase:
 * https://console.firebase.google.com → ton projet → ⚙️ Paramètres → Général → Tes applications
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFirestore } from 'firebase/firestore';

// ─── Colle ici ta config Firebase ────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyB7duvaTQdMGfKmmC06dcRBWEDI8QuweVY",
  authDomain:        "nexus-chat-a205e.firebaseapp.com",
  projectId:         "nexus-chat-a205e",
  storageBucket:     "nexus-chat-a205e.firebasestorage.app",
  messagingSenderId: "538841638768",
  appId:             "1:538841638768:web:f86fe10ff56453fe67d1b5",
  measurementId:     "G-8S1C2DN4NE"
};
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Connexion Google (popup)
 */
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

/**
 * Déconnexion
 */
export const logout = () => signOut(auth);

// ─── FCM (Cloud Messaging / Notifications Push) ───────────────────────────────
// ⚠️  Le messaging n'est disponible que dans un contexte browser (pas SSR)
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn('[FCM] Messaging not supported in this environment:', e.message);
}

/**
 * Demander la permission de notifications et obtenir le FCM token.
 * @param {string} vapidKey - Ta clé VAPID publique (Firebase Console → Cloud Messaging → Web Push)
 * @returns {Promise<string|null>} FCM token ou null si refusé/non supporté
 */
export const requestNotificationPermission = async (vapidKey) => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    console.log('[FCM] Token:', token);
    return token;
  } catch (err) {
    console.error('[FCM] Error getting token:', err);
    return null;
  }
};

/**
 * Écouter les messages FCM reçus quand l'app est en foreground.
 * @param {function} callback - Appelé avec le message reçu
 * @returns {function} Unsubscribe function
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

export { messaging };
