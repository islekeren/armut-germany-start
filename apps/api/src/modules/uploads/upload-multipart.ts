import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { memoryStorage } from "multer";
import { MAX_FILE_SIZES, MIB, UploadFolder } from "./upload-policy";

/** Require a bounded HTTP body before Multer allocates any file buffers. */
@Injectable()
export class UploadRequestBudget implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const length = request.headers["content-length"];
    if (typeof length !== "string" || !/^\d+$/.test(length))
      throw new HttpException("Multipart uploads require Content-Length", 411);
    if (Number(length) > 30 * MIB)
      throw new PayloadTooLargeException("Multipart request exceeds 30 MiB");
    return next.handle();
  }
}

export function uploadOptions(folder: UploadFolder, files: number) {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZES[folder],
      files,
      fields: 0,
      fieldSize: 0,
      parts: files + 1,
      fieldNameSize: 100,
      headerPairs: 50,
    },
  };
}
