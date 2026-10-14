/** Shared HTTP and Socket.IO policy; WebSocket upgrades need allowRequest too. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Non-browser clients still require authentication.
  // The production web domain must remain allowed even when CORS_ORIGINS is
  // configured for other environments (e.g. the old Vercel URL).
  const origins = [
    "https://machmajetzt.de",
    "https://www.machmajetzt.de",
    ...(process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:8081"]),
  ];
  return origins.map((value) => value.trim()).filter(Boolean).some((value) => {
    const pattern = value.split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${pattern}$`).test(origin);
  });
}
