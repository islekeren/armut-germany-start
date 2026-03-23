import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radii, spacing } from "@/theme";

type FormAccent = "primary" | "secondary";

interface FormInputProps extends TextInputProps {
  accent?: FormAccent;
}

export function FormInput({
  accent = "primary",
  placeholderTextColor = colors.muted,
  style,
  ...props
}: FormInputProps) {
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor}
      style={[
        styles.input,
        accent === "secondary" ? styles.secondaryAccent : styles.primaryAccent,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.foreground,
    fontSize: 16,
  },
  primaryAccent: {
    borderColor: colors.border,
  },
  secondaryAccent: {
    borderColor: "#FFD1B3",
  },
});
