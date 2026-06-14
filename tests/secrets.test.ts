import { describe, it, expect } from "vitest";

describe("Environment Secrets Validation", () => {
  it("should have Firebase API Key set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(10);
    expect(val).toContain("AIza");
  });

  it("should have Firebase Auth Domain set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
    expect(val).toBeDefined();
    expect(val).toContain(".firebaseapp.com");
  });

  it("should have Firebase Project ID set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(3);
  });

  it("should have Firebase Storage Bucket set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
    expect(val).toBeDefined();
    expect(val).toContain("firebase");
  });

  it("should have Firebase Messaging Sender ID set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(5);
  });

  it("should have Firebase App ID set", () => {
    const val = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
    expect(val).toBeDefined();
    expect(val).toContain(":web:");
  });

  it("should have Google Sheet Webhook URL set and reachable", async () => {
    const val = process.env.EXPO_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL;
    expect(val).toBeDefined();
    expect(val).toContain("script.google.com");

    // Test the GET endpoint with longer timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(val!, { signal: controller.signal, redirect: "follow" });
      expect(response.ok).toBe(true);
      const text = await response.text();
      expect(text).toContain("TUNS");
    } finally {
      clearTimeout(timeout);
    }
  }, 20000);
});
