import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PageContainer } from "@/components/ui/PageContainer";

interface ProviderSubpageShellProps {
  title: string;
  backLabel: string;
  backHref?: string;
  breadcrumbLabel?: string;
  headerSlot?: ReactNode;
  children: ReactNode;
}

export function ProviderSubpageShell({
  title,
  backLabel,
  backHref = "/dashboard",
  breadcrumbLabel,
  headerSlot,
  children,
}: ProviderSubpageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageContainer className="py-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href={backHref} className="hover:text-primary">
            {backLabel}
          </Link>
          {" / "}
          <span>{breadcrumbLabel || title}</span>
        </nav>

        {headerSlot || <h1 className="mb-8 text-2xl font-bold">{title}</h1>}

        {children}
      </PageContainer>
    </div>
  );
}
