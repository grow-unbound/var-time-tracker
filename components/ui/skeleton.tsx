import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={`animate-pulse rounded-md bg-border ${className}`.trim()}
      aria-hidden
      {...props}
    />
  );
}
