import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateRequestDto } from "./dto/request.dto";
import { RequestsService } from "./requests.service";

describe("request update taxonomy", () => {
  const db = {
    serviceRequest: { findUnique: jest.fn(), update: jest.fn() },
    category: { findUnique: jest.fn() },
  };
  let service: RequestsService;
  beforeEach(() => {
    jest.resetAllMocks();
    db.serviceRequest.findUnique.mockResolvedValue({
      id: "r",
      customerId: "owner",
      categoryId: "cat",
      requestSector: "home-repair",
      requestBranch: "electrician",
    });
    db.category.findUnique.mockResolvedValue({
      id: "cat",
      slug: "electrician",
    });
    db.serviceRequest.update.mockImplementation(async ({ data }) => ({
      id: "r",
      ...data,
    }));
    service = new RequestsService(db as any, {} as any);
  });

  it.each([
    { requestSector: "home-repair", requestBranch: "electrician" },
    { requestSector: "home-repair" },
    { requestBranch: "electrician" },
  ])("updates a valid final pair from %j", async (dto) => {
    await expect(service.update("r", "owner", dto)).resolves.toMatchObject({
      requestSector: "home-repair",
      requestBranch: "electrician",
    });
    expect(db.serviceRequest.update).toHaveBeenCalledTimes(1);
    expect(
      db.serviceRequest.update.mock.calls[0][0].data.categoryId,
    ).toBeUndefined();
  });

  it.each([
    { requestSector: "unknown" },
    { requestBranch: "unknown" },
    { requestBranch: "plumber" },
    { requestSector: "cleaning-care" },
    { requestSector: "cleaning-care", requestBranch: "electrician" },
    { requestSector: "" },
    { requestBranch: "" },
    { requestSector: null },
    { requestBranch: null },
    { requestSector: "   " },
    { requestBranch: "   " },
  ])("rejects %j before writing", async (dto) => {
    await expect(
      service.update("r", "owner", dto as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each([{ requestSector: "home-repair" }, { requestBranch: "electrician" }])(
    "resolves legacy missing values using the fixed category for %j",
    async (dto) => {
      db.serviceRequest.findUnique.mockResolvedValue({
        id: "r",
        customerId: "owner",
        categoryId: "cat",
        requestSector: null,
        requestBranch: null,
      });
      await expect(service.update("r", "owner", dto)).resolves.toMatchObject({
        requestSector: "home-repair",
        requestBranch: "electrician",
      });
      expect(db.category.findUnique).toHaveBeenCalledWith({
        where: { id: "cat" },
      });
    },
  );

  it("does not pick a different category for unsupported legacy taxonomy", async () => {
    db.serviceRequest.findUnique.mockResolvedValue({
      id: "r",
      customerId: "owner",
      categoryId: "cat",
      requestSector: null,
      requestBranch: null,
    });
    db.category.findUnique.mockResolvedValue({ slug: "legacy-unknown" });
    await expect(
      service.update("r", "owner", { requestSector: "home-repair" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("leaves taxonomy untouched for title/date/location edits", async () => {
    await service.update("r", "owner", {
      title: "new",
      preferredDate: "2099-01-01",
      postalCode: "10115",
      lat: 0,
      lng: 0,
    });
    const data = db.serviceRequest.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("requestSector");
    expect(data).not.toHaveProperty("requestBranch");
    expect(data.preferredDate).toEqual(new Date("2099-01-01"));
    expect(data.lat).not.toBe(0);
    expect(db.category.findUnique).not.toHaveBeenCalled();
  });

  it("checks ownership before taxonomy validation", async () => {
    await expect(
      service.update("r", "other", { requestSector: "home-repair" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.category.findUnique).not.toHaveBeenCalled();
    expect(db.serviceRequest.update).not.toHaveBeenCalled();
  });

  it.each(["requestSector", "requestBranch"])(
    "DTO rejects null and empty %s but permits omission",
    async (field) => {
      expect(
        await validate(plainToInstance(UpdateRequestDto, {})),
      ).toHaveLength(0);
      for (const value of [null, ""]) {
        expect(
          await validate(plainToInstance(UpdateRequestDto, { [field]: value })),
        ).not.toHaveLength(0);
      }
    },
  );
});
