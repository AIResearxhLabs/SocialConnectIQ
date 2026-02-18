import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, DocumentSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../api/firebase';
import { clearBrowserStorage } from '../utils/storageUtils';

interface UserProfile {
  username: string;
  email: string;
  gender: string;
  interestedDomains?: Record<string, string[]>;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const handleAuthError = (error: any) => {
      console.error('Auth state error:', error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`Retrying auth initialization (${retryCount}/${maxRetries})...`);
        setTimeout(() => {
          setLoading(true);
        }, 1000);
      } else {
        console.error('Max retries reached. Clearing storage and reloading...');
        clearBrowserStorage({
          clearLocalStorage: true,
          clearSessionStorage: true,
          preserveKeys: ['theme'],
        });
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
          setCurrentUser(user);
          if (user) {
            try {
              const userDocRef = doc(firestore, 'users', user.uid);
              const userDoc: DocumentSnapshot = await getDoc(userDocRef);
              if (userDoc.exists()) {
                setUserProfile(userDoc.data() as UserProfile);
              } else {
                console.warn('User document not found in Firestore');
                setUserProfile(null);
              }
            } catch (firestoreError) {
              console.error('Error fetching user profile:', firestoreError);
              // Continue with null profile rather than crashing
              setUserProfile(null);
            }
          } else {
            setUserProfile(null);
          }
          setLoading(false);
          retryCount = 0; // Reset retry count on success
        } catch (error) {
          handleAuthError(error);
        }
      },
      (error) => {
        // onAuthStateChanged error callback
        handleAuthError(error);
      }
    );

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
