import React from "react";
import { useTranslation } from "../context/TranslationContext";
import "./Settings.css";

export default function Storage() {
  const { t } = useTranslation();

  // Mock storage data
  const totalSpace = 10; // GB
  const usedSpace = 2.4; // GB
  const videoCount = 3;
  const videoSpace = 2.1; // GB

  const usedPercentage = (usedSpace / totalSpace) * 100;
  const videoPercentage = (videoSpace / totalSpace) * 100;
  const availableSpace = totalSpace - usedSpace;

  return (
    <div className="settings-page">
      <h2>{t("storage.title")}</h2>

      <div className="settings-section">
        <h3>{t("storage.overview")}</h3>
        <div className="setting-item">
          <p>
            {t("storage.totalSpace")}: {totalSpace} GB
          </p>
          <p>
            {t("settings.storageUsed")}: {usedSpace} GB ({usedPercentage.toFixed(1)}%)
          </p>
          <p>
            {t("storage.available")}: {availableSpace.toFixed(1)} GB
          </p>
          <div className="storage-bar">
            <div className="storage-used" style={{ width: `${usedPercentage}%` }}></div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("storage.videoStorage")}</h3>
        <div className="setting-item">
          <p>
            {t("storage.videos")}: {videoCount}
          </p>
          <p>
            {t("settings.storageUsed")}: {videoSpace} GB
          </p>
          <div className="storage-bar">
            <div className="storage-used" style={{ width: `${videoPercentage}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
