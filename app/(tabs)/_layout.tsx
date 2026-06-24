import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuthContext();
  // Increase bottom padding to avoid triggering iOS home indicator / system gestures
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom + 8, 20);
  const tabBarHeight = 64 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4CAF50",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 10,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Request",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={24} name="add-circle-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          title: "My Requests",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={24} name="list-alt" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="approved-duty"
        options={{
          title: "Approved",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={24} name="check-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin-approve"
        options={{
          title: "Admin",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={24} name="admin-panel-settings" color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={24} name="settings" color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
