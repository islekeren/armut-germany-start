import {
  REQUEST_BRANCHES,
  REQUEST_SECTORS,
  getBranchLabel,
  type RequestBranch,
  type RequestSector,
} from "@/lib/request-taxonomy";

export type ProviderServiceSector = RequestSector;
export type ProviderServiceBranch = RequestBranch;

export const PROVIDER_SERVICE_SECTORS: ProviderServiceSector[] = REQUEST_SECTORS;
export const PROVIDER_SERVICE_BRANCHES: ProviderServiceBranch[] = REQUEST_BRANCHES;

export function getProviderServiceBranchLabel(
  branch: ProviderServiceBranch,
  locale?: string,
) {
  return getBranchLabel(branch, locale);
}
