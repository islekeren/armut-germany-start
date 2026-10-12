import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StripeConnectService } from "./stripe-connect.service";

@Controller("providers/me")
@UseGuards(JwtAuthGuard)
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post("stripe-account")
  createAccount(@Req() req: any) {
    return this.stripeConnectService.createAccount(req.user.id);
  }

  @Post("stripe-onboarding-link")
  createOnboardingLink(@Req() req: any) {
    return this.stripeConnectService.createOnboardingLink(req.user.id);
  }

  @Get("stripe-status")
  getStatus(@Req() req: any) {
    return this.stripeConnectService.refreshStatus(req.user.id);
  }

  @Post("stripe-dashboard-link")
  createDashboardLoginLink(@Req() req: any) {
    return this.stripeConnectService.createDashboardLoginLink(req.user.id);
  }
}
