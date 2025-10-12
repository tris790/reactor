# Translation Debugger Optimization Log

## Goal
Reduce component preview loading from ~2000ms to ~50-100ms

## Status: ✅ WORKING
Component loading is now fast (~50-100ms) with full React hooks and styling support.

## What Worked
- ✅ Removed on-demand `Bun.build()` bundling (saved ~1500ms)
- ✅ Created `/src/**` route with `Bun.Transpiler` for on-the-fly transpilation
- ✅ Lazy props loading with caching via `/api/component-props`
- ✅ Direct HTTP data loading (removed WebSocket wait timeout)
- ✅ Added extensionless import resolution (`.tsx`, `.ts`, etc.)
- ✅ CSS as JS modules (inject `<style>` tags)
- ✅ JSON as ES modules (translations)
- ✅ Using production JSX runtime (`jsx-runtime.js`) instead of dev runtime
- ✅ Pinned CDN URLs with exact same URL across all modules (`pin=v135`)
- ✅ Global CSS import in preview HTML to ensure styles load

## What Didn't Work
- ❌ Import maps - Bun's HTML imports tried to resolve at build time
- ❌ Serving React from local node_modules - CommonJS format, browsers need ESM
- ❌ CDN without pinning - Multiple React instances caused `useContext` errors
- ❌ Auto JSX import source - Transpiler generated mangled names like `jsxDEV_7x81h0kn`
- ❌ Using `jsx-dev-runtime.js` from esm.sh - Doesn't export `jsxs`, only `jsxDEV` and `Fragment`
- ❌ Import maps with bare imports (`from "react"`) - Still causes multiple React instances, likely because:
  - Server-side transpilation happens before browser sees import map
  - Transpiled code may have full URLs baked in
  - Import map only works for runtime module resolution, not transpiled code

## Final Working Solution (2025-10-12)

### Issue 1: JSX Runtime Export Error
**Problem**: `jsxs` not exported from `jsx-dev-runtime.js`
- Error: `Uncaught SyntaxError: The requested module 'https://esm.sh/.../jsx-dev-runtime.js' doesn't provide an export named: 'jsxs'`

**Solution**: Use production JSX runtime instead
```javascript
// Changed from:
import { jsx, jsxs, jsxDEV, Fragment } from "react/jsx-dev-runtime"

// To:
import { jsx, jsxs, Fragment } from "react/jsx-runtime"
```

### Issue 2: Multiple React Instances
**Problem**: `useState` error - `can't access property "useState", l.current is null`
- Caused by different modules loading separate React instances from CDN
- Import maps don't work with server-side transpilation

**Solution**: Use exact same pinned CDN URLs in ALL transpiled files
```javascript
// All transpiled code now uses:
import React from "https://esm.sh/react@18.3.1?pin=v135";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?pin=v135&deps=react@18.3.1";
import { jsx, jsxs, Fragment } from "https://esm.sh/react@18.3.1/jsx-runtime?pin=v135";
```

**Key insights**:
- `pin=v135` ensures esm.sh serves the exact same build every time
- `deps=react@18.3.1` tells react-dom to use external React (shared instance)
- Server must rewrite imports during transpilation (import maps are too late)

### Issue 3: Missing Component Styles
**Problem**: Components loaded individually didn't have access to global CSS

**Solution**: Import global CSS in preview HTML
```html
<!-- In preview-v2.html -->
<script type="module">
  import "/src/index.css";
</script>
```

**How it works**:
- Server transpiles `.css` files to JS modules
- JS module creates `<style>` tag and appends to `<head>`
- Styles are available to all components in preview

## Implementation Files
- `translation-debugger/server.ts` (lines 156-177, 326-348): CDN URL rewriting
- `translation-debugger/preview-v2.html` (lines 36-38): Global CSS import
- All `/src/**` requests are transpiled on-the-fly with consistent CDN URLs

