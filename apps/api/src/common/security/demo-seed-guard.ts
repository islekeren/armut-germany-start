export function assertDemoSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error(
      "Demo seed is only allowed with NODE_ENV=development or test; it creates accounts with known passwords and must never run in production or staging.",
    );
  }
}
