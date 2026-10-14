import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Module,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { uploadOptions, UploadRequestBudget } from "./upload-multipart";
import { UploadFolder } from "./upload-policy";

@Controller("test-upload")
class TestController {
  @Post()
  @UseInterceptors(
    UploadRequestBudget,
    FileInterceptor("file", uploadOptions(UploadFolder.PROFILES, 1)),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return { size: file.size };
  }
}
@Module({ controllers: [TestController], providers: [UploadRequestBudget] })
class TestModule {}

describe("multipart ingestion limits", () => {
  it("rejects a profile over 5 MiB at the middleware and accepts a normal file", async () => {
    const app = (
      await Test.createTestingModule({ imports: [TestModule] }).compile()
    ).createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer())
        .post("/test-upload")
        .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), "x.png")
        .expect(413);
      await request(app.getHttpServer())
        .post("/test-upload")
        .attach("file", Buffer.alloc(10), "x.png")
        .expect(201, { size: 10 });
      await request(app.getHttpServer())
        .post("/test-upload")
        .field("unexpected", "x")
        .attach("file", Buffer.alloc(10), "x.png")
        .expect(400);
      await request(app.getHttpServer())
        .post("/test-upload")
        .set("content-type", "multipart/form-data; boundary=x")
        .set("content-length", String(32 * 1024 * 1024 + 1))
        .send("x")
        .expect(413);
    } finally {
      await app.close();
    }
  });
});
