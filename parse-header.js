const fs = require('fs');
const path = require('path');

/**
 * Robust UserScript Header Parser
 */
function parseUserScriptHeader(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const header = {};

    // Match all @key value lines
    const regex = /@(\w+)\s+(.+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        header[key] = value;
    }

    // Fallbacks
    if (!header.name) {
        // Remove .user.js or .js and replace dashes with spaces
        header.name = path.basename(filePath)
            .replace(/\.user\.js$/i, '')
            .replace(/\.js$/i, '')
            .replace(/-/g, ' ');
    }
    if (!header.description) header.description = 'No description provided';
    if (!header.author) header.author = 'Unknown';
    if (!header.version) header.version = '1.0.0';

    return {
        name: header.name,
        description: header.description,
        author: header.author,
        version: header.version,
        filename: path.basename(filePath)
    };
}

module.exports = { parseUserScriptHeader };