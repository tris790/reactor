import React from "react";
import type { Video } from "../../App";
import { useTranslation } from "../../context/TranslationContext";

interface VideoPlayerProps {
  video: Video;
  onClose: () => void;
}

export default function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const { t } = useTranslation();

  return (
    <div className="video-player">
      <div className="player-header">
        <h2>{video.title}</h2>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="player-container">
        <video
          controls
          poster={video.thumbnail}
          className="video-element"
        >
          <source src={`/api/videos/${video.id}/stream`} type="video/mp4" />
          {t("video.browserNotSupported")}
        </video>
      </div>
      <div className="player-details">
        <div className="detail-item">
          <strong>{t("video.views")}:</strong> {video.views.toLocaleString()}
        </div>
        <div className="detail-item">
          <strong>{t("video.uploaded")}:</strong> {video.uploadDate}
        </div>
      </div>
    </div>
  );
}
