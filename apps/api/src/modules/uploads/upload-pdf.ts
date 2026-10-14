import { Worker } from "node:worker_threads";

/** Conservative PDF support: never inflate object/xref streams in the parser. */
export async function validatePdf(buffer: Buffer): Promise<void> {
  const names = buffer
    .toString("latin1")
    // PDF whitespace includes NUL; keep the byte-oriented name grammar explicit.
    // eslint-disable-next-line no-control-regex, no-useless-escape
    .matchAll(/\/([^\x00\x09\x0a\x0c\x0d\x20()<>{}\[\]\/%]+)/g);
  for (const match of names) {
    const name = match[1].replace(/#([\da-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    if (name === "ObjStm" || name === "XRef")
      throw new Error("Compressed PDF structure is unsupported");
  }
  // Keep parser/page-tree work off the event loop and terminate cyclic/expensive inputs.
  // V8 heap limits do not bound external buffers; the pre-scan prevents parser inflation.
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(
      `
      const {parentPort, workerData} = require('node:worker_threads');
      const {PDFDocument} = require(workerData.module);
      PDFDocument.load(workerData.bytes, {updateMetadata:false, throwOnInvalidObject:true})
        .then(pdf => parentPort.postMessage(pdf.getPageCount() > 0))
        .catch(() => parentPort.postMessage(false));
    `,
      {
        eval: true,
        workerData: { module: require.resolve("pdf-lib"), bytes: buffer },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 2,
        },
      },
    );
    let settled = false;
    const finish = (valid: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (valid) resolve();
      else reject(new Error("Invalid or overly complex PDF"));
    };
    const timer = setTimeout(() => finish(false), 2000);
    worker.once("message", (valid) => finish(valid === true));
    worker.once("error", () => finish(false));
    worker.once("exit", () => finish(false));
  });
}
