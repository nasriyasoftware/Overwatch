[![N|Solid](https://static.wixstatic.com/media/72ffe6_da8d2142d49c42b29c96ba80c8a91a6c~mv2.png)](https://nasriya.net)

# Overwatch.
[![NPM License](https://img.shields.io/npm/l/%40nasriya%2Foverwatch?color=lightgreen)](https://github.com/nasriyasoftware/Overwatch?tab=License-1-ov-file) ![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nasriyasoftware/Overwatch/npm-publish.yml) ![NPM Version](https://img.shields.io/npm/v/%40nasriya%2Foverwatch) ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nasriya%2Foverwatch) ![Last Commit](https://img.shields.io/github/last-commit/nasriyasoftware/Overwatch.svg) [![Status](https://img.shields.io/badge/Status-Stable-lightgreen.svg)](link-to-your-status-page)

##### Visit us at [www.nasriya.net](https://nasriya.net).

Made with ❤️ in **Palestine** 🇵🇸
___
#### Overview
Overwatch is a fast, reliable, and efficient file system watcher built with TypeScript. It supports flexible filtering using globs and regexes, making it ideal for scalable, cross-platform file monitoring with minimal resource usage.

> [!IMPORTANT]
> 
> 🌟 **Support Our Open-Source Development!** 🌟
> We need your support to keep our projects going! If you find our work valuable, please consider contributing. Your support helps us continue to develop and maintain these tools.
> 
> **[Click here to support us!](https://fund.nasriya.net/)**
> 
> Every contribution, big or small, makes a difference. Thank you for your generosity and support!
___
### Installation
```shell
npm i @nasriya/overwatch
```

### Importing
Import in **ES6** module
```ts
import overwatch from '@nasriya/overwatch';
```

Import in **CommonJS (CJS)**
```js
const overwatch = require('@nasriya/overwatch').default;
```
___

## Usage

### 1. Defining watchers

##### 📁 Watching Directories (Folders)
Use `overwatch.watchFolder()` (recommended) or `overwatch.watch()` to watch a directory. You can optionally provide filters to include or exclude specific paths:

```ts
// Strongly recommended: use `watchFolder` for directories
const projectWatcher = await overwatch.watchFolder(process.cwd(), {
   include: ['**/*.ts'], // Accepts globs, regex, or absolute paths
   exclude: [/node_modules/, '**/*.test.ts'],
});
```

Or without watching options:
```ts
const projectWatcher = await overwatch.watchFolder(process.cwd());
```

##### 📄 Watching Files
You can also watch indivisual files:

```ts
const fileWatcher = await overwatch.watchFile('src/config.json');
```

### 2. Handling events
You can attach a general handler for all change events:

```ts
// Handles all the watcher's events
projectWatcher.onChange(({ type, event }) => {
    // Handle different event types
    switch (type) {
        case 'add':
            console.log(`Added ${event.type}: ${event.path}`);
            break;
        case 'remove':
            console.log(`Removed ${event.type}: ${event.path}`);
            break;
        case 'rename':
            console.log(`Renamed ${event.type}: ${event.oldPath} -> ${event.newPath}`);
            break;
        case 'update':
            console.log(`Updated ${event.type}: ${event.path}`);
            break;
        case 'rootRemoved':
            console.log(`Watcher root was deleted`);
            break;
    }

    // NOTE: `event.type` is the type of the changed item, either `File` or `Folder`
});
```

Or, register dedicated handlers for specific events:

```ts
projectWatcher.onAdd((path) => {
   console.log(`Added: ${path}`);
});

projectWatcher.onRemove((event) => {
   console.log(`${event.type} removed: ${event.path}`);
});

projectWatcher.onRename((event) => {
   console.log(`${event.type} renamed: ${event.oldPath} -> ${event.newPath}`);
});

projectWatcher.onUpdate((event) => {
   console.log(`${event.type} updated: ${event.path}`);
});
```

You can also pass the handlers when you create the watcher:
```ts
const projectWatcher = await overwatch.watchFolder(process.cwd(), {
   include: ['**/*.ts'], // Accepts globs, regex, or absolute paths
   exclude: [/node_modules/, '**/*.test.ts'],
   onRename: (event) => {
        console.log(`${event.type} renamed: ${event.oldPath} -> ${event.newPath}`);
   }
});
```

### 3. Handling Root Deletion
If the root directory being watched is deleted, a special event is triggered:

```ts
projectWatcher.onRootRemoved(() => {
   console.log('The watched directory was deleted.');
});
```

### Notes

- ✅ `include` and `exclude` accept absolute paths, glob patterns (e.g., `'**/*.ts'`), and regular expressions (e.g., `/\.test\.ts$/`).
- ✅ Prefer `watchFolder()` and `watchFile()` over the general `watch()` method for clearer intent and improved readability.
- 📌 All watchers share a single internal engine — multiple watchers on the same path won't trigger redundant scans.
- ⚠️ Filters (`include`, `exclude`) do **not** impact scanning performance; they only determine which changes are **emitted to the user**.
- 📁 `event.type` refers to the type of the changed item — either `'File'` or `'Folder'`.
- 🧠 Each watcher allows **only one handler per event type** — setting a new handler (e.g., via `onChange`) will **replace** the previous one.
- 🚫 If the **root directory** being watched is deleted, the watcher is automatically removed, and a `rootRemoved` event is emitted.
- ℹ️ The **root** is always a directory — even when watching a file, the root refers to its **parent folder**.


___
## License
This software is licensed under the **Nasriya Open License (NOL)**, version 1.0.
Please read the license from [here](https://github.com/nasriyasoftware/Overwatch?tab=License-1-ov-file).