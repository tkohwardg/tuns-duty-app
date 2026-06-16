import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and store the token in Firestore.
 * Should be called after user logs in.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Get push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
    });
    const token = tokenData.data;

    // Store token in Firestore under user document
    await setDoc(
      doc(db, "push_tokens", userId),
      { token, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    // Set notification channel for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("duty-updates", {
        name: "Duty Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Send a local notification (used when the app is in foreground).
 * For background notifications, we use Expo Push API via server.
 */
export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // Immediate
  });
}

/**
 * Get the push token for a specific user from Firestore.
 */
export async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const tokenDoc = await getDoc(doc(db, "push_tokens", userId));
    if (tokenDoc.exists()) {
      return tokenDoc.data().token || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting user push token:", error);
    return null;
  }
}

/**
 * Send push notification to a user via Expo Push API.
 * This is called from the admin's device when approving/rejecting.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string
): Promise<boolean> {
  try {
    const token = await getUserPushToken(userId);
    if (!token) {
      console.log("No push token found for user:", userId);
      return false;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        channelId: "duty-updates",
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}
