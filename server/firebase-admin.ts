/**
 * Firebase Admin SDK initialization for server-side operations.
 * Uses firebase-admin v12 modular API.
 *
 * Required environment variables (server-side only, NOT EXPO_PUBLIC_):
 *   FIREBASE_PROJECT_ID     — same as EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL   — from Firebase Service Account JSON
 *   FIREBASE_PRIVATE_KEY    — from Firebase Service Account JSON (include \n line breaks)
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  // Reuse existing app if already initialized (hot reload safety)
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Handle both \n escaped and spaces-stripped formats from env storage
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  // Restore spaces if stripped: BEGINPRIVATEKEY -> BEGIN PRIVATE KEY
  if (privateKey && !privateKey.includes("BEGIN PRIVATE KEY")) {
    privateKey = privateKey
      .replace("-----BEGINPRIVATEKEY-----", "-----BEGIN PRIVATE KEY-----")
      .replace("-----ENDPRIVATEKEY-----", "-----END PRIVATE KEY-----");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK not configured. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY " +
        "environment variables on the server."
    );
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return adminApp;
}

/**
 * Delete a Firebase Auth user by UID.
 * Permanently removes the user's ability to sign in.
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  const app = getAdminApp();
  await getAuth(app).deleteUser(uid);
}

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Used to authenticate privileged requests from the mobile app.
 */
export async function verifyFirebaseIdToken(idToken: string) {
  const app = getAdminApp();
  return getAuth(app).verifyIdToken(idToken);
}
