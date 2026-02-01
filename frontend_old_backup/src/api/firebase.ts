import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdfCN2lblIpfF3x4MSDsGdOzKfm3cydFc",
  authDomain: "prjsyntheist.firebaseapp.com",
  projectId: "prjsyntheist",
  storageBucket: "prjsyntheist.appspot.com",
  messagingSenderId: "302066765820",
  appId: "1:302066765820:web:f69d34f419db424dd96c79"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
