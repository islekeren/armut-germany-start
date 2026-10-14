export enum UploadFolder {
  PROFILES = "profiles",
  PORTFOLIOS = "portfolios",
  DOCUMENTS = "documents",
  REQUESTS = "requests",
  MESSAGES = "messages",
}

export const MIB = 1024 * 1024;
export const MAX_FILE_SIZES: Record<UploadFolder, number> = {
  profiles: 5 * MIB,
  portfolios: 10 * MIB,
  documents: 20 * MIB,
  requests: 10 * MIB,
  messages: 10 * MIB,
};
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const isPrivateFolder = (folder: UploadFolder) =>
  folder === UploadFolder.DOCUMENTS || folder === UploadFolder.MESSAGES;
export const allowedTypes = (folder: UploadFolder) =>
  isPrivateFolder(folder) ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES;
