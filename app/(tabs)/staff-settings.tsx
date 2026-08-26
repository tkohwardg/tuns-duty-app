import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getUserNotifications, markNotificationRead, type AppNotification } from "@/lib/firebase";
import { useEffect } from "react";

export default function StaffSettingsScreen() {
  const { userProfile, user, logout } = useAuthContext();

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = async () => {
    if (!userProfile?.uid) return;
    try { setNotifications(await getUserNotifications(userProfile.uid)); } catch (error) { console.error("Unable to load notifications:", error); }
  };

  useEffect(() => { loadNotifications(); }, [userProfile?.uid]);

  const openNotification = async (notification: AppNotification) => {
    if (notification.id && !notification.read) {
      await markNotificationRead(notification.id);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    }
    showAlert(notification.title, notification.message);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") window.alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { showAlert("Error", "Please enter your current password."); return; }
    if (!newPassword || newPassword.length < 6) { showAlert("Error", "New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { showAlert("Error", "New passwords do not match."); return; }
    setSavingPassword(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error("No user");
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showAlert("Success", "Password updated successfully.");
    } catch (error: any) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        showAlert("Error", "Current password is incorrect.");
      } else {
        showAlert("Error", "Failed to change password. Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    const doLogout = async () => { try { await logout(); } catch {} };
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) doLogout();
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center py-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">Settings</Text>
        </View>

        {/* User Profile Card */}
        <View style={{
          marginHorizontal: 16, marginTop: 16, padding: 16,
          backgroundColor: "#F5F5F5", borderRadius: 16,
          flexDirection: "row", alignItems: "center",
          borderWidth: 1, borderColor: "#E5E7EB",
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: userProfile?.avatarColor ?? "#E9D1DB", alignItems: "center", justifyContent: "center",
            marginRight: 12,
          }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#475569" }}>{(userProfile?.name || user?.email || "?").charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>
              {userProfile?.name || user?.email || "—"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              <View style={{
                backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>Staff</Text>
              </View>
              {userProfile?.staffNumber ? (
                <Text style={{ fontSize: 12, color: "#687076" }}>#{userProfile.staffNumber}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            style={{ backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Admin-submitted duty notifications */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-foreground">Notifications</Text>
            {notifications.some((notification) => !notification.read) && <View style={{ backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{notifications.filter((notification) => !notification.read).length} new</Text></View>}
          </View>
          {notifications.length === 0 ? (
            <Text className="text-sm text-muted">No notifications yet</Text>
          ) : notifications.slice(0, 5).map((notification) => (
            <TouchableOpacity key={notification.id} onPress={() => openNotification(notification)} className="rounded-lg p-3 mb-2" style={{ backgroundColor: notification.read ? "#FFFFFF" : "#E8F5E9" }}>
              <Text className="text-sm font-bold text-foreground">{notification.title}</Text>
              <Text className="text-xs text-muted mt-1" numberOfLines={2}>{notification.message}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Change Password */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <Text className="text-base font-bold text-foreground mb-3">Change Password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            secureTextEntry
            className="border border-border rounded-lg px-3 py-2 text-foreground bg-background mb-2"
          />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            secureTextEntry
            className="border border-border rounded-lg px-3 py-2 text-foreground bg-background mb-2"
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            className="border border-border rounded-lg px-3 py-2 text-foreground bg-background mb-3"
          />
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={savingPassword}
            style={{ backgroundColor: "#F59E0B" }}
            className="py-2.5 rounded-lg items-center"
          >
            {savingPassword ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
