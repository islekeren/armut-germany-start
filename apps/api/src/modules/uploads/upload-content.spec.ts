import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { validateUploadContent } from "./upload-content";
import { UploadFolder } from "./upload-policy";

describe("actual upload content", () => {
  it.each(["png", "jpeg", "webp"] as const)(
    "decodes and normalizes supported %s content",
    async (format) => {
      const source = await sharp({
        create: { width: 2, height: 2, channels: 3, background: "#00ff00" },
      })
        .toFormat(format)
        .toBuffer();
      const type = `image/${format}`;
      const result = await validateUploadContent(
        Buffer.concat([source, Buffer.from("<script>")]),
        type,
        UploadFolder.PROFILES,
      );
      expect(result.mimetype).toBe(type);
      expect((await sharp(result.buffer).metadata()).format).toBe(format);
      expect(result.buffer.includes(Buffer.from("<script>"))).toBe(false);
      await expect(
        validateUploadContent(
          source,
          format === "png" ? "image/jpeg" : "image/png",
          UploadFolder.PROFILES,
        ),
      ).rejects.toThrow();
    },
  );
  it("rejects truncated images and header-only PDFs", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#00ff00" },
    })
      .png()
      .toBuffer();
    await expect(
      validateUploadContent(
        png.subarray(0, 32),
        "image/png",
        UploadFolder.PROFILES,
      ),
    ).rejects.toThrow();
    await expect(
      validateUploadContent(
        Buffer.from("%PDF-1.7\n<script>"),
        "application/pdf",
        UploadFolder.DOCUMENTS,
      ),
    ).rejects.toThrow();
  });
  it("rejects compressed object/xref structures including escaped PDF names", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const compressed = Buffer.from(await pdf.save());
    await expect(
      validateUploadContent(
        compressed,
        "application/pdf",
        UploadFolder.DOCUMENTS,
      ),
    ).rejects.toThrow();
    const escaped = Buffer.from(
      compressed.toString("latin1").replace(/ObjStm/g, "Ob#6aStm"),
      "latin1",
    );
    await expect(
      validateUploadContent(escaped, "application/pdf", UploadFolder.DOCUMENTS),
    ).rejects.toThrow();
  });

  it.each(["ObjStm", "Obj#53tm", "X#52ef"])(
    "rejects a compressed PDF bomb named %s",
    async (name) => {
      const compressed = deflateSync(Buffer.alloc(1024 * 1024, 32));
      const bomb = Buffer.concat([
        Buffer.from(`%PDF-1.7
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj
4 0 obj << /Type 5 0 R /N 0 /First 0 /Filter /FlateDecode /Length ${compressed.length} >> stream
`),
        compressed,
        Buffer.from(`
endstream endobj
5 0 obj /${name} endobj
trailer << /Root 1 0 R >>
%%EOF`),
      ]);
      await expect(
        validateUploadContent(bomb, "application/pdf", UploadFolder.DOCUMENTS),
      ).rejects.toThrow();
    },
  );

  it("accepts parsed PDFs only in private folders", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const buffer = Buffer.from(await pdf.save({ useObjectStreams: false }));
    await expect(
      validateUploadContent(buffer, "application/pdf", UploadFolder.DOCUMENTS),
    ).resolves.toHaveProperty("mimetype", "application/pdf");
    await expect(
      validateUploadContent(buffer, "application/pdf", UploadFolder.MESSAGES),
    ).resolves.toHaveProperty("mimetype", "application/pdf");
    await expect(
      validateUploadContent(buffer, "application/pdf", UploadFolder.REQUESTS),
    ).rejects.toThrow();
  });
});
