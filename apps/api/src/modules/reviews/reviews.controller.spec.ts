import { ReviewsController } from "./reviews.controller";

describe("ReviewsController", () => {
  const reviewsService = {
    createReview: jest.fn(),
    addProviderReply: jest.fn(),
    getReviews: jest.fn(),
    replyToReview: jest.fn(),
  };

  let controller: ReviewsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReviewsController(reviewsService as any);
  });

  it("creates booking review", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { rating: 5, comment: "Great" };
    reviewsService.createReview.mockResolvedValue({ id: "rev1" });
    await expect(controller.createReview("b1", req, dto)).resolves.toEqual({
      id: "rev1",
    });
    expect(reviewsService.createReview).toHaveBeenCalledWith("b1", "u1", dto);
  });

  it("adds provider reply to a booking review", async () => {
    const req = { user: { id: "u1" } };
    reviewsService.addProviderReply.mockResolvedValue({ id: "rev1" });
    await expect(
      controller.addProviderReply("b1", req, { reply: "Thanks" } as any),
    ).resolves.toEqual({ id: "rev1" });
    expect(reviewsService.addProviderReply).toHaveBeenCalledWith(
      "b1",
      "u1",
      "Thanks",
      undefined,
    );
  });

  it("gets own reviews", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { limit: 10 };
    reviewsService.getReviews.mockResolvedValue({ data: [] });
    await expect(controller.getMyReviews(req, query)).resolves.toEqual({
      data: [],
    });
    expect(reviewsService.getReviews).toHaveBeenCalledWith("u1", query);
  });

  it("replies to review from the provider dashboard", async () => {
    const req = { user: { id: "u1" } };
    reviewsService.replyToReview.mockResolvedValue({ success: true });
    await expect(
      controller.replyToReview(req, "rev1", { reply: "Thanks!" } as any),
    ).resolves.toEqual({ success: true });
    expect(reviewsService.replyToReview).toHaveBeenCalledWith(
      "u1",
      "rev1",
      "Thanks!",
      undefined,
    );
  });
});
