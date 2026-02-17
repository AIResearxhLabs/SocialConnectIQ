import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { auth, firestore } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export const signUpWithEmail = async (
  email: string,
  password: string,
  username: string,
  gender: string
) => {
  const userCredential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const user = userCredential.user;
  await setDoc(doc(firestore, 'users', user.uid), {
    username,
    email,
    gender,
  });
};

export const signInWithEmail = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signInWithFacebook = () => {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  return signInWithPopup(auth, provider);
};

export const logout = () => {
  return signOut(auth);
};

export {};
