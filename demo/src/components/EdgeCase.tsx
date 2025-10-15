import React from "react";
import { useTranslation } from "../context/TranslationContext";
import { FormattedMessage } from "./FormattedMessage";

export default function EdgeCase() {
  const { t } = useTranslation();

  return (
    <div>
      <div>
        <h2>{t("app.title")}</h2>
      </div>
      <div>
        <div>
          <strong>t() hook: </strong>
          {t("edgecase.hook")}
        </div>
        <hr />
        <div>
          <strong>&lt;FormattedMessage /&gt;: </strong>
          <FormattedMessage id="edgecase.formattedMessage" />
        </div>
      </div>
    </div>
  );
}
