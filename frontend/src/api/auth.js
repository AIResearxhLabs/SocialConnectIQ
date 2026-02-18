import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    signOut,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LAST_PROVIDER_KEY = 'socialconnectiq_last_provider';

/**
 * Ensure user has a profile in Firestore (creates one if missing)
 * Call this after any successful authentication
 */
export const ensureUserProfile = async (user) => {
    if (!user || !user.uid) return null;

    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        // Profile exists, return it
        return { id: userDoc.id, ...userDoc.data() };
    }

    // Profile doesn't exist, create one
    const newProfile = {
        username: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        photoURL: user.photoURL || null,
        gender: 'not_specified',
        provider: user.providerData?.[0]?.providerId || 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await setDoc(userDocRef, newProfile);
    console.log('✅ Created new user profile for:', user.uid);

    return { id: user.uid, ...newProfile };
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email, password, username, gender) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
        username,
        email,
        gender,
        provider: 'password',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    return userCredential;
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Remember the provider for next time
    localStorage.setItem(LAST_PROVIDER_KEY, 'google');
    // Ensure profile exists
    await ensureUserProfile(result.user);
    return result;
};

/**
 * Sign in with Microsoft OAuth
 */
export const signInWithMicrosoft = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    const result = await signInWithPopup(auth, provider);
    // Remember the provider for next time
    localStorage.setItem(LAST_PROVIDER_KEY, 'microsoft');
    // Ensure profile exists
    await ensureUserProfile(result.user);
    return result;
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email) => {
    return sendPasswordResetEmail(auth, email);
};

/**
 * Get the last used provider (for auto sign-in)
 */
export const getLastProvider = () => {
    return localStorage.getItem(LAST_PROVIDER_KEY);
};

/**
 * Auto sign in with last used provider
 * Returns true if auto-login was triggered, false if no provider stored
 */
export const autoSignInWithLastProvider = async () => {
    const lastProvider = getLastProvider();

    if (lastProvider === 'google') {
        return signInWithGoogle();
    } else if (lastProvider === 'microsoft') {
        return signInWithMicrosoft();
    }

    // No provider stored - caller should show modal
    return null;
};

/**
 * Sign out the current user
 */
export const logout = () => {
    // Optionally clear the last provider on logout
    // localStorage.removeItem(LAST_PROVIDER_KEY);
    return signOut(auth);
};
