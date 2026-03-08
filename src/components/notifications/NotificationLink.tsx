"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type NotificationLinkProps = {
  id: string;
  href: string;
  className?: string;
  children: React.ReactNode;
  onMarkedRead?: () => void;
};

export function NotificationLink({
  id,
  href,
  className,
  children,
  onMarkedRead,
}: NotificationLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    try {
      await fetch(`/notifications/${id}/read`, { method: "PATCH" });
      onMarkedRead?.();
    } catch (error) {
      console.error("Erro ao marcar notificacao como lida:", error);
    } finally {
      startTransition(() => {
        router.push(href);
        router.refresh();
      });
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      aria-disabled={isPending}
    >
      {children}
    </Link>
  );
}
