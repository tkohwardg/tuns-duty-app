import { useState, useCallback, useEffect } from "react";
import Constants from "expo-constants";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { useSettings, type DutyOption } from "@/lib/settings-context";
import { getAllApprovedRequests, createUserAsAdmin, getAllUsers, deleteUserProfile, getMasterPassword, updateMasterPassword, type DutyRequest, type UserProfile } from "@/lib/firebase";
import { getNameInitials } from "@/lib/avatar-utils";
import { ModalCloseButton } from "@/components/modal-close-button";
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { trpc } from "@/lib/trpc";
import { DatePickerCalendar } from "@/components/date-picker-calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { buildApprovedDutiesWorkbook } from "@/lib/approved-duties-export";
import { getNoApprovedDutiesMessage } from "@/lib/export-feedback";

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function formatDateStr(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function SettingsScreen() {
  const { isAdmin, userProfile, user, logout } = useAuthContext();
  const { settings, updateWardName, addDutyOption, removeDutyOption } = useSettings();

  // Ward Name
  const [wardNameInput, setWardNameInput] = useState(settings.wardName);
  const [savingWard, setSavingWard] = useState(false);

  // Duty Option
  const [showAddDuty, setShowAddDuty] = useState(false);
  const [newDutyLabel, setNewDutyLabel] = useState("");
  const [newDutyHours, setNewDutyHours] = useState("");
  const [newDutyColor, setNewDutyColor] = useState("#6B7280");
  const [savingDuty, setSavingDuty] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // User Management
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserStaffNumber, setNewUserStaffNumber] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");

  // Master admin password gate (loaded from Firestore)
  const [masterPassword, setMasterPassword] = useState<string | null>(null); // null = not loaded yet
  const [showMasterPwModal, setShowMasterPwModal] = useState(false);
  const [masterPwInput, setMasterPwInput] = useState("");
  const [masterPwError, setMasterPwError] = useState("");
  // pending action after master password verified
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  // whether the user list is unlocked (visible)
  const [userListUnlocked, setUserListUnlocked] = useState(false);
  // Change master password UI
  const [showChangeMasterPw, setShowChangeMasterPw] = useState(false);
  const [newMasterPw, setNewMasterPw] = useState("");
  const [confirmMasterPw, setConfirmMasterPw] = useState("");
  const [changingMasterPw, setChangingMasterPw] = useState(false);
  const [changeMasterPwError, setChangeMasterPwError] = useState("");

  // Load master password from Firestore on mount
  useEffect(() => {
    getMasterPassword().then(setMasterPassword);
  }, []);

  const requireMasterPassword = (action: () => void) => {
    setPendingAction(() => action);
    setMasterPwInput("");
    setMasterPwError("");
    setShowMasterPwModal(true);
  };

  const handleMasterPwConfirm = () => {
    const currentMasterPw = masterPassword ?? "20231204";
    if (masterPwInput === currentMasterPw) {
      setShowMasterPwModal(false);
      setMasterPwInput("");
      setMasterPwError("");
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setMasterPwError("Incorrect master password. Please try again.");
    }
  };

  const handleChangeMasterPassword = async () => {
    setChangeMasterPwError("");
    if (!newMasterPw || newMasterPw.length < 6) {
      setChangeMasterPwError("New password must be at least 6 characters.");
      return;
    }
    if (newMasterPw !== confirmMasterPw) {
      setChangeMasterPwError("Passwords do not match.");
      return;
    }
    setChangingMasterPw(true);
    try {
      await updateMasterPassword(newMasterPw);
      setMasterPassword(newMasterPw);
      setNewMasterPw("");
      setConfirmMasterPw("");
      setShowChangeMasterPw(false);
      Alert.alert("Success", "Master password updated successfully.");
    } catch {
      setChangeMasterPwError("Failed to update password. Please try again.");
    } finally {
      setChangingMasterPw(false);
    }
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const all = await getAllUsers();
      // Sort: admins first, then by name
      all.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
      setUsers(all);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async () => {
    setUserError("");
    if (!newUserName.trim()) { setUserError("Name is required."); return; }
    if (!newUserEmail.trim() || !newUserEmail.includes("@")) { setUserError("Valid email is required."); return; }
    if (!newUserPassword || newUserPassword.length < 6) { setUserError("Password must be at least 6 characters."); return; }
    setSavingUser(true);
    try {
      await createUserAsAdmin(
        newUserEmail.trim().toLowerCase(),
        newUserPassword,
        newUserName.trim(),
        newUserStaffNumber.trim(),
        newUserRole
      );
      setNewUserName("");
      setNewUserEmail("");
      setNewUserStaffNumber("");
      setNewUserPassword("");
      setNewUserRole("user");
      setShowAddUser(false);
      await loadUsers();
      Alert.alert("Success", "User created successfully.");
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setUserError("This email is already registered.");
      } else if (error.code === "auth/invalid-email") {
        setUserError("Invalid email address.");
      } else {
        setUserError("Failed to create user. Please try again.");
      }
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUserMutation = trpc.admin.deleteUser.useMutation();

  const handleDeleteUser = (uid: string, name: string) => {
    // Use window.confirm on web, Alert on native
    const confirmed = Platform.OS === "web"
      ? window.confirm(`Remove "${name}" from the user list? Their duty history will remain.`)
      : false;

    if (Platform.OS === "web" && !confirmed) return;

    const doDelete = async () => {
      try {
        // Step 1: Delete Firestore profile
        await deleteUserProfile(uid);
        // Step 2: Delete Firebase Auth account via backend Admin SDK
        try {
          const currentUser = getAuth().currentUser;
          if (currentUser) {
            const idToken = await currentUser.getIdToken();
            const result = await deleteUserMutation.mutateAsync({ idToken, targetUid: uid });
            if (!result.success) {
              console.warn("Auth account deletion warning:", result.error);
            }
          }
        } catch (authErr) {
          console.warn("Could not delete Firebase Auth account:", authErr);
        }
        await loadUsers();
        if (Platform.OS === "web") {
          window.alert("User removed successfully.");
        } else {
          Alert.alert("Success", "User removed successfully.");
        }
      } catch (error) {
        console.error("Delete user error:", error);
        if (Platform.OS === "web") {
          window.alert("Failed to remove user. Please check Firestore rules are deployed.");
        } else {
          Alert.alert("Error", "Failed to remove user.");
        }
      }
    };

    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert(
        "Remove User",
        `Remove "${name}" from the user list? Their duty history will remain.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  // Export
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const showExportMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const COLOR_OPTIONS = [
    "#EF4444", "#F97316", "#F59E0B", "#22C55E", "#86EFAC",
    "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#6B7280",
  ];

  // Ward Name handlers
  const handleSaveWardName = async () => {
    if (!wardNameInput.trim()) {
      Alert.alert("Error", "Ward name cannot be empty.");
      return;
    }
    setSavingWard(true);
    try {
      await updateWardName(wardNameInput.trim());
      Alert.alert("Success", "Ward name updated.");
    } catch (error) {
      Alert.alert("Error", "Failed to update ward name.");
    } finally {
      setSavingWard(false);
    }
  };

  // Duty Option handlers
  const handleAddDutyOption = async () => {
    if (!newDutyLabel.trim()) {
      if (Platform.OS === "web") window.alert("Error: Duty label cannot be empty.");
      else Alert.alert("Error", "Duty label cannot be empty.");
      return;
    }
    const hours = parseFloat(newDutyHours);
    if (isNaN(hours) || hours <= 0) {
      if (Platform.OS === "web") window.alert("Error: Please enter a valid number of hours.");
      else Alert.alert("Error", "Please enter a valid number of hours.");
      return;
    }
    // Check duplicate
    if (settings.dutyOptions.some((o) => o.label === newDutyLabel.trim())) {
      if (Platform.OS === "web") window.alert("Error: A duty option with this label already exists.");
      else Alert.alert("Error", "A duty option with this label already exists.");
      return;
    }
    setSavingDuty(true);
    try {
      await addDutyOption({
        label: newDutyLabel.trim(),
        hours,
        color: newDutyColor,
      });
      setNewDutyLabel("");
      setNewDutyHours("");
      setNewDutyColor("#6B7280");
      setShowAddDuty(false);
      if (Platform.OS === "web") window.alert("Duty option added successfully.");
      else Alert.alert("Success", "Duty option added.");
    } catch (error) {
      if (Platform.OS === "web") window.alert("Error: Failed to add duty option.");
      else Alert.alert("Error", "Failed to add duty option.");
    } finally {
      setSavingDuty(false);
    }
  };

  const handleRemoveDutyOption = (label: string) => {
    const doRemove = async () => {
      try {
        await removeDutyOption(label);
      } catch (error) {
        if (Platform.OS === "web") window.alert("Error: Failed to remove duty option.");
        else Alert.alert("Error", "Failed to remove duty option.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Remove duty option "${label}"? This won't affect existing requests.`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        "Confirm Delete",
        `Remove duty option "${label}"? This won't affect existing requests.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doRemove },
        ]
      );
    }
  };

  // Password handlers
  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert("Error", "Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user");

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Password updated successfully.");
    } catch (error: any) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        Alert.alert("Error", "Current password is incorrect.");
      } else {
        Alert.alert("Error", "Failed to change password. Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  // Export handlers

  const handleExport = async (period?: { startDate: string; endDate: string; fileSuffix: string; title: string }) => {
    const startDate = period?.startDate ?? exportStartDate;
    const endDate = period?.endDate ?? exportEndDate;
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please select both start and end dates.");
      return;
    }
    const start = parseDateStr(startDate);
    const end = parseDateStr(endDate);
    const periodTitle = period?.title ?? `${startDate} to ${endDate}`;
    if (start > end) {
      Alert.alert("Error", "Start date must be before end date.");
      return;
    }

    setExporting(true);
    try {
      const allApproved = await getAllApprovedRequests();
      const filtered = allApproved.filter((r) => {
        const d = parseDateStr(r.date);
        return d >= start && d <= end;
      });

      // Sort by duty date ascending, then createdAt ascending
      filtered.sort((a, b) => {
        const dateA = parseDateStr(a.date);
        const dateB = parseDateStr(b.date);
        const dateDiff = dateA.getTime() - dateB.getTime();
        if (dateDiff !== 0) return dateDiff;
        const createdA = a.createdAt?.toMillis?.() || 0;
        const createdB = b.createdAt?.toMillis?.() || 0;
        return createdA - createdB;
      });

      if (filtered.length === 0) {
        showExportMessage("No Approved Duties", getNoApprovedDutiesMessage(periodTitle));
        setExporting(false);
        return;
      }

      const XLSX = await import("xlsx");
      const workbook = buildApprovedDutiesWorkbook(XLSX, filtered, settings.dutyOptions, {
        wardName: settings.wardName,
        exportPeriod: periodTitle,
      });
      const workbookBase64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });

      // Generate file name
      const fileName = `approved_duties_${(period?.fileSuffix ?? `${startDate.replace(/\//g, "-")}_to_${endDate.replace(/\//g, "-")}`)}.xlsx`;

      if (Platform.OS === "web") {
        // Web: trigger browser download
        const binary = atob(workbookBase64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert("Success", `Excel file downloaded: ${fileName}`);
      } else {
        // iOS / Android: save to app documents then share
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, workbookBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Share via system share sheet (allows saving to Files, Google Drive, etc.)
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Save or Share Approved Duties Excel File",
            UTI: "org.openxmlformats.spreadsheetml.sheet",
          });
        } else {
          Alert.alert("Saved", `File saved to app documents:\n${fileName}`);
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Error", "Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const handleMonthlyExport = () => {
    const start = new Date(exportMonth.getFullYear(), exportMonth.getMonth(), 1);
    const end = new Date(exportMonth.getFullYear(), exportMonth.getMonth() + 1, 0);
    const fileSuffix = `${exportMonth.getFullYear()}-${String(exportMonth.getMonth() + 1).padStart(2, "0")}`;
    const title = exportMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    handleExport({ startDate: formatDateStr(start), endDate: formatDateStr(end), fileSuffix, title });
  };

  const changeExportMonth = (offset: number) => {
    setExportMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  if (!isAdmin) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ fontSize: 40, color: "#9CA3AF" }}>{"\ud83d\udd12"}</Text>
        <Text className="text-lg text-muted mt-4 text-center">
          Admin access required
        </Text>
      </ScreenContainer>
    );
  }


  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center py-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">Settings</Text>
        </View>

        {/* User Profile Card - shown to all users */}
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
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#475569" }}>{getNameInitials(userProfile?.name || user?.email)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>
              {userProfile?.name || user?.email || "—"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              <View style={{
                backgroundColor: isAdmin ? "#FEF3C7" : "#EFF6FF",
                borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: isAdmin ? "#D97706" : "#3B82F6" }}>
                  {isAdmin ? "Admin" : "Staff"}
                </Text>
              </View>
              {userProfile?.staffNumber ? (
                <Text style={{ fontSize: 12, color: "#687076" }}>#{userProfile.staffNumber}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            onPress={async () => {
              const doLogout = async () => { try { await logout(); } catch {} };
              if (Platform.OS === "web") {
                if (window.confirm("Are you sure you want to logout?")) doLogout();
              } else {
                Alert.alert("Logout", "Are you sure you want to logout?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Logout", style: "destructive", onPress: doLogout },
                ]);
              }
            }}
            style={{ backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Admin-only sections */}
        {isAdmin && <>

        {/* Section 1: Ward Name */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <Text className="text-base font-bold text-foreground mb-3">
            Ward Name
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={wardNameInput}
              onChangeText={setWardNameInput}
              placeholder="Enter ward name"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-foreground bg-background"
            />
            <TouchableOpacity
              onPress={handleSaveWardName}
              disabled={savingWard}
              style={{ backgroundColor: "#4CAF50" }}
              className="px-4 py-2 rounded-lg"
            >
              {savingWard ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Duty Options */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-foreground">
              Duty Options
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddDuty(true)}
              style={{ backgroundColor: "#3B82F6" }}
              className="px-3 py-1.5 rounded-lg"
            >
              <Text className="text-white text-sm font-semibold">+ Add</Text>
            </TouchableOpacity>
          </View>

          {settings.dutyOptions.map((option) => (
            <View
              key={option.label}
              className="flex-row items-center justify-between py-2 border-b border-border"
            >
              <View className="flex-row items-center gap-2">
                <View
                  style={{ backgroundColor: option.color, width: 16, height: 16, borderRadius: 4 }}
                />
                <Text className="text-sm text-foreground font-medium">
                  {option.label}
                </Text>
                <Text className="text-xs text-muted">({option.hours}h)</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveDutyOption(option.label)}>
                <Text style={{ fontSize: 18, color: "#EF4444" }}>{"\ud83d\uddd1"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Section 3: Change Password */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <Text className="text-base font-bold text-foreground mb-3">
            Change Password
          </Text>
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

        {/* Section 4: Export Approved Duties */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          <Text className="text-base font-bold text-foreground mb-3">
            Export Approved Duties
          </Text>
          <Text className="text-sm font-semibold text-foreground mb-2">Monthly Export</Text>
          <View className="flex-row items-center gap-2 mb-2">
            <TouchableOpacity
              onPress={() => changeExportMonth(-1)}
              style={{ backgroundColor: "#E5E7EB" }}
              className="w-10 py-2 rounded-lg items-center"
            >
              <Text className="text-foreground font-bold">◀</Text>
            </TouchableOpacity>
            <View className="flex-1 border border-border rounded-lg px-3 py-2 bg-background items-center">
              <Text className="text-sm text-foreground font-semibold">
                {exportMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => changeExportMonth(1)}
              style={{ backgroundColor: "#E5E7EB" }}
              className="w-10 py-2 rounded-lg items-center"
            >
              <Text className="text-foreground font-bold">▶</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleMonthlyExport}
            disabled={exporting}
            style={{ backgroundColor: "#4CAF50" }}
            className="py-2.5 rounded-lg items-center mb-4"
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Export Selected Month</Text>
            )}
          </TouchableOpacity>
          <Text className="text-sm font-semibold text-foreground mb-2">Custom Date Range</Text>
          <View className="flex-row items-center gap-2 mb-2">
            <TouchableOpacity
              onPress={() => setShowStartDatePicker(true)}
              className="flex-1 border border-border rounded-lg px-3 py-2 bg-background"
            >
              <Text className={`text-sm ${exportStartDate ? "text-foreground" : "text-muted"}`}>
                {exportStartDate || "Start date"}
              </Text>
            </TouchableOpacity>
            <Text className="text-muted">to</Text>
            <TouchableOpacity
              onPress={() => setShowEndDatePicker(true)}
              className="flex-1 border border-border rounded-lg px-3 py-2 bg-background"
            >
              <Text className={`text-sm ${exportEndDate ? "text-foreground" : "text-muted"}`}>
                {exportEndDate || "End date"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => handleExport()}
            disabled={exporting}
            style={{ backgroundColor: "#6366F1" }}
            className="py-2.5 rounded-lg items-center mt-2"
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Export as XLSX</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* Section 5: User Management */}
        <View className="mx-4 mt-4 p-4 bg-surface rounded-xl border border-border">
          {/* Header row: title + lock/unlock + add user */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text className="text-base font-bold text-foreground">User Management</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {userListUnlocked && (
                <TouchableOpacity
                  onPress={() => { setUserError(""); setShowAddUser(true); }}
                  style={{ backgroundColor: "#3B82F6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>+ Add User</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (userListUnlocked) {
                    // Lock the list again
                    setUserListUnlocked(false);
                  } else {
                    requireMasterPassword(() => {
                      setUserListUnlocked(true);
                      loadUsers();
                    });
                  }
                }}
                style={{
                  backgroundColor: userListUnlocked ? "#EF4444" : "#6B7280",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                  {userListUnlocked ? "Lock" : "Unlock"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Locked state: show placeholder */}
          {!userListUnlocked ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🔒</Text>
              <Text style={{ fontSize: 13, color: "#687076", textAlign: "center" }}>
                Enter master password to view and manage users.
              </Text>
            </View>
          ) : loadingUsers ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 12 }} />
          ) : users.length === 0 ? (
            <Text className="text-sm text-muted text-center py-3">No users found</Text>
          ) : (
            users.map((u) => (
              <View
                key={u.uid}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                  gap: 10,
                }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: u.avatarColor ?? "#E9D1DB", alignItems: "center", justifyContent: "center" }}><Text style={{ fontWeight: "700", fontSize: 12, color: "#475569" }}>{getNameInitials(u.name)}</Text></View>
                {/* Role badge */}
                <View style={{
                  backgroundColor: u.role === "admin" ? "#FEF3C7" : "#EFF6FF",
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  minWidth: 48,
                  alignItems: "center",
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: u.role === "admin" ? "#D97706" : "#3B82F6",
                  }}>
                    {u.role === "admin" ? "Admin" : "Staff"}
                  </Text>
                </View>
                {/* Name, email, staff number */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                    {u.name || "—"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#687076", marginTop: 1 }}>
                    {u.email}
                  </Text>
                  {u.staffNumber ? (
                    <Text style={{ fontSize: 11, color: "#9BA1A6", marginTop: 1 }}>
                      #{u.staffNumber}
                    </Text>
                  ) : null}
                </View>
                {/* Delete button - don't allow deleting yourself */}
                {u.uid !== (user?.uid ?? userProfile?.uid) && (
                  <TouchableOpacity
                    onPress={() => handleDeleteUser(u.uid, u.name || u.email)}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ fontSize: 18, color: "#EF4444" }}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Section 6: Change Master Password (admin only) */}
          <View className="mx-4 mt-4 mb-2 p-4 bg-surface rounded-xl border border-border">
            <Text className="text-base font-bold text-foreground mb-3">Master Password</Text>
            {!showChangeMasterPw ? (
              <TouchableOpacity
                onPress={() => requireMasterPassword(() => {
                  setNewMasterPw("");
                  setConfirmMasterPw("");
                  setChangeMasterPwError("");
                  setShowChangeMasterPw(true);
                })}
                style={{
                  backgroundColor: "#F59E0B",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Change Master Password</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 2 }}>
                  Enter a new master password (min. 6 characters).
                </Text>
                <TextInput
                  value={newMasterPw}
                  onChangeText={(t) => { setNewMasterPw(t); setChangeMasterPwError(""); }}
                  placeholder="New master password"
                  secureTextEntry
                  returnKeyType="next"
                  style={{
                    borderWidth: 1,
                    borderColor: changeMasterPwError ? "#EF4444" : "#E5E7EB",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: "#11181C",
                    backgroundColor: "#F9FAFB",
                  }}
                />
                <TextInput
                  value={confirmMasterPw}
                  onChangeText={(t) => { setConfirmMasterPw(t); setChangeMasterPwError(""); }}
                  placeholder="Confirm new master password"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleChangeMasterPassword}
                  style={{
                    borderWidth: 1,
                    borderColor: changeMasterPwError ? "#EF4444" : "#E5E7EB",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: "#11181C",
                    backgroundColor: "#F9FAFB",
                  }}
                />
                {changeMasterPwError ? (
                  <Text style={{ color: "#EF4444", fontSize: 12 }}>{changeMasterPwError}</Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setShowChangeMasterPw(false); setChangeMasterPwError(""); }}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: "#11181C" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleChangeMasterPassword}
                    disabled={changingMasterPw}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: changingMasterPw ? "#9CA3AF" : "#F59E0B",
                    }}
                  >
                    {changingMasterPw ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontWeight: "700", color: "#fff" }}>Update</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

        </>}
        {/* End admin-only sections */}

      {/* Version Footer */}
      <View style={{ alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
        <Text style={{ fontSize: 12, color: "#9BA1A6" }}>
          TUNS Duty v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
        <Text style={{ fontSize: 11, color: "#9BA1A6", marginTop: 2 }}>
          Build: {Constants.expoConfig?.extra?.buildDate ?? new Date().toISOString().slice(0, 10)}
        </Text>
      </View>
      </ScrollView>

      {/* Add Duty Option Modal */}
      <Modal
        visible={showAddDuty}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddDuty(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View className="bg-background rounded-t-3xl p-5">
            <Text className="text-lg font-bold text-foreground mb-4">Add Duty Option</Text>

            <Text className="text-sm text-muted mb-1">Label</Text>
            <TextInput
              value={newDutyLabel}
              onChangeText={setNewDutyLabel}
              placeholder="e.g. N, 1400-2200"
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-1">Working Hours</Text>
            <TextInput
              value={newDutyHours}
              onChangeText={setNewDutyHours}
              placeholder="e.g. 7"
              keyboardType="numeric"
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-2">Color</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewDutyColor(color)}
                  style={{
                    backgroundColor: color,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    borderWidth: newDutyColor === color ? 3 : 0,
                    borderColor: "#000",
                  }}
                />
              ))}
            </View>

            <View className="flex-row gap-3">
              <View style={{ flex: 1 }}><ModalCloseButton label="Cancel" onPress={() => setShowAddDuty(false)} /></View>
              <TouchableOpacity
                onPress={handleAddDutyOption}
                disabled={savingDuty}
                style={{ backgroundColor: "#4CAF50" }}
                className="flex-1 py-2.5 rounded-lg items-center"
              >
                {savingDuty ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Master Admin Password Modal */}
      <Modal
        visible={showMasterPwModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowMasterPwModal(false); setMasterPwInput(""); setMasterPwError(""); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 24,
            width: "85%",
            maxWidth: 360,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#11181C", marginBottom: 6 }}>
              Master Admin Password
            </Text>
            <Text style={{ fontSize: 13, color: "#687076", marginBottom: 16 }}>
              Enter the master password to continue.
            </Text>
            <TextInput
              value={masterPwInput}
              onChangeText={(t) => { setMasterPwInput(t); setMasterPwError(""); }}
              placeholder="Master password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleMasterPwConfirm}
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: masterPwError ? "#EF4444" : "#E5E7EB",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                color: "#11181C",
                backgroundColor: "#F9FAFB",
                marginBottom: 8,
              }}
            />
            {masterPwError ? (
              <Text style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{masterPwError}</Text>
            ) : (
              <View style={{ height: 12 }} />
            )}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}><ModalCloseButton label="Cancel" onPress={() => { setShowMasterPwModal(false); setMasterPwInput(""); setMasterPwError(""); setPendingAction(null); }} /></View>
              <TouchableOpacity
                onPress={handleMasterPwConfirm}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: "#3B82F6",
                }}
              >
                <Text style={{ fontWeight: "600", color: "#fff" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add User Modal */}
      <Modal
        visible={showAddUser}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddUser(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View className="bg-background rounded-t-3xl p-5">
            <Text className="text-lg font-bold text-foreground mb-4">Add New User</Text>

            <Text className="text-sm text-muted mb-1">Full Name *</Text>
            <TextInput
              value={newUserName}
              onChangeText={setNewUserName}
              placeholder="e.g. Chan Tai Man"
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-1">Staff Number</Text>
            <TextInput
              value={newUserStaffNumber}
              onChangeText={setNewUserStaffNumber}
              placeholder="e.g. 12345"
              keyboardType="numeric"
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-1">Email *</Text>
            <TextInput
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              placeholder="e.g. staff@hospital.hk"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-1">Password * (min. 6 characters)</Text>
            <TextInput
              value={newUserPassword}
              onChangeText={setNewUserPassword}
              placeholder="Set initial password"
              secureTextEntry
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-surface mb-3"
            />

            <Text className="text-sm text-muted mb-2">Role *</Text>
            <View className="flex-row gap-3 mb-4">
              {(["user", "admin"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setNewUserRole(r)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: newUserRole === r ? (r === "admin" ? "#D97706" : "#3B82F6") : "#E5E7EB",
                    backgroundColor: newUserRole === r ? (r === "admin" ? "#FEF3C7" : "#EFF6FF") : "transparent",
                  }}
                >
                  <Text style={{
                    fontWeight: "700",
                    fontSize: 14,
                    color: newUserRole === r ? (r === "admin" ? "#D97706" : "#3B82F6") : "#9CA3AF",
                  }}>
                    {r === "admin" ? "Admin" : "Staff"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {userError ? (
              <Text style={{ color: "#EF4444", fontSize: 13, marginBottom: 10 }}>{userError}</Text>
            ) : null}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowAddUser(false); setUserError(""); }}
                className="flex-1 py-2.5 rounded-lg items-center border border-border"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddUser}
                disabled={savingUser}
                style={{ backgroundColor: "#3B82F6" }}
                className="flex-1 py-2.5 rounded-lg items-center"
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Create User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Start Date Picker Calendar */}
      <DatePickerCalendar
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        onSelectDate={(date) => {
          const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
          setExportStartDate(dateStr);
          setShowStartDatePicker(false);
        }}
        title="Select Start Date"
        noRestrictions
      />

      {/* End Date Picker Calendar */}
      <DatePickerCalendar
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        onSelectDate={(date) => {
          const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
          setExportEndDate(dateStr);
          setShowEndDatePicker(false);
        }}
        title="Select End Date"
        noRestrictions
      />
    </ScreenContainer>
  );
}
