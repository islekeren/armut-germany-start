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
  BadRequestException,
  ParseIntPipe,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import {
  AdminApproveProviderDto,
  AdminCreateCategoryDto,
  AdminUpdateCategoryDto,
  AdminUpdateUserDto,
} from "./dto/admin.dto";

const optionalInt = () => new ParseIntPipe({ optional: true });

function parseReportDate(value: string, name: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${name} must be a valid date`);
  }
  return date;
}

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
    @Query("page", optionalInt()) page?: number,
    @Query("limit", optionalInt()) limit?: number,
    @Query("userType") userType?: string,
    @Query("search") search?: string,
  ) {
    return this.adminService.getUsers({ page, limit, userType, search });
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Patch("users/:id")
  updateUser(@Param("id") id: string, @Body() data: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, data);
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.adminService.deleteUser(id);
  }

  // ==================== Providers ====================

  @Get("providers")
  getProviders(
    @Query("page", optionalInt()) page?: number,
    @Query("limit", optionalInt()) limit?: number,
    @Query("isApproved") isApproved?: string,
    @Query("search") search?: string,
  ) {
    return this.adminService.getProviders({
      page,
      limit,
      isApproved:
        isApproved === "true"
          ? true
          : isApproved === "false"
            ? false
            : undefined,
      search,
    });
  }

  @Get("providers/pending")
  getPendingProviders(
    @Query("page", optionalInt()) page?: number,
    @Query("limit", optionalInt()) limit?: number,
  ) {
    return this.adminService.getPendingProviders({ page, limit });
  }

  @Patch("providers/:id/approve")
  approveProvider(
    @Param("id") id: string,
    @Body() data: AdminApproveProviderDto,
  ) {
    return this.adminService.approveProvider(id, data.approved);
  }

  // ==================== Categories ====================

  @Get("categories")
  getCategories() {
    return this.adminService.getCategories();
  }

  @Post("categories")
  createCategory(@Body() data: AdminCreateCategoryDto) {
    return this.adminService.createCategory(data);
  }

  @Put("categories/:id")
  updateCategory(
    @Param("id") id: string,
    @Body() data: AdminUpdateCategoryDto,
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
    @Query("endDate") endDate: string,
  ) {
    return this.adminService.getRevenueReport(
      parseReportDate(startDate, "startDate"),
      parseReportDate(endDate, "endDate"),
    );
  }

  @Get("reports/categories")
  getCategoryReport() {
    return this.adminService.getCategoryReport();
  }

  @Get("reports/top-providers")
  getTopProviders(@Query("limit", optionalInt()) limit?: number) {
    return this.adminService.getTopProviders(limit);
  }
}
