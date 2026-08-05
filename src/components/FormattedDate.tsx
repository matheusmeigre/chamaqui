"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type FormattedDateProps = {
  date: string | Date;
  pattern: string;
  className?: string;
};

const emptySubscribe = () => () => {};

export function FormattedDate({ date, pattern, className }: FormattedDateProps) {
  const iso = new Date(date).toISOString();

  const text = useSyncExternalStore(
    emptySubscribe,
    () => format(new Date(iso), pattern, { locale: ptBR }),
    () => ""
  );

  return (
    <time suppressHydrationWarning className={className} dateTime={iso}>
      {text}
    </time>
  );
}
