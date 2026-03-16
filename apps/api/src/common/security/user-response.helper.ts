export function sanitizeUserResponse(user: null): null;
export function sanitizeUserResponse(user: undefined): undefined;
export function sanitizeUserResponse<T extends object>(
  user: T,
): Omit<T, "password">;
export function sanitizeUserResponse<T extends object | null | undefined>(
  user: T,
) {
  if (user == null) {
    return user;
  }

  const { password: _password, ...sanitized } = user as Record<
    string,
    unknown
  > & {
    password?: unknown;
  };

  return sanitized;
}
