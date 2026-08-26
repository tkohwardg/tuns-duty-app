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
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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

export async function createDelegatedDutyRequest(input: {
  adminUid: string;
  targetUid: string;
  date: string;
  dutyType: string;
  delegationNote?: string;
}) {
  const db = getFirestore(getAdminApp());
  const [adminSnapshot, targetSnapshot] = await Promise.all([
    db.collection("users").doc(input.adminUid).get(),
    db.collection("users").doc(input.targetUid).get(),
  ]);
  const admin = adminSnapshot.data();
  const target = targetSnapshot.data();
  if (!admin || admin.role !== "admin") throw new Error("Only Admin users can submit delegated requests.");
  if (!target || target.role !== "user") throw new Error("Delegated requests can only target User Role accounts.");

  const existing = await db.collection("duty_requests")
    .where("userId", "==", input.targetUid)
    .where("date", "==", input.date)
    .where("dutyType", "==", input.dutyType)
    .where("status", "in", ["pending", "approved"])
    .limit(1)
    .get();
  if (!existing.empty) throw new Error("This duty is already pending or approved for the selected colleague.");

  const requestRef = db.collection("duty_requests").doc();
  const note = input.delegationNote?.trim() || "";
  await requestRef.set({
    userId: input.targetUid,
    userName: target.name,
    userEmail: target.email,
    date: input.date,
    dutyType: input.dutyType,
    status: "pending",
    submittedByAdmin: true,
    submittedByUid: input.adminUid,
    submittedByName: admin.name,
    delegationNote: note,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("notifications").add({
    recipientId: input.targetUid,
    requestId: requestRef.id,
    title: "Duty request submitted by Admin",
    message: `${admin.name} submitted ${input.dutyType} on ${input.date} for you.${note ? ` Note: ${note}` : ""}`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { requestId: requestRef.id };
}
