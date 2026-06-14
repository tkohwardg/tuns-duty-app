import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getUserDutyRequests,
  updateDutyRequestStatus,
  type DutyRequest,
} from "@/lib/firebase";
import { updateSheetStatus } from "@/lib/google-sheets";
import { Swipeable } from "react-native-gesture-handler";

export default function MyRequestsScreen() {
  const { userProfile } = useAuthContext();
  const [pendingRequests, setPendingRequests] = useState<DutyRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectedModal, setShowRejectedModal] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!userProfile) return;
    try {
      const [pending, rejected] = await Promise.all([
        getUserDutyRequests(userProfile.uid, "pending"),
        getUserDutyRequests(userProfile.uid, "rejected"),
      ]);
      setPendingRequests(pending);
      setRejectedRequests(rejected);
    } catch (error) {
      console.error("Error loading requests:", error);
      Alert.alert("Error", "Failed to load requests. Please check your connection.");
    }
  }, [userProfile]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadRequests();
      setIsLoading(false);
    };
    init();
  }, [loadRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleCancel = async (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Cancel Request",
      `Cancel duty request for ${request.date} (${request.dutyType})?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "cancelled");
              await updateSheetStatus(request.id!, "cancelled");
              setPendingRequests((prev) =>
                prev.filter((r) => r.id !== request.id)
              );
              Alert.alert("Done", "Request cancelled successfully.");
            } catch (error) {
              Alert.alert("Error", "Failed to cancel request.");
            }
          },
        },
      ]
    );
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
    request: DutyRequest
  ) => {
    return (
      <TouchableOpacity
        onPress={() => handleCancel(request)}
        style={{ backgroundColor: "#EF4444" }}
        className="justify-center items-center px-6"
      >
        <Text className="text-white font-semibold text-sm">Cancel</Text>
      </TouchableOpacity>
    );
  };

  const renderPendingItem = ({ item }: { item: DutyRequest }) => (
    <Swipeable
      renderLeftActions={(progress, dragX) =>
        renderLeftActions(progress, dragX, item)
      }
      overshootLeft={false}
    >
      <View className="flex-row items-center py-4 px-4 bg-background border-b border-border">
        <View
          className="w-10 h-10 rounded-full mr-3"
          style={{ backgroundColor: "#D1D5DB" }}
        />
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {item.userName}
          </Text>
          <Text className="text-sm text-muted">{item.date}</Text>
        </View>
        <Text className="text-base font-medium text-foreground ml-2">
          {item.dutyType}
        </Text>
      </View>
    </Swipeable>
  );

  const renderRejectedItem = ({ item }: { item: DutyRequest }) => (
    <View className="flex-row items-center py-4 px-4 border-b border-border">
      <View
        className="w-10 h-10 rounded-full mr-3"
        style={{ backgroundColor: "#D1D5DB" }}
      />
      <View className="flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.userName}
        </Text>
        <Text className="text-sm text-muted">{item.date}</Text>
      </View>
      <Text className="text-base font-medium text-foreground ml-2">
        {item.dutyType}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#4CAF50" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="items-center py-4 border-b border-border">
        <Text className="text-xl font-bold text-foreground">
          Your requested duty pending approval
        </Text>
        <Text className="text-xs text-muted mt-1">
          ← Swipe left to cancel request
        </Text>
      </View>

      {/* Pending List */}
      <View className="flex-1 mx-4 mt-4 border border-border rounded-xl overflow-hidden">
        {pendingRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-muted text-base">No pending requests</Text>
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Bottom Buttons */}
      <View className="px-4 pb-4 pt-4 gap-3">
        <TouchableOpacity
          onPress={() => setShowRejectedModal(true)}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: "#5DADE2" }}
        >
          <Text className="text-white text-base font-semibold">
            Review Rejected duty
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rejected Duty Modal */}
      <Modal
        visible={showRejectedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectedModal(false)}
      >
        <View className="flex-1 justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-2xl p-4 max-h-[70%]">
            <View className="items-center mb-4">
              <Text className="text-lg font-bold" style={{ color: "#EF4444" }}>
                —— Rejected duty ——
              </Text>
            </View>

            {rejectedRequests.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-muted text-base">No rejected requests</Text>
              </View>
            ) : (
              <FlatList
                data={rejectedRequests}
                renderItem={renderRejectedItem}
                keyExtractor={(item) => item.id || Math.random().toString()}
              />
            )}

            <TouchableOpacity
              onPress={() => setShowRejectedModal(false)}
              className="mt-4 rounded-xl py-3 items-center border border-border"
            >
              <Text className="text-foreground text-base font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
