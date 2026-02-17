/**
 * Browser Storage Utility
 * 
 * Provides safe storage operations with error handling and automatic cleanup
 * for corrupted session data that can prevent app from launching.
 */

interface StorageCleanupOptions {
  clearLocalStorage?: boolean;
  clearSessionStorage?: boolean;
  clearIndexedDB?: boolean;
  preserveKeys?: string[];
}

/**
 * Safely clear browser storage to prevent app launch failures
 */
export const clearBrowserStorage = (options: StorageCleanupOptions = {}): void => {
  const {
    clearLocalStorage = true,
    clearSessionStorage = true,
    clearIndexedDB = false,
    preserveKeys = [],
  } = options;

  try {
    console.log('🧹 Clearing browser storage...');

    // Clear Local Storage (except preserved keys)
    if (clearLocalStorage) {
      const preservedData: Record<string, string> = {};
      
      // Save preserved keys
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          preservedData[key] = value;
        }
      });

      // Clear all
      localStorage.clear();
      
      // Restore preserved keys
      Object.entries(preservedData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      console.log('✅ Local Storage cleared');
    }

    // Clear Session Storage
    if (clearSessionStorage) {
      sessionStorage.clear();
      console.log('✅ Session Storage cleared');
    }

    // Clear IndexedDB
    if (clearIndexedDB && window.indexedDB) {
      window.indexedDB.databases?.()
        .then(databases => {
          databases.forEach(db => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
          console.log('✅ IndexedDB cleared');
        })
        .catch(err => console.warn('⚠️ Could not clear IndexedDB:', err));
    }

    console.log('✅ Browser storage cleanup complete');
  } catch (error) {
    console.error('❌ Error clearing browser storage:', error);
  }
};

/**
 * Validate and clean corrupted storage data
 */
export const validateStorageData = (): boolean => {
  try {
    // Test if localStorage is accessible and working
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);

    // Check for corrupted Firebase auth state
    const firebaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('firebase:') || key.includes('authUser')
    );

    let hasCorruption = false;

    firebaseKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          JSON.parse(value); // Try to parse - will throw if corrupted
        }
      } catch (error) {
        console.warn(`⚠️ Corrupted storage key detected: ${key}`);
        localStorage.removeItem(key);
        hasCorruption = true;
      }
    });

    if (hasCorruption) {
      console.log('🔧 Corrupted storage data has been cleaned');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Storage validation failed:', error);
    // If we can't even access storage, clear everything
    clearBrowserStorage();
    return false;
  }
};

/**
 * Initialize storage with cleanup on app startup
 */
export const initializeStorage = (): void => {
  console.log('🚀 Initializing storage...');

  try {
    // Validate existing storage
    const isValid = validateStorageData();

    if (!isValid) {
      console.warn('⚠️ Storage validation failed - performing cleanup');
    }

    // Check for error flags that indicate previous crash
    const hadPreviousCrash = sessionStorage.getItem('__app_crashed__');
    if (hadPreviousCrash) {
      console.warn('⚠️ Previous session crash detected - clearing storage');
      clearBrowserStorage({
        clearLocalStorage: true,
        clearSessionStorage: true,
        preserveKeys: ['theme', 'language'], // Preserve user preferences
      });
    }

    // Set flag to detect crashes
    sessionStorage.setItem('__app_crashed__', 'true');

    // Clear crash flag on successful load
    window.addEventListener('load', () => {
      sessionStorage.removeItem('__app_crashed__');
    });

    console.log('✅ Storage initialization complete');
  } catch (error) {
    console.error('❌ Storage initialization failed:', error);
    // Last resort - clear everything
    clearBrowserStorage();
  }
};

/**
 * Safe storage getter with error handling
 */
export const safeGetItem = (key: string, storage: Storage = localStorage): string | null => {
  try {
    const value = storage.getItem(key);
    if (value) {
      // Try to parse to detect corruption
      JSON.parse(value);
    }
    return value;
  } catch (error) {
    console.warn(`⚠️ Corrupted storage key: ${key}, removing...`);
    storage.removeItem(key);
    return null;
  }
};

/**
 * Safe storage setter with error handling
 */
export const safeSetItem = (
  key: string, 
  value: string, 
  storage: Storage = localStorage
): boolean => {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set storage key: ${key}`, error);
    return false;
  }
};

/**
 * Get storage usage information
 */
export const getStorageInfo = (): {
  localStorageSize: number;
  sessionStorageSize: number;
  localStorageKeys: number;
  sessionStorageKeys: number;
} => {
  try {
    const getSize = (storage: Storage): number => {
      let size = 0;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          const value = storage.getItem(key);
          if (value) {
            size += key.length + value.length;
          }
        }
      }
      return size;
    };

    return {
      localStorageSize: getSize(localStorage),
      sessionStorageSize: getSize(sessionStorage),
      localStorageKeys: localStorage.length,
      sessionStorageKeys: sessionStorage.length,
    };
  } catch (error) {
    console.error('❌ Failed to get storage info:', error);
    return {
      localStorageSize: 0,
      sessionStorageSize: 0,
      localStorageKeys: 0,
      sessionStorageKeys: 0,
    };
  }
};

/**
 * Export storage data for debugging
 */
export const exportStorageData = (): string => {
  try {
    const data = {
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
      timestamp: new Date().toISOString(),
      storageInfo: getStorageInfo(),
    };
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('❌ Failed to export storage data:', error);
    return JSON.stringify({ error: 'Failed to export storage data' });
  }
};
