import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TranslationProvider } from "./context/TranslationContext";

const root = createRoot(document.getElementById("root")!);
root.render(
  <TranslationProvider>
    <App />
  </TranslationProvider>
);
