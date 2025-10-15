# Translation Debugger - Quick Start Guide

## Starting the Tool

```bash
bun run translation-debugger
```

The server will start at **http://localhost:3456**

## What You'll See

### Initial Analysis (First Run)
```
🚀 Starting Translation Debugger Server...
✅ Loaded translations
🔍 Analyzing project for translation usage...
Found 10 source files
✅ Analysis complete in 432ms
   Found 24 translation usages in 6 components
💾 Saved cache to .translation-cache.json
👀 Watching for file changes...

✨ Translation Debugger running at http://localhost:3456

📊 Stats:
   - 21 translation keys
   - 6 components analyzed
   - 24 translation usages found

🔄 Watching for changes...
```

## How Translators Use It

### Step 1: Browse Translations
- Open http://localhost:3456 in your browser
- You'll see a table with all translation keys
- Columns show: **Key**, **English**, **Français**, and **Usage Count**
- Use the search bar to filter translations

### Step 2: Find Where a Translation is Used
- Click on any translation key (e.g., `nav.library`)
- You'll see all components that use that key
- Each component card shows:
  - Component name
  - File path
  - Props interface
  - Number of translations used

### Step 3: Preview the Component
- Click on a component to see it rendered
- The component appears in an isolated sandbox
- The selected translation key is highlighted (if visible)
- You can see the generated props used to render it

### Step 4: Navigate Back
- Use the "← Back" buttons to navigate up
- Changes to source files or translations are reflected live

## Performance Features

### ⚡ Lightning Fast
- Initial analysis: ~1-2 seconds for large projects
- **O(1) lookups** via indexed cache
- No database installation required

### 🔄 Live Updates
- Edit source files → automatically re-analyzes
- Edit translation JSON files → instantly updates UI
- WebSocket pushes changes to browser in real-time

### 💾 Smart Caching
- Creates `.translation-cache.json` for instant startup
- Incremental updates only re-parse changed files
- Cache includes version detection

## Cache File

The tool creates `.translation-cache.json` in your project root:

```json
{
  "version": "1.0.0",
  "timestamp": 1728648000000,
  "translationUsages": [
    {
      "key": "nav.library",
      "componentPath": "/path/to/Navigation.tsx",
      "componentName": "Navigation",
      "line": 18,
      "column": 18
    }
  ],
  "components": [...],
  "keyToComponents": {...},
  "componentToKeys": {...}
}
```

### Cache Management
- **Delete to rebuild**: `rm .translation-cache.json`
- **Add to .gitignore**: If you prefer fresh builds
- **Commit it**: For faster team startup times

## Troubleshooting

### Port Already in Use
If port 3456 is taken, edit `translation-debugger/server.ts`:
```typescript
const PORT = 3456; // Change this number
```

### Component Not Rendering
- Check browser console for errors
- Verify the component exports correctly
- Ensure all prop types are supported

### Translations Not Found
- Verify translation files are in `translations/en.json` and `translations/fr.json`
- Check that components use the `t("key")` pattern
- Restart the server to rebuild the cache

### File Watcher Not Working
- Some systems have file watch limits
- Try manually restarting after making changes
- On Linux, increase watches: `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`

## What Gets Analyzed

### Supported Translation Patterns
Currently supports:
```typescript
const { t } = useTranslation();
t("translation.key")
```

### Supported Component Types
- Function components
- Arrow function components
- Default exports
- Named exports

### Supported Prop Types
The prop generator handles:
- Primitives (string, number, boolean)
- Functions (with or without parameters)
- Arrays
- Objects (inline types)
- Type references
- Union types (`"library" | "settings"`)
- Literal types

## Example Workflow

**Translator's Perspective:**
1. Product owner asks: "Where is the 'Upload' button text shown?"
2. Translator opens http://localhost:3456
3. Searches for "upload" in the search bar
4. Finds `upload.button` with translation "Upload" / "Télécharger"
5. Clicks it to see it's used in `VideoUpload` component
6. Clicks `VideoUpload` to see the button rendered in context
7. Confidently updates the translation knowing exactly where it appears

**Before this tool:**
- Grep through code files
- Try to understand React components
- Maybe find the right component, maybe not
- Update translation and hope it's correct

**With this tool:**
- Visual confirmation in ~30 seconds
- See the actual UI component
- Know exactly what you're translating

## API Endpoints

For programmatic access:

### Get All Data
```bash
curl http://localhost:3456/api/data
```

Returns complete cache and all translations.

### Get Component Props
```bash
curl "http://localhost:3456/api/component?path=/path/to/Component.tsx"
```

Returns component info and generated props.

## Future Enhancements

Planned features:
- Support for more i18n libraries (i18next, react-intl)
- Screenshot export for documentation
- Translation coverage reports
- Visual regression testing
- Multi-language support (beyond EN/FR)
- Pluralization and formatting preview
