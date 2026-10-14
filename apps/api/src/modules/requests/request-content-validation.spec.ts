import { ValidationPipe } from "@nestjs/common";
import { CreateRequestDto } from "./dto/request.dto";

const valid = {
  categoryId: "home-cleaning",
  title: "Cleaning needed",
  description: "Please clean the kitchen.",
  address: "Torstrasse 1",
  city: "Berlin",
  postalCode: "10115",
  lat: 52.52,
  lng: 13.405,
};

describe("request content validation", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  it.each(["title", "description"])("rejects blank %s", async (field) => {
    for (const value of ["", " ", "\t\n", "\u00a0"]) {
      await expect(
        pipe.transform(
          { ...valid, [field]: value },
          {
            type: "body",
            metatype: CreateRequestDto,
          },
        ),
      ).rejects.toThrow();
    }
  });
  it("accepts meaningful content", async () => {
    await expect(
      pipe.transform(valid, { type: "body", metatype: CreateRequestDto }),
    ).resolves.toMatchObject(valid);
  });
});
