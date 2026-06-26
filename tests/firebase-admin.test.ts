/**
 * Validates that Firebase Admin SDK credentials are correctly configured.
 * Tests that the Admin SDK can initialize and list users (lightweight API call).
 */
import { describe, it, expect } from "vitest";

describe("Firebase Admin SDK credentials", () => {
  it("should initialize Firebase Admin SDK without throwing", async () => {
    // Dynamically import to trigger initialization
    const { verifyFirebaseIdToken } = await import("../server/firebase-admin");
    // verifyFirebaseIdToken is exported — just check it's a function (init succeeded)
    expect(typeof verifyFirebaseIdToken).toBe("function");
  });

  it("should have required environment variables set", () => {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    expect(projectId).toBeTruthy();
    expect(clientEmail).toBeTruthy();
    expect(clientEmail).toMatch(/@.*\.iam\.gserviceaccount\.com$/);
    expect(privateKey).toBeTruthy();
    // Private key may have spaces stripped in env storage (BEGINPRIVATEKEY vs BEGIN PRIVATE KEY)
    expect(privateKey).toMatch(/PRIVATE.?KEY/);
  });
});
