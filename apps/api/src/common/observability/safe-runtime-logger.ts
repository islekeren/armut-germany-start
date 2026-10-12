import type { LoggerService } from "@nestjs/common";

/** Nest messages can contain secrets. Only the fixed event and severity are retained. */
export class SafeRuntimeLogger implements LoggerService {
  log(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("log");
  }
  error(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("error");
  }
  warn(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("warn");
  }
  debug(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("debug");
  }
  verbose(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("verbose");
  }
  fatal(_message: unknown, ..._optionalParams: unknown[]) {
    this.emit("fatal");
  }

  startupFailure() {
    console.log(
      JSON.stringify({ event: "startup_failed", category: "bootstrap" }),
    );
  }

  private emit(level: string) {
    console.log(JSON.stringify({ event: "runtime_log", level }));
  }
}
