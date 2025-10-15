/**
 * Preview Loader - Dynamically loads and renders components
 * Uses Bun's native module loading instead of bundling
 */

import React, { useState } from "react";
import { createRoot } from "react-dom/client";

// Deserialize props (convert function markers back to functions)
function deserializeProps(props: any): any {
  function deserialize(value: any): any {
    if (value && typeof value === "object" && value.__type === "function") {
      const fn = (...args: any[]) => console.log(`Mock function called: ${value.__name}`, args);
      return fn;
    }
    if (Array.isArray(value)) {
      return value.map(deserialize);
    }
    if (value && typeof value === "object") {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = deserialize(val);
      }
      return result;
    }
    return value;
  }
  return deserialize(props);
}

// Determine if a prop type is editable
function isEditableProp(value: any): boolean {
  if (value === null || value === undefined) return false;
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
}

// Get the type name for display
function getTypeName(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object" && value.__type === "function") return "function";
  if (typeof value === "object") return "object";
  return typeof value;
}

// Props Panel Component
function PropsPanel({
  props,
  metadata,
  onPropChange
}: {
  props: Record<string, any>,
  metadata?: { enums: Record<string, { values: Array<{ name: string; value: string | number }> }> },
  onPropChange: (key: string, value: any) => void
}) {
  const [editingJson, setEditingJson] = React.useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = React.useState<Record<string, string>>({});

  const handleInputChange = (key: string, value: string, type: string) => {
    if (type === "number") {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        onPropChange(key, numValue);
      }
    } else if (type === "boolean") {
      onPropChange(key, value === "true");
    } else {
      onPropChange(key, value);
    }
  };

  const handleJsonChange = (key: string, jsonText: string) => {
    setEditingJson(prev => ({ ...prev, [key]: jsonText }));

    try {
      const parsed = JSON.parse(jsonText);
      setJsonErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
      onPropChange(key, parsed);
    } catch (err: any) {
      setJsonErrors(prev => ({ ...prev, [key]: err.message }));
    }
  };

  const renderPropValue = (key: string, value: any) => {
    const type = getTypeName(value);
    const isEditable = isEditableProp(value);
    const enumMetadata = metadata?.enums?.[key];

    // If this prop is an enum, render a dropdown
    if (enumMetadata && enumMetadata.values.length > 0) {
      return (
        <select
          className="prop-select"
          value={value}
          onChange={(e) => {
            const enumValue = enumMetadata.values.find(v => String(v.value) === e.target.value);
            if (enumValue) {
              onPropChange(key, enumValue.value);
            }
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "#1a1a1a",
            color: "#e0e0e0",
            border: "1px solid #333",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          {enumMetadata.values.map((enumValue) => (
            <option key={enumValue.name} value={enumValue.value}>
              {enumValue.name} ({JSON.stringify(enumValue.value)})
            </option>
          ))}
        </select>
      );
    }

    if (type === "string") {
      return (
        <input
          type="text"
          className="prop-input"
          value={value}
          onChange={(e) => handleInputChange(key, e.target.value, "string")}
        />
      );
    }

    if (type === "number") {
      return (
        <input
          type="number"
          className="prop-input"
          value={value}
          onChange={(e) => handleInputChange(key, e.target.value, "number")}
        />
      );
    }

    if (type === "boolean") {
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            className="prop-checkbox"
            checked={value}
            onChange={(e) => onPropChange(key, e.target.checked)}
          />
          <span>{value ? "true" : "false"}</span>
        </label>
      );
    }

    // Non-editable types: show as read-only
    if (type === "function") {
      return <div className="prop-value">{value.__name || "function"}</div>;
    }

    if (type === "array" || type === "object") {
      const jsonText = editingJson[key] ?? JSON.stringify(value, null, 2);
      const hasError = jsonErrors[key];

      return (
        <div>
          <textarea
            className="prop-json-input"
            value={jsonText}
            onChange={(e) => handleJsonChange(key, e.target.value)}
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              width: "100%",
              minHeight: "80px",
              padding: "8px",
              background: "#1a1a1a",
              color: hasError ? "#ff6b6b" : "#e0e0e0",
              border: hasError ? "1px solid #ff6b6b" : "1px solid #333",
              borderRadius: "4px",
              resize: "vertical",
            }}
          />
          {hasError && (
            <div style={{ color: "#ff6b6b", fontSize: "11px", marginTop: "4px" }}>
              Invalid JSON: {hasError}
            </div>
          )}
        </div>
      );
    }

    return <div className="prop-value">{String(value)}</div>;
  };

  const getDisplayTypeName = (key: string, value: any): string => {
    const enumMetadata = metadata?.enums?.[key];
    if (enumMetadata && Array.isArray(enumMetadata.values) && enumMetadata.values.length > 0) {
      // Check if it's a string enum or numeric enum
      const firstValue = enumMetadata.values[0]?.value;
      if (firstValue !== undefined) {
        return typeof firstValue === "string" ? "string enum" : "enum";
      }
    }
    return getTypeName(value);
  };

  return (
    <div>
      <h2>Props</h2>
      {Object.keys(props).length === 0 ? (
        <div style={{ color: "#666", fontSize: "13px" }}>No props</div>
      ) : (
        Object.entries(props).map(([key, value]) => (
          <div key={key} className="prop-item">
            <div className="prop-label">
              <span>{key}</span>
              <span className="prop-type">{getDisplayTypeName(key, value)}</span>
            </div>
            {renderPropValue(key, value)}
          </div>
        ))
      )}
    </div>
  );
}

// Render component
async function render() {
  try {
    const params = new URLSearchParams(window.location.search);
    const componentPath = params.get("path");

    if (!componentPath) {
      throw new Error("No component path specified");
    }

    console.log("⚡ Loading component:", componentPath);

    // Fetch configuration to know the source directory
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    console.log("Config loaded:", config);

    // Fetch props (lazy loaded)
    const propsResponse = await fetch(`/api/component-props?path=${encodeURIComponent(componentPath)}`);
    const propsData = await propsResponse.json();
    const serializedProps = propsData.props || {};
    const metadata = propsData.metadata || { enums: {} };
    const props = deserializeProps(serializedProps);

    console.log("Props loaded:", props);
    console.log("Metadata loaded:", metadata);

    // Dynamic import of the component
    // Use /~ prefix to avoid browser hostname confusion with absolute paths
    let importPath = componentPath;

    // Normalize Windows drive letter absolute paths:
    // 1. Backslash form: C:\\repo\\path -> /C:/repo/path
    // 2. Already forward form: C:/repo/path -> /C:/repo/path
    if (/^[A-Za-z]:\\/.test(importPath)) {
      importPath = importPath.replace(/\\/g, "/");
      importPath = "/" + importPath; // ensure leading slash
    } else if (/^[A-Za-z]:\//.test(importPath)) {
      // Already forward-slashed absolute path without leading slash
      importPath = "/" + importPath;
    }

    // Also normalize any remaining backslashes (defensive)
    importPath = importPath.replace(/\\/g, "/");

    // Add /~ prefix if it's an absolute filesystem path (now starting with /)
    if (importPath.startsWith('/') && !importPath.startsWith('/~')) {
      importPath = `/~${importPath}`;
    }

    // Remove any accidental duplicate /~ prefixes
    importPath = importPath.replace(/(\/~)+/g, "/~");

    console.log("Importing from:", importPath);

    const componentModule = await import(/* @vite-ignore */ importPath);
    const Component = componentModule.default;

    if (!Component) {
      throw new Error(`No default export found in ${componentPath}`);
    }

    console.log("✓ Component loaded!");

    // Dynamically import TranslationProvider with /~ prefix
    const translationContextPath = `/~${config.sourceDir}/context/TranslationContext`;
    const translationModule = await import(/* @vite-ignore */ translationContextPath);
    const TranslationProvider = translationModule.TranslationProvider;

    // Create a single root for the entire app container
    const appRoot = createRoot(document.getElementById("app-container")!);

    // Render the full app with state management
    function FullApp() {
      const [currentProps, setCurrentProps] = useState(props);

      const handlePropChange = (key: string, value: any) => {
        console.log(`Prop changed: ${key} =`, value);
        setCurrentProps((prev: Record<string, any>) => ({
          ...prev,
          [key]: value
        }));
      };

      return (
        <>
          <div id="props-panel">
            <PropsPanel props={currentProps} metadata={metadata} onPropChange={handlePropChange} />
          </div>
          <div id="preview-container">
            <div id="preview-root">
              <TranslationProvider>
                <Component {...currentProps} />
              </TranslationProvider>
            </div>
          </div>
        </>
      );
    }

    appRoot.render(<FullApp />);

    console.log("✓ Component rendered!");
  } catch (error: any) {
    console.error("❌ Error:", error);
    const target = document.getElementById("preview-root") || (() => {
      // Fallback: create a container if it doesn't exist yet
      const container = document.createElement("div");
      container.id = "preview-root";
      document.body.appendChild(container);
      return container;
    })();

    target.innerHTML = `
      <div style="background: #ff4444; color: white; padding: 20px; border-radius: 8px; margin: 20px; font-family: system-ui, sans-serif;">
        <h2 style="margin-top:0; font-size:18px;">Error Loading Component</h2>
        <div style="font-size:13px; line-height:1.4;">
          <strong>Message:</strong> ${error.message}
        </div>
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;">Stack Trace</summary>
          <pre style="white-space: pre-wrap; font-size:11px; background:#000; padding:10px; border-radius:4px; max-height:240px; overflow:auto;">${error.stack || "<no stack>"}</pre>
        </details>
      </div>
    `;
  }
}

// Run when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render);
} else {
  render();
}