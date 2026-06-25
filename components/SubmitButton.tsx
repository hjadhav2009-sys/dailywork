"use client";

import { useFormStatus } from "react-dom";
import { buttonClassName, type ButtonVariant } from "@/components/ui/buttonStyles";

type SubmitButtonProps = {
  children: string;
  className?: string;
  pendingText?: string;
  variant?: ButtonVariant;
};

export function SubmitButton({ children, className: extraClassName = "", pendingText = "Working...", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={buttonClassName(variant, extraClassName)}>
      {pending ? pendingText : children}
    </button>
  );
}
