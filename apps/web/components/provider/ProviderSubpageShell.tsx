import type { ReactNode } from "react";
import Link from "next/link";
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
      <header className="bg-white shadow-sm">
        <PageContainer className="py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <Link href={backHref} className="text-muted hover:text-foreground">
              {backLabel}
            </Link>
          </div>
        </PageContainer>
      </header>

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
