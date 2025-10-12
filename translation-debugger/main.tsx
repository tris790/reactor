/**
 * Main entry point for the Translation Debugger UI
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { TranslationExplorer } from "./ui";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<TranslationExplorer />);
} else {
  console.error("Root element not found");
}
