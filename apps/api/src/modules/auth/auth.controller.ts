import { Controller, Post, Body, Get, UseGuards, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

// Strict limits only on credential-bearing endpoints. Session checks (`me`)
// and token refresh run on every page load and must not share this budget,
// otherwise normal navigation locks users out.
const CREDENTIAL_THROTTLE = { default: { limit: 10, ttl: 60000 } };
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60000 } };

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(CREDENTIAL_THROTTLE)
  @Post("register")
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle(CREDENTIAL_THROTTLE)
  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Throttle(REFRESH_THROTTLE)
  @Post("refresh")
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Throttle(CREDENTIAL_THROTTLE)
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: any,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return req.user;
  }
}
