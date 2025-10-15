import React from "react";
import { useTranslation } from "../context/TranslationContext";

interface FormattedMessageProps {
  id: string;
}

export function FormattedMessage({ id }: FormattedMessageProps) {
  const { t } = useTranslation();
  return <>{t(id)}</>;
}
