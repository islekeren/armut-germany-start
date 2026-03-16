import { sanitizeUserResponse } from "./user-response.helper";

describe("user-response.helper", () => {
  it("removes the password field from user payloads", () => {
    expect(
      sanitizeUserResponse({
        id: "u1",
        email: "user@example.com",
        password: "secret",
      }),
    ).toEqual({
      id: "u1",
      email: "user@example.com",
    });
  });

  it("returns nullish payloads unchanged", () => {
    expect(sanitizeUserResponse(null)).toBeNull();
    expect(sanitizeUserResponse(undefined)).toBeUndefined();
  });
});
