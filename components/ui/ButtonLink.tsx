import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { buttonClassName, type ButtonVariant } from "./buttonStyles";

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

export function ButtonLink({ children, className, variant = "primary", ...props }: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClassName(variant, className)}>
      {children}
    </Link>
  );
}
