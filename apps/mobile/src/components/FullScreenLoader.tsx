import { ActivityIndicator, StyleSheet, View } from "react-native";

export function FullScreenLoader() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#1e1a18" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#f5efe7",
    flex: 1,
    justifyContent: "center",
  },
});
