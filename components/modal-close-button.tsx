import { Text, TouchableOpacity } from "react-native";

export function ModalCloseButton({ onPress, label = "Close" }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ marginTop: 12, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#FFFFFF" }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F2937" }}>{label}</Text>
    </TouchableOpacity>
  );
}
