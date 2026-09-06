# Sticky Notes

A lightweight Chrome extension for keeping useful notes close to the websites where you found them.

Sticky Notes helps you capture ideas, quotes, links, and small tasks while browsing, then find them again by site, category, tag, or favorite status.

## Highlights

- Write and format notes directly in the browser
- Associate notes with the current website
- Filter notes by the current site
- Create your own categories
- Add multiple tags with Space, Enter, or comma
- Mark important notes as favorites
- Save selected page text from the right-click menu
- Export and restore notes with JSON backups
- Undo accidental deletions
- Sync notes through Chrome storage

## Preview

![Main menu](SS%20uri%20pt%20chrome/Meniul%20Principal.png)

![Note editor](SS%20uri%20pt%20chrome/Nota%20Maldive.png)

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Publish

The extension is packaged for Chrome Web Store distribution as `StickyNotes-extension.zip`. The ZIP must contain `manifest.json` at its root.

## Privacy

Sticky Notes uses Chrome's `storage` permission to save notes and preferences, `tabs` to identify the current website, and `contextMenus` to save selected text from a page. No external account or analytics service is included.

## Tech

Built with Manifest V3, vanilla JavaScript, HTML, and CSS.

## License

MIT License

Copyright (c) 2026 RhadooToma

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TITLE, AND OTHERWISE, IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
