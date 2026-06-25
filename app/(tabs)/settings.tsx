import { useState, useCallback } from "react";
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
import { getAllApprovedRequests, type DutyRequest } from "@/lib/firebase";
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { DatePickerCalendar } from "@/components/date-picker-calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export default function SettingsScreen() {
  const { isAdmin, userProfile } = useAuthContext();
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

  // Export
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
      Alert.alert("Error", "Duty label cannot be empty.");
      return;
    }
    const hours = parseFloat(newDutyHours);
    if (isNaN(hours) || hours <= 0) {
      Alert.alert("Error", "Please enter a valid number of hours.");
      return;
    }
    // Check duplicate
    if (settings.dutyOptions.some((o) => o.label === newDutyLabel.trim())) {
      Alert.alert("Error", "A duty option with this label already exists.");
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
      Alert.alert("Success", "Duty option added.");
    } catch (error) {
      Alert.alert("Error", "Failed to add duty option.");
    } finally {
      setSavingDuty(false);
    }
  };

  const handleRemoveDutyOption = (label: string) => {
    Alert.alert(
      "Confirm Delete",
      `Remove duty option "${label}"? This won't affect existing requests.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeDutyOption(label);
            } catch (error) {
              Alert.alert("Error", "Failed to remove duty option.");
            }
          },
        },
      ]
    );
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

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      Alert.alert("Error", "Please select both start and end dates.");
      return;
    }
    const start = parseDateStr(exportStartDate);
    const end = parseDateStr(exportEndDate);
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
        Alert.alert("No Data", "No approved duties found in the selected period.");
        setExporting(false);
        return;
      }

      // Generate CSV content
      const csvHeader = "Date,Staff Name,Email,Duty Type,Status,Requested At\n";
      const csvRows = filtered.map((r) => {
        const createdAt = r.createdAt?.toDate?.()
          ? r.createdAt.toDate().toLocaleString()
          : "N/A";
        return `${r.date},"${r.userName}",${r.userEmail},${r.dutyType},${r.status},${createdAt}`;
      }).join("\n");
      const csvContent = csvHeader + csvRows;

      // Generate file name
      const fileName = `approved_duties_${exportStartDate.replace(/\//g, "-")}_to_${exportEndDate.replace(/\//g, "-")}.csv`;

      if (Platform.OS === "web") {
        // Web: trigger browser download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert("Success", `CSV file downloaded: ${fileName}`);
      } else {
        // iOS / Android: save to app documents then share
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        // Share via system share sheet (allows saving to Files, Google Drive, etc.)
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: "text/csv",
            dialogTitle: "Save or Share Approved Duties CSV",
            UTI: "public.comma-separated-values-text",
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
          <Text className="text-sm text-muted">Admin Only</Text>
        </View>

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
            onPress={handleExport}
            disabled={exporting}
            style={{ backgroundColor: "#6366F1" }}
            className="py-2.5 rounded-lg items-center mt-2"
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Export as CSV</Text>
            )}
          </TouchableOpacity>
        </View>
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
              <TouchableOpacity
                onPress={() => setShowAddDuty(false)}
                className="flex-1 py-2.5 rounded-lg items-center border border-border"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
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
