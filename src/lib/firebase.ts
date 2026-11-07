import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjUtoo3c_aprSnxpR2gVUTmVFKq19NSoY",
  authDomain: "sovereign-remic-os.firebaseapp.com",
  databaseURL: "https://sovereign-remic-os-default-rtdb.firebaseio.com",
  projectId: "sovereign-remic-os",
  storageBucket: "sovereign-remic-os.firebasestorage.app",
  messagingSenderId: "749043885999",
  appId: "1:749043885999:web:d8a3838357e4211546315a",
  measurementId: "G-NGG1LMWYRE"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
