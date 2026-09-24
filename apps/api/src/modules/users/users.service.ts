import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { anonymizeUserAccount } from "./account-deletion";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private readonly userResponseSelect = {
    id: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    userType: true,
    profileImage: true,
    isVerified: true,
    gdprConsent: true,
    createdAt: true,
    updatedAt: true,
  };

  // Deleted (anonymised) accounts are invisible to every lookup, which is
  // what stops their existing access and refresh tokens from working.
  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.userResponseSelect,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: this.userResponseSelect,
    });
  }

  async findByIdWithPassword(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    userType: "customer" | "provider";
    gdprConsent: boolean;
  }) {
    return this.prisma.user.create({
      data,
      select: this.userResponseSelect,
    });
  }

  async update(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    profileImage: string;
  }>) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: this.userResponseSelect,
    });
  }

  async delete(id: string) {
    return anonymizeUserAccount(this.prisma, id);
  }
}
