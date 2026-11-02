import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProviderApprovalNotice } from "./ProviderApprovalNotice";

interface ProviderSubpageShellProps {
  title: string;
  backLabel: string;
  backHref?: string;
  breadcrumbLabel?: string;
  backOnly?: boolean;
  headerSlot?: ReactNode;
  children: ReactNode;
}

export function ProviderSubpageShell({
  title,
  backLabel,
  backHref = "/dashboard",
  breadcrumbLabel,
  backOnly = false,
  headerSlot,
  children,
}: ProviderSubpageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageContainer className="py-6 sm:py-8">
        <nav
          className={`mb-5 flex flex-wrap items-center gap-1 sm:mb-6 ${
            backOnly ? "text-base" : "text-xs text-muted sm:text-sm"
          }`}
        >
          <Link
            href={backHref}
            className={
              backOnly
                ? "inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-primary bg-white px-5 py-2.5 font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-white hover:shadow-md"
                : "hover:text-primary"
            }
          >
            {backOnly ? (
              <>
                <span aria-hidden="true" className="text-xl leading-none">
                  ←
                </span>
                {backLabel}
              </>
            ) : (
              backLabel
            )}
          </Link>
          {!backOnly && (
            <>
              {" / "}
              <span>{breadcrumbLabel || title}</span>
            </>
          )}
        </nav>

        {headerSlot || (
          <h1 className="mb-6 text-xl font-bold sm:mb-8 sm:text-2xl">
            {title}
          </h1>
        )}

        <ProviderApprovalNotice className="mb-6" />

        {children}
      </PageContainer>
    </div>
  );
}
