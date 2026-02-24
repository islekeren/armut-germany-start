import { CacheService } from "./cache.service";

describe("CacheService", () => {
  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheService(cacheManager as any);
  });

  it("gets values by key", async () => {
    cacheManager.get.mockResolvedValue("value");
    await expect(service.get("key")).resolves.toBe("value");
    expect(cacheManager.get).toHaveBeenCalledWith("key");
  });

  it("sets values by key", async () => {
    await service.set("key", { ok: true }, 60);
    expect(cacheManager.set).toHaveBeenCalledWith("key", { ok: true }, 60);
  });

  it("deletes values by key", async () => {
    await service.del("key");
    expect(cacheManager.del).toHaveBeenCalledWith("key");
  });

  it("returns cached value inside wrap when present", async () => {
    cacheManager.get.mockResolvedValue("cached");
    const fn = jest.fn().mockResolvedValue("computed");

    await expect(service.wrap("k", fn, 30)).resolves.toBe("cached");
    expect(fn).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it("computes and caches value inside wrap when missing", async () => {
    cacheManager.get.mockResolvedValue(undefined);
    const fn = jest.fn().mockResolvedValue("computed");

    await expect(service.wrap("k", fn, 30)).resolves.toBe("computed");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cacheManager.set).toHaveBeenCalledWith("k", "computed", 30);
  });

  it("generates key from parts", () => {
    expect(service.generateKey("providers", 1, "stats")).toBe(
      "providers:1:stats"
    );
  });
});
