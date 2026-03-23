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
      <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border/80 sm:p-10">
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {badge}
        </span>
        <h1 className="mt-5 text-3xl font-bold text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
          {description}
        </p>
        <div className="mt-8">
          <Link
            href={backHref}
            className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
