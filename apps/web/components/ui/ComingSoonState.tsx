import Link from "next/link";

interface ComingSoonStateProps {
  badge: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export function ComingSoonState({
  badge,
  title,
  description,
  backHref,
  backLabel,
}: ComingSoonStateProps) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 sm:p-10">
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {badge}
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted sm:text-lg">
          {description}
        </p>
        <div className="mt-8">
          <Link
            href={backHref}
            className="inline-flex min-h-12 items-center rounded-md bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-all duration-200 hover:bg-blue-600 sm:min-h-14 sm:px-6 sm:text-base"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
