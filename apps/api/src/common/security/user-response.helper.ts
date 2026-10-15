export function sanitizeUserResponse(user: null): null;
export function sanitizeUserResponse(user: undefined): undefined;
export function sanitizeUserResponse<T extends object>(
  user: T,
): Omit<T, "password" | "authVersion" | "passwordResetRequestedAt">;
export function sanitizeUserResponse<T extends object | null | undefined>(
  user: T,
) {
  if (user == null) {
    return user;
  }

  const { password: _password, authVersion: _authVersion, passwordResetRequestedAt: _resetRequestedAt, ...sanitized } = user as Record<
    string,
    unknown
  > & {
    password?: unknown;
  };

  void _password;
  void _authVersion;
  void _resetRequestedAt;
  return sanitized;
}
