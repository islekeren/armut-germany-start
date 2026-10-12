import { assertDemoSeedAllowed } from "./demo-seed-guard";

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => {
    throw new Error("Demo seed reached Prisma construction");
  }),
}));

describe("demo seed entry point", () => {
  it("rejects production before constructing a database client", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      jest.isolateModules(() => {
        const { PrismaClient } = jest.requireMock("@prisma/client");
        expect(() => {
          jest.requireActual("../../../prisma/seed");
        }).toThrow("Demo seed is only allowed with NODE_ENV=development or test");
        expect(PrismaClient).not.toHaveBeenCalled();
      });
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });
});

describe("demo seed runtime policy", () => {
  it.each(["development", "test"])("allows explicit %s runtimes", (nodeEnv) => {
    expect(() => assertDemoSeedAllowed(nodeEnv)).not.toThrow();
  });

  it.each([undefined, "", "production", "staging", "preview", "Development", "test "])(
    "rejects unsafe or ambiguous runtime %s",
    (nodeEnv) => {
      expect(() => assertDemoSeedAllowed(nodeEnv)).toThrow(
        "Demo seed is only allowed with NODE_ENV=development or test",
      );
    },
  );
});
