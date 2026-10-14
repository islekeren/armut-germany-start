import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateServiceDto, UpdateServiceDto } from "./service.dto";

const valid = {
  categoryId: "00000000-0000-4000-8000-000000000001",
  title: "Cleaning",
  description: "Reliable home cleaning",
  priceType: "hourly",
  priceMin: 0,
  priceMax: 50,
};
const errors = (data: Record<string, unknown>, update = false) =>
  validate(plainToInstance(update ? UpdateServiceDto : CreateServiceDto, data));

describe("service input validation", () => {
  it("accepts supported pricing and explicit nullable prices", async () => {
    expect(await errors(valid)).toHaveLength(0);
    expect(
      await errors({ priceMin: null, priceMax: null, isActive: false }, true),
    ).toHaveLength(0);
  });
  it.each([
    { categoryId: "bad-id" },
    { categoryId: null },
    { title: "   " },
    { title: null },
    { description: " " },
    { title: "a".repeat(201) },
    { priceType: "free" },
    { priceType: null },
    { priceMin: -1 },
    { priceMax: Infinity },
    { priceMin: "20" },
    { isActive: "false" },
    { isActive: null },
  ])("rejects invalid create fields %p", async (patch) => {
    expect((await errors({ ...valid, ...patch })).length).toBeGreaterThan(0);
  });
  it.each([
    { title: null },
    { description: null },
    { categoryId: null },
    { priceType: null },
    { isActive: null },
    { title: " " },
    { priceMin: -5 },
  ])("rejects invalid partial updates %p", async (patch) => {
    expect((await errors(patch, true)).length).toBeGreaterThan(0);
  });
  it("allows a partial active-state update", async () => {
    expect(await errors({ isActive: false }, true)).toHaveLength(0);
  });
});
