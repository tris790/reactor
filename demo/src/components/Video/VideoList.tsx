import React from "react";
import type { Video } from "../../App";
import { useTranslation } from "../../context/TranslationContext";
import "./VideoList.css";

interface VideoListProps {
  videos: Video[];
  onVideoSelect: (video: Video) => void;
}

export default function VideoList({ videos, onVideoSelect }: VideoListProps) {
  const { t } = useTranslation();

  return (
    <div className="video-list">
      {videos.map((video) => (
        <div
          key={video.id}
          className="video-card"
          onClick={() => onVideoSelect(video)}
        >
          <img src={video.thumbnail} alt={video.title} className="video-thumbnail" />
          <div className="video-info">
            <h3 className="video-title">{video.title}</h3>
            <div className="video-meta">
              <span className="video-duration">{video.duration}</span>
              <span className="video-views">{video.views.toLocaleString()} {t("video.views")}</span>
              <span className="video-date">{video.uploadDate}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
