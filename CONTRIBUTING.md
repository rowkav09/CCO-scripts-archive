# Contributing to CCO Scripts Archive

Thank you for wanting to contribute!

---

## How to Add a New Script

1. **Fork** this repository
2. Create a new file in the correct category folder:
    - `scripts/auto-farm/`
    - `scripts/gaming/`
    - `scripts/ui/`
    - `scripts/enhancements/`
    - `scripts/bots/`
    - `scripts/utilities/`
3. Name your file descriptively, e.g. `ultra-clicker.user.js`
4. Add the proper UserScript header (see template below)
5. Test your script on https://case-clicker.com/
6. Submit a **Pull Request**

---

## Script Requirements

- Must follow the **[Script Template](#script-header-template)**
- No malicious or obfuscated code
- Must work on the current version of Case Clicker Online
- Include clear configuration options at the top
- Add yourself as `@author` in the header

---

## Script Header Template

```js
// ==UserScript==
// @name         CCO - Your Script Name
// @namespace    https://github.com/rowkav09/CCO-scripts-archive
// @version      1.0.0
// @description  Short description of what it does
// @author       YourGitHubUsername
// @match        https://case-clicker.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/libs/utils.js (if needed)
// ==/UserScript==

(function() {
    'use strict';

    // Your code here

})();
