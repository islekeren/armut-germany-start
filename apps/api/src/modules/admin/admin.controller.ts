import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== Dashboard ====================

  @Get("dashboard")
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ==================== Users ====================

  @Get("users")
  getUsers(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("userType") userType?: string,
    @Query("search") search?: string
  ) {
    return this.adminService.getUsers({ page, limit, userType, search });
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Patch("users/:id")
  updateUser(@Param("id") id: string, @Body() data: { isVerified?: boolean }) {
    return this.adminService.updateUser(id, data);
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.adminService.deleteUser(id);
  }

  // ==================== Providers ====================

  @Get("providers")
  getProviders(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("isApproved") isApproved?: string,
    @Query("search") search?: string
  ) {
    return this.adminService.getProviders({
      page,
      limit,
      isApproved: isApproved === "true" ? true : isApproved === "false" ? false : undefined,
      search,
    });
  }

  @Get("providers/pending")
  getPendingProviders(
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.adminService.getPendingProviders({ page, limit });
  }

  @Patch("providers/:id/approve")
  approveProvider(
    @Param("id") id: string,
    @Body() data: { approved: boolean }
  ) {
    return this.adminService.approveProvider(id, data.approved);
  }

  // ==================== Categories ====================

  @Get("categories")
  getCategories() {
    return this.adminService.getCategories();
  }

  @Post("categories")
  createCategory(
    @Body()
    data: {
      slug: string;
      nameDe: string;
      nameEn: string;
      icon: string;
      parentId?: string;
    }
  ) {
    return this.adminService.createCategory(data);
  }

  @Put("categories/:id")
  updateCategory(
    @Param("id") id: string,
    @Body()
    data: {
      nameDe?: string;
      nameEn?: string;
      icon?: string;
      isActive?: boolean;
    }
  ) {
    return this.adminService.updateCategory(id, data);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ==================== Reports ====================

  @Get("reports/revenue")
  getRevenueReport(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    return this.adminService.getRevenueReport(
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get("reports/categories")
  getCategoryReport() {
    return this.adminService.getCategoryReport();
  }

  @Get("reports/top-providers")
  getTopProviders(@Query("limit") limit?: number) {
    return this.adminService.getTopProviders(limit);
  }
}
