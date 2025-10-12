import React from "react";
import { useTranslation } from "../context/TranslationContext";

export default function Settings() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="settings-page">
      <h2>{t("settings.title")}</h2>

      <div className="settings-section">
        <h3>{t("settings.language")}</h3>
        <div className="setting-item">
          <label>
            {t("settings.selectLanguage")}:
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "fr")}
              style={{ marginLeft: "10px" }}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.videoPreferences")}</h3>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            {t("settings.autoPlay")}
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" />
            {t("settings.showCaptions")}
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.uploadSettings")}</h3>
        <div className="setting-item">
          <label>
            {t("settings.defaultQuality")}
            <select style={{ marginLeft: "10px" }}>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.storage")}</h3>
        <div className="setting-item">
          <p>{t("settings.storageUsed")}: 2.4 GB / 10 GB</p>
          <div className="storage-bar">
            <div className="storage-used" style={{ width: "24%" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
