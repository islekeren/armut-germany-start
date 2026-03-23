import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radii, spacing } from "@/theme";

type FormAccent = "primary" | "secondary";

interface FormTextareaProps extends TextInputProps {
  accent?: FormAccent;
}

export function FormTextarea({
  accent = "primary",
  multiline = true,
  numberOfLines = 5,
  placeholderTextColor = colors.muted,
  style,
  ...props
}: FormTextareaProps) {
  return (
    <TextInput
      multiline={multiline}
      numberOfLines={numberOfLines}
      placeholderTextColor={placeholderTextColor}
      style={[
        styles.textarea,
        accent === "secondary" ? styles.secondaryAccent : styles.primaryAccent,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.foreground,
    fontSize: 16,
    textAlignVertical: "top",
  },
  primaryAccent: {
    borderColor: colors.border,
  },
  secondaryAccent: {
    borderColor: "#FFD1B3",
  },
});
