import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { SessionService } from "./session.service";
import { sanitizeUserResponse } from "../../common/security";
import { getAuthSecrets } from "../../common/security/auth-config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private sessions: SessionService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getAuthSecrets(configService).accessSecret,
      algorithms: ["HS256"],
    });
  }

  async validate(payload: { sub?: string; sid?: string; type?: string }) {
    if (payload.type !== "access") throw new UnauthorizedException();
    const session = await this.sessions.validate(payload.sub, payload.sid);
    // Internal session identity is non-enumerable and never appears in /auth/me.
    const user = sanitizeUserResponse(session.user);
    Object.defineProperty(user, "sessionId", { value: session.id });
    return user;
  }
}
