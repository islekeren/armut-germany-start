import { ForbiddenException } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";

describe("AdminGuard", () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  const createContext = (user: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it("throws when user is missing", () => {
    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      new ForbiddenException("Authentication required")
    );
  });

  it("throws when user is not admin", () => {
    expect(() =>
      guard.canActivate(createContext({ id: "u1", userType: "customer" }))
    ).toThrow(new ForbiddenException("Admin access required"));
  });

  it("allows admin users", () => {
    expect(
      guard.canActivate(createContext({ id: "u1", userType: "admin" }))
    ).toBe(true);
  });
});
