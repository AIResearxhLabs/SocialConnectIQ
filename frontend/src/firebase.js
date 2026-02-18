import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Sir's Firebase project (prjsyntheist) - rules already updated
const firebaseConfig = {
  apiKey: "AIzaSyBdfCN2lblIpfF3x4MSDsGdOzKfm3cydFc",
  authDomain: "prjsyntheist.firebaseapp.com",
  projectId: "prjsyntheist",
  storageBucket: "prjsyntheist.appspot.com",
  messagingSenderId: "302066765820",
  appId: "1:302066765820:web:f69d34f419db424dd96c79"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
