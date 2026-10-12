import type { ConfigService } from "@nestjs/config";

export interface AuthSecrets {
  accessSecret: string;
  refreshSecret: string;
}

/** Validate before Nest connects to dependencies or starts listening. */
export function validateAuthConfiguration(config: Record<string, unknown>) {
  const strict = config.NODE_ENV !== "development" && config.NODE_ENV !== "test";
  for (const name of ["JWT_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const value = config[name];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${name} is required; authentication has no fallback secret`);
    }
    if (value !== value.trim()) {
      throw new Error(`${name} must not contain surrounding whitespace`);
    }
    if (strict && (
      value.length < 32 ||
      /^(your[-_ ]|replace|change[-_ ]?me|test[-_ ]|dev[-_ ])/i.test(value) ||
      /^(.)\1+$/.test(value)
    )) {
      throw new Error(`${name} must be an independently generated secret of at least 32 characters`);
    }
  }
  if (strict && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
  }
  return config;
}

/** The same validated values serve signing, HTTP, and Socket.IO. */
export function getAuthSecrets(config: ConfigService): AuthSecrets {
  const values = validateAuthConfiguration({
    NODE_ENV: config.get<string>("NODE_ENV"),
    JWT_SECRET: config.get<string>("JWT_SECRET"),
    JWT_REFRESH_SECRET: config.get<string>("JWT_REFRESH_SECRET"),
  });
  return {
    accessSecret: values.JWT_SECRET as string,
    refreshSecret: values.JWT_REFRESH_SECRET as string,
  };
}
