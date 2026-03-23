import { Link } from "expo-router";
import { StyleSheet } from "react-native";
import { PageContainer, PanelCard, SectionHeader } from "@/components";
import { colors } from "@/theme";

export default function NotFoundScreen() {
  return (
    <PageContainer>
      <SectionHeader
        eyebrow="404"
        title="Screen not found"
        subtitle="The route exists in the app shell, but there is no screen here yet."
      />
      <PanelCard style={styles.card}>
        <Link href="/" style={styles.link}>
          Back to home
        </Link>
      </PanelCard>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "flex-start",
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
