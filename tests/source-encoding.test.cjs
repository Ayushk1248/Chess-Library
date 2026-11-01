const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('application source is valid UTF-8 for the Next.js compiler', () => {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const root = path.resolve(__dirname, '..');
  function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) check(filename);
      else if (/\.(tsx?|css|sql|cjs)$/.test(entry.name)) {
        assert.doesNotThrow(() => decoder.decode(fs.readFileSync(filename)),
          `${path.relative(root, filename)} must be saved as UTF-8`);
      }
    }
  }
  for (const directory of ['app', 'components', 'lib', 'supabase', 'tests']) {
    check(path.join(root, directory));
  }
});
