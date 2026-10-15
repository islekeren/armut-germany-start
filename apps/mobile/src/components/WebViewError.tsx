import { Pressable, StyleSheet, Text, View } from "react-native";

export function WebViewError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Can&apos;t connect</Text>
      <Text style={styles.subtitle}>
        We couldn&apos;t reach Armut Germany. Check your connection and try
        again.
      </Text>
      <Pressable onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#f5efe7",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#1e1a18",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6b5d55",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#1e1a18",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
