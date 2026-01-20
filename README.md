# Drag from Web Content - Zen Browser Mod

A Zen Browser mod that allows you to drag the browser window from the top portion of web content, similar to Arc Browser's window dragging feature.

## Features

✨ **Intuitive Window Dragging** - Drag your browser window from the top of any web page  
🎯 **Smart Interactive Element Detection** - Automatically avoids interfering with clickable elements  
📏 **Configurable Height** - Adjust the draggable area height  
🎮 **Drag Threshold** - Requires slight movement before dragging (prevents accidental drags)  
⚡ **Performance Optimized** - No visual overlays, direct event handling  
🔧 **Highly Configurable** - Multiple preferences to customize behavior

## Installation

### Using Zen Mods (Recommended)

1. Copy the `drag-from-webcontent` folder to:
   - **Windows**: `%APPDATA%\zen\Profiles\*.default-release\chrome\sine-mods\`
   - **macOS**: `~/Library/Application Support/zen/Profiles/*.default-release/chrome/sine-mods/`
   - **Linux**: `~/.zen/*.default-release/chrome/sine-mods/`

2. Restart Zen Browser

3. The mod will be automatically loaded

## Configuration

### Available Preferences

Access via `about:config`:

| Preference | Type | Default | Description |
|------------|------|---------|-------------|
| `zen.dragwebcontent.enabled` | Boolean | `true` | Enable/disable the mod |
| `zen.dragwebcontent.height` | Integer | `60` | Height of draggable area in pixels |
| `zen.dragwebcontent.drag-threshold` | Integer | `5` | Movement required before drag starts (pixels) |
| `zen.dragwebcontent.disable-in-fullscreen` | Boolean | `true` | Disable dragging in fullscreen mode |

### Recommended Settings

**For minimal interference:**
```
height = 40
drag-threshold = 10
```

**Balanced (default):**
```
height = 60
drag-threshold = 5
```

**Maximum usability:**
```
height = 100
drag-threshold = 3
```

## Usage

1. **Drag from Web Content**: Click near the top of any web page and move your mouse slightly
2. **Threshold**: The browser window will start dragging after you move ~5 pixels
3. **Interactive Elements**: Links, buttons, and other clickable elements work normally

## How It Works

### Strategy for Handling Interactive Elements

This mod uses a clever overlay + point-check approach to avoid interfering with web page functionality:

#### 1. **Transparent Overlay**
- A transparent div is positioned at the top of each browser tab
- Height is configurable (default: 60px)
- Zero visual footprint - completely invisible
- Captures mousedown events in the draggable zone

#### 2. **Point-Check on Click**
When you click on the overlay:
```javascript
// Get the element underneath the overlay at click position
const elementUnderneath = document.elementFromPoint(x, y);

// Check if it's interactive
if (isInteractive(elementUnderneath)) {
  // Pass the click through to the element
  dispatchClickEvent(elementUnderneath);
} else {
  // Start window drag
  beginWindowDrag();
}
```

#### 3. **Interactive Element Detection**
Before starting a drag, the mod checks if the element underneath is:
- Links (`<a>`)
- Buttons (`<button>`)
- Form inputs (`<input>`, `<textarea>`, `<select>`)
- Media elements (`<video>`, `<audio>`, `<canvas>`)
- Elements with `role` attributes (ARIA)
- Elements with click handlers (`[onclick]`)
- Contenteditable elements
- Elements with `cursor: pointer` style
- Parent elements (up to 3 levels deep)

If any of these are detected, the click is passed through to the element.

#### 4. **Drag Threshold**
The mod requires you to move your mouse a small distance (default: 5px) before starting the drag. This:
- Prevents accidental drags when you just want to click
- Allows clicks on interactive elements to work normally
- Provides a more intentional drag experience

### Technical Implementation

1. **Overlay Creation**: Creates transparent overlay for each browser tab
2. **Event Capture**: Overlay captures mousedown events
3. **Point-Check**: Uses `elementFromPoint()` to check what's underneath
4. **Smart Filtering**: Checks if underlying element is interactive
5. **Event Passing**: Re-dispatches events to interactive elements
6. **Threshold Tracking**: Monitors mouse movement before initiating drag
7. **Window Drag**: Calls `window.beginWindowMove()` API

## Compatibility

- ✅ Works with Zen's vertical tabs
- ✅ Works with Zen's split view
- ✅ Works with Zen's compact mode
- ✅ Works in private browsing mode
- ✅ Works across multiple windows
- ✅ Compatible with all web content
- ✅ e10s (multi-process) compatible

## Troubleshooting

### Mod Not Working

**Check if loaded:**
1. Open Browser Console (Ctrl+Shift+J)
2. Look for `[DragFromWebContent] Initializing`

**Verify preferences:**
```
about:config → zen.dragwebcontent.enabled = true
```

**Restart browser:**
- Completely close and reopen Zen Browser

### Dragging Not Starting

**Issue**: Clicking at top of page doesn't drag

**Solutions:**
1. **Move your mouse**: The threshold requires ~5px of movement
2. **Check height**: Try increasing `zen.dragwebcontent.height` to 100
3. **Avoid interactive elements**: Make sure you're not clicking on links/buttons
4. **Reduce threshold**: Set `zen.dragwebcontent.drag-threshold` to 3

### Still Interfering with Web Content

**Issue**: Can't click on elements at top of page

**This shouldn't happen with the smart detection, but if it does:**
1. **Reduce height**: Set `zen.dragwebcontent.height` to 30-40
2. **Increase threshold**: Set `zen.dragwebcontent.drag-threshold` to 10
3. **Check console**: Look for errors in Browser Console

### Dragging Feels Laggy

**Solutions:**
1. Reduce threshold to 3px for faster response
2. Check if you have many tabs open (may affect performance)
3. Ensure no other extensions are interfering

## Advanced Customization

### Adjust for High-DPI Displays

For 4K displays or high-DPI screens:
```
zen.dragwebcontent.height = 80-100
zen.dragwebcontent.drag-threshold = 8-10
```

### Minimal Interference Mode

For sites with lots of top-bar interactions:
```
zen.dragwebcontent.height = 30
zen.dragwebcontent.drag-threshold = 15
```

### Aggressive Drag Mode

For maximum draggability:
```
zen.dragwebcontent.height = 120
zen.dragwebcontent.drag-threshold = 2
```

## Known Limitations

1. **Maximized Windows**: Dragging from a maximized window will first unmaximize it (standard browser behavior)
2. **Fullscreen Mode**: Disabled by default in fullscreen (configurable)
3. **Some Web Apps**: Complex web apps with custom event handlers might occasionally interfere
4. **Linux Wayland**: May have limited support due to compositor restrictions

## Technical Details

### Why This Approach?

**Alternative approaches considered:**

1. **CSS Overlay** (not used)
   - ❌ Creates visual element that can interfere
   - ❌ Z-index conflicts
   - ❌ Pointer-events complications

2. **Global Event Capture** (not used)
   - ❌ Can interfere with all web content
   - ❌ Hard to filter correctly

3. **Smart Event Capture** (chosen) ✅
   - ✅ No visual elements
   - ✅ Precise interactive element detection
   - ✅ Threshold prevents accidents
   - ✅ Works seamlessly with web content

### Browser APIs Used

- `browser.messageManager` - e10s-compatible messaging
- `window.beginWindowMove()` - Modern window drag API
- Frame scripts - Content-side event handling
- `Services.prefs` - Firefox preferences system

## Uninstallation

1. Delete the `drag-from-webcontent` folder from `sine-mods/`
2. Restart Zen Browser
3. (Optional) Reset preferences in `about:config`

## Development

### Debug Mode

Enable detailed logging:
1. Browser Console (Ctrl+Shift+J)
2. Filter: `DragFromWebContent`

### Testing Interactive Element Detection

1. Set threshold to 0 for immediate feedback
2. Try clicking various elements at top of pages
3. Check console for debug messages

## Support

- **Issues**: Report on GitHub
- **Questions**: Zen Browser Discord/Community
- **Documentation**: See this README

## License

Mozilla Public License 2.0 (MPL-2.0)

## Credits

- **Inspired by**: Arc Browser's drag-from-content feature
- **Built for**: [Zen Browser](https://zen-browser.app)
- **Author**: Zen Community

---

**Drag your Zen Browser windows from web content without interfering with page interactions!** 🎉
