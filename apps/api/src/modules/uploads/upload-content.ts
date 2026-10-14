import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { validatePdf } from "./upload-pdf";
import { allowedTypes, MAX_FILE_SIZES, UploadFolder } from "./upload-policy";

/** Decode, rather than trusting MIME/filename. Re-encoding strips image metadata and trailing payloads. */
export async function validateUploadContent(
  buffer: Buffer,
  suppliedType: string,
  folder: UploadFolder,
) {
  if (
    !buffer.length ||
    buffer.length > MAX_FILE_SIZES[folder] ||
    !allowedTypes(folder).includes(suppliedType)
  ) {
    throw new BadRequestException("File size or type is not allowed");
  }
  try {
    if (suppliedType === "application/pdf") {
      if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new Error("Invalid PDF");
      await validatePdf(buffer);
      // PDF is a download-only private format, never served inline as active content.
      return { buffer, mimetype: suppliedType };
    }
    const image = sharp(buffer, {
      failOn: "warning",
      limitInputPixels: 25_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    const types: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (
      types[metadata.format ?? ""] !== suppliedType ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Invalid image");
    const output = await image
      .toFormat(metadata.format as "jpeg" | "png" | "webp")
      .toBuffer();
    if (output.length > MAX_FILE_SIZES[folder])
      throw new Error("Image too large");
    return { buffer: output, mimetype: suppliedType };
  } catch {
    throw new BadRequestException(
      "File content is invalid or does not match its MIME type",
    );
  }
}
