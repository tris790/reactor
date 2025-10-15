/**
 * Translation Explorer UI
 * Shows all translations and allows clicking to see which components use them
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import type { AnalysisCache } from "./analyzer";

interface Translation {
  key: string;
  en: string;
  fr: string;
}

interface ComponentInfo {
  path: string;
  name: string;
  propsInterface?: string;
  translationKeys: string[];
}

type NavigationMode = "by-string" | "by-component";

export function TranslationExplorer() {
  const [cache, setCache] = useState<AnalysisCache | null>(null);
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("by-string");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track if we're handling a popstate event to avoid pushing duplicate history
  const isNavigatingRef = useRef(false);

  // Initialize state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get('key');
    const urlComponent = params.get('component');
    const urlMode = params.get('mode') as NavigationMode;

    isNavigatingRef.current = true; // Don't push history for initial load
    if (urlMode && (urlMode === "by-string" || urlMode === "by-component")) {
      setNavigationMode(urlMode);
    }
    if (urlKey) {
      setSelectedKey(urlKey);
    }
    if (urlComponent) {
      // Component will be set once cache is loaded
      setSelectedComponent({ path: urlComponent } as ComponentInfo);
    }
  }, []);

  // Update URL when state changes
  useEffect(() => {
    // Skip if we're in the middle of handling a navigation event
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    const params = new URLSearchParams();

    params.set('mode', navigationMode);
    if (selectedKey) {
      params.set('key', selectedKey);
    }
    if (selectedComponent) {
      params.set('component', selectedComponent.path);
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.pushState({}, '', newUrl);
  }, [selectedKey, selectedComponent, navigationMode]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      isNavigatingRef.current = true; // Mark that we're navigating

      const params = new URLSearchParams(window.location.search);
      const urlKey = params.get('key');
      const urlComponent = params.get('component');
      const urlMode = params.get('mode') as NavigationMode;

      // Update navigation mode
      if (urlMode && (urlMode === "by-string" || urlMode === "by-component")) {
        setNavigationMode(urlMode);
      }

      // Always update selectedKey based on URL
      setSelectedKey(urlKey);

      // Update selectedComponent based on URL
      if (urlComponent && cache) {
        const component = cache.components.find(c => c.path === urlComponent);
        setSelectedComponent(component || null);
      } else {
        setSelectedComponent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [cache]);

  // When cache is loaded, restore component from URL if needed
  useEffect(() => {
    if (cache && selectedComponent && !selectedComponent.name) {
      // Component was loaded from URL but doesn't have full data yet
      const fullComponent = cache.components.find(c => c.path === selectedComponent.path);
      if (fullComponent) {
        isNavigatingRef.current = true; // Don't push history when restoring from cache
        setSelectedComponent(fullComponent);
      }
    }
  }, [cache, selectedComponent]);

  // Load initial data via HTTP, then try WebSocket for live updates
  useEffect(() => {
    // Load data immediately via HTTP
    console.log("📡 Loading initial data via HTTP");
    fetch("/api/data")
      .then(res => res.json())
      .then(data => {
        console.log("📦 Loaded initial data:", {
          cacheComponents: data.cache?.components.length,
          translationKeys: Object.keys(data.translations?.en || {}).length
        });
        setCache(data.cache);
        setTranslations(data.translations);
      })
      .catch(err => {
        console.error("❌ Failed to load data:", err);
      });

    // Try to connect WebSocket for live updates (non-blocking)
    try {
      const socket = new WebSocket(`ws://${window.location.host}`);

      socket.onopen = () => {
        console.log("✅ WebSocket connected for live updates");
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "cache-update") {
          console.log("📨 Cache updated");
          setCache(data.cache);
        } else if (data.type === "translations-update") {
          console.log("📨 Translations updated");
          setTranslations(data.translations);
        }
      };

      socket.onerror = () => {
        console.log("WebSocket unavailable, using HTTP only");
      };

      setWs(socket);

      return () => {
        socket.close();
      };
    } catch (err) {
      console.log("WebSocket not available, using HTTP only");
    }
  }, []);

  // Build translation list
  const translationList = useMemo(() => {
    if (!translations.en) return [];

    return Object.keys(translations.en).map(key => ({
      key,
      en: translations.en?.[key] || "",
      fr: translations.fr?.[key] || "",
    }));
  }, [translations]);

  // Filter translations by search query
  const filteredTranslations = useMemo(() => {
    if (!searchQuery) return translationList;

    const query = searchQuery.toLowerCase();
    return translationList.filter(t =>
      t.key.toLowerCase().includes(query) ||
      t.en.toLowerCase().includes(query) ||
      t.fr.toLowerCase().includes(query)
    );
  }, [translationList, searchQuery]);

  // Get components that use the selected key
  const componentsUsingKey = useMemo(() => {
    if (!selectedKey || !cache) return [];

    const componentPaths = cache.keyToComponents[selectedKey] || [];
    return cache.components.filter(c => componentPaths.includes(c.path));
  }, [selectedKey, cache]);

  // Filter components by search query (for component-first navigation)
  const filteredComponents = useMemo(() => {
    if (!cache) return [];

    const allComponents = cache.components;
    if (!searchQuery) return allComponents;

    const query = searchQuery.toLowerCase();
    return allComponents.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.path.toLowerCase().includes(query) ||
      c.translationKeys.some(key => key.toLowerCase().includes(query))
    );
  }, [cache, searchQuery]);

  // Group components by directory for tree view
  const groupedComponents = useMemo(() => {
    const groups = new Map<string, ComponentInfo[]>();

    filteredComponents.forEach(component => {
      // Extract directory from path (e.g., "src/components/Auth" from "src/components/Auth/Login.tsx")
      const pathParts = component.path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const directory = pathParts.slice(0, -1).join('/');

      if (!groups.has(directory)) {
        groups.set(directory, []);
      }
      groups.get(directory)!.push(component);
    });

    // Sort groups by path and components by name within each group
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dir, components]) => ({
        directory: dir,
        components: components.sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [filteredComponents]);

  const handleKeyClick = (key: string) => {
    setSelectedKey(key);
    setSelectedComponent(null);
  };

  const handleComponentClick = (component: ComponentInfo) => {
    setSelectedComponent(component);

    // Send message to server to render component
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "render-component",
        componentPath: component.path,
        selectedKey,
      }));
    }
  };

  const handleModeSwitch = (mode: NavigationMode) => {
    setNavigationMode(mode);
    // Reset selection when switching modes
    setSelectedKey(null);
    setSelectedComponent(null);
    setSearchQuery("");
  };

  const handleOpenInEditor = async (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering parent click handlers

    try {
      const response = await fetch("/api/open-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filePath }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to open file:", error);
        alert(`Failed to open file: ${error.error}`);
      }
    } catch (err) {
      console.error("Error opening file:", err);
      alert(`Error opening file: ${err}`);
    }
  };

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/refresh-cache", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh cache");
      }

      const data = await response.json();
      console.log("✅ Cache refreshed:", data.stats);

      // Update local cache - force re-render by creating new object
      setCache({ ...data.cache });

      // Update translations if they were returned
      if (data.translations) {
        setTranslations({ ...data.translations });
        console.log("✅ Translations reloaded");
      }

      // Clear any selections to show the updated list
      setSelectedKey(null);
      setSelectedComponent(null);
      setSearchQuery("");

      // Show success feedback
      alert(`Cache refreshed!\n\n${data.stats.components} components analyzed\n${data.stats.translationUsages} translation usages found\n${data.stats.translationKeys} translation keys loaded`);
    } catch (err) {
      console.error("Error refreshing cache:", err);
      alert(`Error refreshing cache: ${err}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBack = () => {
    isNavigatingRef.current = true;

    if (selectedComponent) {
      // Going back from component view
      if (navigationMode === "by-string" && selectedKey) {
        // In by-string mode with a key selected, go back to component list
        setSelectedComponent(null);
      } else {
        // In by-component mode, go back to component list
        setSelectedComponent(null);
        setSelectedKey(null);
      }
    } else if (selectedKey) {
      // Going back from key detail view to translation list
      setSelectedKey(null);
    }
  };

  // Loading state
  const isLoading = !cache || !translations.en;

  return (
    <div className="explorer">
      <header className="explorer-header">
        <div className="header-top">
          <div>
            <h1>Reactor</h1>
            <p>
              {navigationMode === "by-string"
                ? "Click on a translation to see which components use it"
                : "Click on a component to preview it"}
            </p>
          </div>
          <button
            className="refresh-button"
            onClick={handleRefreshCache}
            disabled={isRefreshing}
            title="Refresh component cache"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? "spinning" : ""}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-button ${navigationMode === "by-string" ? "active" : ""}`}
            onClick={() => handleModeSwitch("by-string")}
          >
            By String
          </button>
          <button
            className={`mode-button ${navigationMode === "by-component" ? "active" : ""}`}
            onClick={() => handleModeSwitch("by-component")}
          >
            By Component
          </button>
        </div>
      </header>

      <div className="explorer-content">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="loading-skeleton">
            <div className="skeleton-search"></div>
            <div className="skeleton-table">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-row"></div>
              ))}
            </div>
            <style>{`
              .loading-skeleton {
                animation: pulse 1.5s ease-in-out infinite;
              }
              .skeleton-search {
                height: 48px;
                background: #2a2a2a;
                border-radius: 8px;
                margin-bottom: 20px;
              }
              .skeleton-table {
                background: #242424;
                border-radius: 8px;
                padding: 15px;
              }
              .skeleton-row {
                height: 60px;
                background: #2a2a2a;
                border-radius: 4px;
                margin-bottom: 10px;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {/* Main list view - By String */}
        {!isLoading && navigationMode === "by-string" && !selectedKey && (
          <div className="translations-list">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search translations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <div className="stats">
                {filteredTranslations.length} / {translationList.length} translations
                {cache && ` • ${cache.components.length} components`}
              </div>
            </div>

            <div className="table-container">
              <table className="translations-table">
                <thead>
                  <tr>
                    <th className="col-key">Key</th>
                    <th className="col-en">English</th>
                    <th className="col-fr">Français</th>
                    <th className="col-usage">Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTranslations.map((t) => {
                    const usageCount = cache?.keyToComponents[t.key]?.length || 0;

                    return (
                      <tr
                        key={t.key}
                        onClick={() => handleKeyClick(t.key)}
                        className="translation-row"
                      >
                        <td className="col-key">
                          <code>{t.key}</code>
                        </td>
                        <td className="col-en">{t.en}</td>
                        <td className="col-fr">{t.fr}</td>
                        <td className="col-usage">
                          <span className="usage-badge">{usageCount}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main list view - By Component */}
        {!isLoading && navigationMode === "by-component" && !selectedComponent && (
          <div className="components-list">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <div className="stats">
                {cache ? (
                  <>
                    {filteredComponents.length} / {cache.components.length} components
                    {` • ${translationList.length} translations`}
                  </>
                ) : (
                  "Loading components..."
                )}
              </div>
            </div>

            <div className="components-tree">
              {groupedComponents.map(({ directory, components }) => (
                <div key={directory} className="component-group">
                  <div className="group-header">
                    <span className="folder-icon">📁</span>
                    <span className="group-path">{directory}</span>
                    <span className="group-count">({components.length})</span>
                  </div>
                  <div className="group-items">
                    {components.map((component) => (
                      <div
                        key={component.path}
                        onClick={() => handleComponentClick(component)}
                        className="component-item"
                      >
                        <div className="component-item-header">
                          <span className="component-icon">📄</span>
                          <span className="component-name">{component.name}</span>
                          {component.propsInterface && (
                            <span className="component-props-badge" title={component.propsInterface}>
                              Props
                            </span>
                          )}
                        </div>
                        <div className="component-item-meta">
                          <span
                            className="component-file-link"
                            onClick={(e) => handleOpenInEditor(component.path, e)}
                            title="Click to open in editor"
                          >
                            {component.path.split('/').pop()}
                          </span>
                          <span className="component-translation-count">
                            {component.translationKeys.length === 0 ? (
                              <span className="no-translations">No translations</span>
                            ) : (
                              <>{component.translationKeys.length} translation{component.translationKeys.length !== 1 ? 's' : ''}</>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Component list for selected key (in by-string mode) */}
        {navigationMode === "by-string" && selectedKey && !selectedComponent && (
          <div className="component-list">
            <button onClick={handleBack} className="back-button">
              ← Back to translations
            </button>

            <div className="selected-key-info">
              <h2>Components using: <code>{selectedKey}</code></h2>
              <div className="translations-preview">
                <div><strong>EN:</strong> {translations.en?.[selectedKey]}</div>
                <div><strong>FR:</strong> {translations.fr?.[selectedKey]}</div>
              </div>
            </div>

            <div className="components">
              {componentsUsingKey.length === 0 ? (
                <div className="empty-state">
                  No components found using this translation key
                </div>
              ) : (
                componentsUsingKey.map((component) => (
                  <div
                    key={component.path}
                    onClick={() => handleComponentClick(component)}
                    className="component-card"
                  >
                    <h3>{component.name}</h3>
                    <div
                      className="component-path clickable"
                      onClick={(e) => handleOpenInEditor(component.path, e)}
                      title="Click to open in editor"
                    >
                      {component.path}
                    </div>
                    {component.propsInterface && (
                      <div className="component-props">
                        Props: <code>{component.propsInterface}</code>
                      </div>
                    )}
                    <div className="component-keys">
                      Uses {component.translationKeys.length} translation(s)
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Component preview */}
        {selectedComponent && (
          <div className="component-preview">
            <button onClick={handleBack} className="back-button">
              ← Back to {navigationMode === "by-string" ? "components" : "component list"}
            </button>

            <div className="preview-header">
              <h2>{selectedComponent.name}</h2>
              <div
                className="preview-path clickable"
                onClick={(e) => handleOpenInEditor(selectedComponent.path, e)}
                title="Click to open in editor"
              >
                {selectedComponent.path}
              </div>
            </div>

            <div className="preview-container">
              <iframe
                src={`/preview-component?path=${encodeURIComponent(selectedComponent.path)}&key=${encodeURIComponent(selectedKey || "")}`}
                className="preview-frame"
                title="Component Preview"
              />
            </div>

            <div className="preview-info">
              <h3>Translation keys used:</h3>
              {!selectedComponent.translationKeys ? (
                <div className="empty-state">Loading...</div>
              ) : selectedComponent.translationKeys.length === 0 ? (
                <div className="empty-state">This component doesn't use any translations</div>
              ) : (
                <ul className="keys-list">
                  {selectedComponent.translationKeys.map(key => (
                    <li
                      key={key}
                      className={key === selectedKey ? "highlighted" : ""}
                    >
                      <code>{key}</code>
                      {key === selectedKey && <span className="current-badge">Current</span>}
                      {navigationMode === "by-component" && (
                        <div className="key-translations">
                          <div className="key-en">{translations.en?.[key]}</div>
                          <div className="key-fr">{translations.fr?.[key]}</div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
