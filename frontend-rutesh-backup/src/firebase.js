import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDfdJfZlEq7dqnsuRjB11ccQoxThXcCqgU",
  authDomain: "connectiq-37c4b.firebaseapp.com",
  projectId: "connectiq-37c4b",
  storageBucket: "connectiq-37c4b.firebasestorage.app",
  messagingSenderId: "731838239681",
  appId: "1:731838239681:web:715fed87612008db021540",
  measurementId: "G-W6CWH1ESX2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
