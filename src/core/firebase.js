import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyB7duvaTQdMGfKmmC06dcRBWEDI8QuweVY",
  authDomain:        "nexus-chat-a205e.firebaseapp.com",
  projectId:         "nexus-chat-a205e",
  storageBucket:     "nexus-chat-a205e.firebasestorage.app",
  messagingSenderId: "538841638768",
  appId:             "1:538841638768:web:f86fe10ff56453fe67d1b5",
  measurementId:     "G-8S1C2DN4NE"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

enableIndexedDbPersistence(firestore).catch((err) => {
  console.warn("Firestore offline persistence could not be enabled:", err.code);
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export const requestNotificationPermission = async () => null;
export const onForegroundMessage = () => () => {};
export const messaging = null;
