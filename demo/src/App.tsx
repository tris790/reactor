import React, { useState } from "react";
import "./global.css";
import "./App.css";
import Navigation from "./components/Navigation";
import VideoList from "./components/Video/VideoList";
import VideoUpload from "./components/Video/VideoUpload";
import VideoPlayer from "./components/Video/VideoPlayer";
import Settings from "./components/Settings";
import Storage from "./components/Storage";
import Props from "./components/Props";
import EdgeCase from "./components/EdgeCase";
import { useTranslation } from "./context/TranslationContext";

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  uploadDate: string;
  views: number;
}

// Generate a random thumbnail with a gradient
function generateThumbnail(seed: number): string {
  const colors = [
    ['#4a90e2', '#357abd'],
    ['#f39c12', '#e67e22'],
    ['#e74c3c', '#c0392b'],
    ['#9b59b6', '#8e44ad'],
    ['#1abc9c', '#16a085'],
    ['#34495e', '#2c3e50'],
  ];

  const colorPair = colors[seed % colors.length];

  // Create SVG thumbnail
  const svg = `
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorPair?.[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colorPair?.[1]};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#grad${seed})" />
      <circle cx="150" cy="100" r="30" fill="white" opacity="0.9" />
      <polygon points="145,85 145,115 170,100" fill="${colorPair?.[1]}" />
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function App() {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState<"library" | "settings" | "storage" | "props" | "edgecase">("library");
  const [videos, setVideos] = useState<Video[]>([
    {
      id: "1",
      title: "Introduction to React",
      thumbnail: generateThumbnail(1),
      duration: "10:24",
      uploadDate: "2025-10-01",
      views: 1234,
    },
    {
      id: "2",
      title: "Building with Bun",
      thumbnail: generateThumbnail(2),
      duration: "15:30",
      uploadDate: "2025-10-05",
      views: 856,
    },
    {
      id: "3",
      title: "Advanced TypeScript",
      thumbnail: generateThumbnail(3),
      duration: "22:15",
      uploadDate: "2025-10-08",
      views: 2341,
    },
  ]);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleVideoUpload = (title: string, file: File) => {
    const newVideo: Video = {
      id: Date.now().toString(),
      title,
      thumbnail: generateThumbnail(Date.now() % 1000),
      duration: "0:00",
      uploadDate: new Date().toISOString().split("T")[0] ?? "NA",
      views: 0,
    };
    setVideos([newVideo, ...videos]);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>{t("app.title")}</h1>
        <p>{t("app.subtitle")}</p>
      </header>

      <div className="app-layout">
        <Navigation activePage={activePage} onNavigate={setActivePage} />

        <main className="main-content">
          {activePage === "library" ? (
            <div className="content-wrapper">
              <div className="left-content">
                <div className="upload-section">
                  <VideoUpload onUpload={handleVideoUpload} />
                </div>

                <div className="list-section">
                  <h2>{t("library.title")}</h2>
                  <VideoList videos={videos} onVideoSelect={handleVideoSelect} />
                </div>
              </div>

              {selectedVideo && (
                <div className="side-panel">
                  <VideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} />
                </div>
              )}
            </div>
          ) : activePage === "storage" ? (
            <Storage />
          ) : activePage === "props" ? (
            <Props
              title="Test Title"
              count={42}
              isEnabled={true}
              user={{ id: "user-123", name: "John Doe", email: "john@example.com" }}
              tags={["react", "typescript", "bun"]}
              onClick={() => console.log("onClick called")}
            />
          ) : activePage === "edgecase" ? (
            <EdgeCase />
          ) : (
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
