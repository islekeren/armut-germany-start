import { Transform } from "class-transformer";
import { IsIn, IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";

export class ClientErrorDto {
  @IsIn([
    "auth",
    "bookings",
    "quotes",
    "requests",
    "providers",
    "messages",
    "notifications",
    "uploads",
    "unknown",
  ])
  operation!: string;

  @IsIn(["http", "unavailable", "render"])
  code!: string;

  // Undo global implicit coercion: the telemetry contract requires a JSON integer.
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(400)
  @Max(599)
  status?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  requestId?: string;
}
