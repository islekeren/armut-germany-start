import { SafeRuntimeLogger } from "./safe-runtime-logger";

describe("SafeRuntimeLogger", () => {
  it("emits JSON level categories without Nest error messages, stacks, contexts or objects", () => {
    const output = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const logger = new SafeRuntimeLogger();
    const secret = "postgresql://user:password@db/private?token=secret";
    try {
      logger.log(secret, { password: secret });
      logger.error(new Error(secret), secret, secret);
      logger.warn(secret);
      logger.debug(secret);
      logger.verbose(secret);
      logger.fatal(secret);
      expect(
        output.mock.calls.map(([line]) => JSON.parse(String(line))),
      ).toEqual(
        ["log", "error", "warn", "debug", "verbose", "fatal"].map((level) => ({
          event: "runtime_log",
          level,
        })),
      );
      expect(JSON.stringify(output.mock.calls)).not.toContain(secret);
      logger.startupFailure();
      expect(JSON.parse(output.mock.calls.at(-1)![0])).toEqual({
        event: "startup_failed",
        category: "bootstrap",
      });
    } finally {
      output.mockRestore();
    }
  });
});
