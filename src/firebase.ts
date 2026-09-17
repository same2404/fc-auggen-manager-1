import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache, doc, getDocFromServer, setLogLevel, disableNetwork, enableNetwork } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal Firestore WebChannel retry and backoff logs to prevent console pollution
try {
  setLogLevel('silent');
} catch (e) {}

const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig as Record<string, any>).firestoreDatabaseId || '(default)';

let dbInstance: any;
try {
  // Use memoryLocalCache to prevent Firestore from falling back to WebStorage/localStorage for its persistent cache,
  // which causes QuotaExceededErrors and unhandled AsyncQueue crashes when there are too many offline mutations.
  // Our application already implements custom, light-weight offline replication in useCollectionSync and useSyncedState.
  dbInstance = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, firestoreDbId);
} catch (e) {
  console.warn("Failed to initialize Firestore with memory cache, falling back to default configuration", e);
  dbInstance = initializeFirestore(app, {}, firestoreDbId);
}

// If quota was already marked as exceeded within the last 24h, immediately disable Firestore network
// to avoid background WebChannel backoff loops and connection errors
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('fca_quota_exceeded_timestamp') || sessionStorage.getItem('fca_quota_exceeded_timestamp');
    if (stored) {
      const time = parseInt(stored, 10);
      if (!isNaN(time) && Date.now() - time < 24 * 60 * 60 * 1000) {
        (window as any).fca_firestore_quota_exceeded = true;
        disableNetwork(dbInstance).catch(() => {});
      }
    }
  } catch (e) {}
}

export const db = dbInstance;
export { disableNetwork, enableNetwork };
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Calculates the weekday for a given date string (YYYY-MM-DD).
 * Returns the weekday in German (e.g., "Sonntag, 12.07.2026").
 */
export function getWeekdayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayName = days[date.getDay()];
  const formattedDate = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  return `${dayName}, ${formattedDate}`;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  const errLower = errStr.toLowerCase();
  const isQuota =
    errLower.includes('quota') ||
    errLower.includes('resource_exhausted') ||
    errLower.includes('resource-exhausted') ||
    errLower.includes('free daily write units') ||
    errLower.includes('daily write units') ||
    errLower.includes('quota metric') ||
    (error && typeof (error as any).code === 'string' && (error as any).code.toLowerCase().includes('resource-exhausted')) ||
    (error as any)?.code === 8;

  const isPermissionError = errLower.includes('permission') || errLower.includes('denied');

  if (isQuota && typeof window !== 'undefined') {
    (window as any).fca_firestore_quota_exceeded = true;
    try {
      localStorage.setItem('fca_quota_exceeded_timestamp', String(Date.now()));
    } catch (e) {}
    try {
      disableNetwork(db).catch(() => {});
    } catch (e) {}
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }

  if (isQuota) {
    console.warn('Firestore Quota Error (Gracefully handled - Offline storage active): ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  // Dispatch event for UI
  window.dispatchEvent(new CustomEvent('fca_sync_error', { 
    detail: { 
      error: errStr,
      operationType,
      path
    } 
  }));

  if (isPermissionError) {
    throw new Error(JSON.stringify(errInfo));
  }
}

/**
 * Guard function to check if query parameter/value is valid.
 * Returns true if the parameter is not null and not undefined.
 */
export function isQueryParamValid(param: any): boolean {
  return param !== undefined && param !== null;
}

/**
 * Sanitizes data for Firestore by removing any undefined values recursively.
 * Ensures setDoc and updateDoc never throw "Unsupported field value: undefined".
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object') {
    if (
      obj.constructor &&
      (obj.constructor.name === 'Timestamp' ||
        obj.constructor.name === 'FieldValue' ||
        obj.constructor.name === 'Date' ||
        'toMillis' in (obj as any) ||
        'seconds' in (obj as any))
    ) {
      return obj;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Silent during normal cold starts or offline states
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection check pending network connection.");
    }
  }
}

// Defer connection check to avoid colliding with simultaneous collection listener setup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    void testConnection();
  }, 2500);
} else {
  void testConnection();
}

