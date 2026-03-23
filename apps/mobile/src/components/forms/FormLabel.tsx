import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors } from "@/theme";

interface FormLabelProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function FormLabel({ children, style }: FormLabelProps) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
});
