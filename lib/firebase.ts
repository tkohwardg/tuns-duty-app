import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { Platform } from "react-native";

// Firebase configuration - values come from environment/secrets
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
let auth: ReturnType<typeof getAuth>;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // For React Native, use getAuth (firebase v9+ handles persistence internally)
  auth = getAuth(app);
}

// Initialize Firestore
export const db = getFirestore(app);

// Auth functions
export const loginWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  return signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore collections
export const COLLECTIONS = {
  USERS: "users",
  DUTY_REQUESTS: "duty_requests",
} as const;

// Duty request types - dynamic, admin can add custom options via Settings
export type DutyType = string;
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DutyRequest {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string; // DD/M/YYYY format
  dutyType: DutyType;
  status: RequestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  staffNumber: string;
  role: "admin" | "user";
}

// Firestore operations
export const addDutyRequest = async (request: Omit<DutyRequest, "id" | "createdAt" | "updatedAt">) => {
  const now = Timestamp.now();
  return addDoc(collection(db, COLLECTIONS.DUTY_REQUESTS), {
    ...request,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateDutyRequestStatus = async (requestId: string, status: RequestStatus) => {
  const docRef = doc(db, COLLECTIONS.DUTY_REQUESTS, requestId);
  return updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now(),
  });
};

export const getUserDutyRequests = async (userId: string, status?: RequestStatus) => {
  let q;
  if (status) {
    q = query(
      collection(db, COLLECTIONS.DUTY_REQUESTS),
      where("userId", "==", userId),
      where("status", "==", status)
    );
  } else {
    q = query(
      collection(db, COLLECTIONS.DUTY_REQUESTS),
      where("userId", "==", userId)
    );
  }
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DutyRequest));
  // Sort client-side to avoid needing composite index
  return results.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeA - timeB;
  });
};

export const getAllPendingRequests = async () => {
  const q = query(
    collection(db, COLLECTIONS.DUTY_REQUESTS),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DutyRequest));
  // Sort client-side to avoid needing composite index
  return results.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeA - timeB;
  });
};

export const getAllApprovedRequests = async () => {
  const q = query(
    collection(db, COLLECTIONS.DUTY_REQUESTS),
    where("status", "==", "approved")
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DutyRequest));
  // Sort client-side to avoid needing composite index
  return results.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeA - timeB;
  });
};

/**
 * Check if a user already has a pending/approved request for the same date and duty type.
 * Returns true if duplicate exists.
 */
export const checkDuplicateRequest = async (
  userId: string,
  date: string,
  dutyType: DutyType
): Promise<boolean> => {
  const q = query(
    collection(db, COLLECTIONS.DUTY_REQUESTS),
    where("userId", "==", userId),
    where("date", "==", date),
    where("dutyType", "==", dutyType)
  );
  const snapshot = await getDocs(q);
  // Check if any non-cancelled/non-rejected request exists
  return snapshot.docs.some((doc) => {
    const data = doc.data();
    return data.status === "pending" || data.status === "approved";
  });
};

export { auth };
