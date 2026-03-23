import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

type FormAccent = "primary" | "secondary";

interface FormSelectProps {
  value?: string;
  placeholder?: string;
  accent?: FormAccent;
  onPress?: () => void;
}

export function FormSelect({
  value,
  placeholder = "Select an option",
  accent = "primary",
  onPress,
}: FormSelectProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.container,
        accent === "secondary" ? styles.secondaryAccent : styles.primaryAccent,
      ]}
    >
      <Text style={[styles.value, !value ? styles.placeholder : null]}>
        {value || placeholder}
      </Text>
      <View style={styles.iconWrap}>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryAccent: {
    borderColor: colors.border,
  },
  secondaryAccent: {
    borderColor: "#FFD1B3",
  },
  value: {
    color: colors.foreground,
    fontSize: 16,
    flex: 1,
  },
  placeholder: {
    color: colors.muted,
  },
  iconWrap: {
    marginLeft: spacing.sm,
  },
});
