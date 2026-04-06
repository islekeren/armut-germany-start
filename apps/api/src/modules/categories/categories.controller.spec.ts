import { CategoriesController } from "./categories.controller";

describe("CategoriesController", () => {
  const categoriesService = {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
  };

  let controller: CategoriesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CategoriesController(categoriesService as any);
  });

  it("returns categories", async () => {
    categoriesService.findAll.mockResolvedValue([{ id: "c1" }]);
    await expect(controller.findAll()).resolves.toEqual([{ id: "c1" }]);
    expect(categoriesService.findAll).toHaveBeenCalledTimes(1);
  });

  it("returns category by slug", async () => {
    categoriesService.findBySlug.mockResolvedValue({ id: "c1", slug: "home-cleaning" });
    await expect(controller.findBySlug("home-cleaning")).resolves.toEqual({
      id: "c1",
      slug: "home-cleaning",
    });
    expect(categoriesService.findBySlug).toHaveBeenCalledWith("home-cleaning");
  });
});
