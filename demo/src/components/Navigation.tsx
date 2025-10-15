import React from "react";
import { useTranslation } from "../context/TranslationContext";
import "./Navigation.css";

interface NavigationProps {
  activePage: "library" | "settings" | "storage" | "props" | "edgecase";
  onNavigate: (page: "library" | "settings" | "storage" | "props" | "edgecase") => void;
}

export default function Navigation({ activePage, onNavigate }: NavigationProps) {
  const { t } = useTranslation();

  return (
    <nav className="left-nav">
      <div className="nav-items">
        <button
          className={`nav-item ${activePage === "library" ? "active" : ""}`}
          onClick={() => onNavigate("library")}
          title={t("nav.library")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <span className="nav-label">{t("nav.library")}</span>
        </button>

        <button
          className={`nav-item ${activePage === "storage" ? "active" : ""}`}
          onClick={() => onNavigate("storage")}
          title={t("nav.storage")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
          <span className="nav-label">{t("nav.storage")}</span>
        </button>

        <button
          className={`nav-item ${activePage === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          title={t("nav.settings")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m-9-9h6m6 0h6" />
            <path d="m16.24 7.76 4.24-4.24m-4.24 16.48 4.24 4.24m-16.48-4.24-4.24 4.24m4.24-16.48-4.24-4.24" />
          </svg>
          <span className="nav-label">{t("nav.settings")}</span>
        </button>

        <button
          className={`nav-item ${activePage === "props" ? "active" : ""}`}
          onClick={() => onNavigate("props")}
          title="Props Test"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="nav-label">Props Test</span>
        </button>

        <button
          className={`nav-item ${activePage === "edgecase" ? "active" : ""}`}
          onClick={() => onNavigate("edgecase")}
          title={t("nav.edgecase")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="nav-label">{t("nav.edgecase")}</span>
        </button>
      </div>
    </nav>
  );
}
