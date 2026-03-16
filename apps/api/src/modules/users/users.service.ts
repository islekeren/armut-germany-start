import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

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

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.userResponseSelect,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: this.userResponseSelect,
    });
  }

  async findByIdWithPassword(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
    return this.prisma.user.delete({
      where: { id },
      select: this.userResponseSelect,
    });
  }
}
