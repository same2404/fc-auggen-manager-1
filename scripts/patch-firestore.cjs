const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/@firebase/firestore/dist/common-08af0b07.rn.js',
  'node_modules/@firebase/firestore/dist/common-091f2944.esm.js',
  'node_modules/@firebase/firestore/dist/common-1ab68354.node.cjs.js',
  'node_modules/@firebase/firestore/dist/intermediate/common-3e30743d.js',
  'node_modules/firebase/firebase-firestore.js',
  'node_modules/.vite/deps/firebase_firestore.js'
];

let totalPatched = 0;

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Minified version with space: this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0, 3241
  if (content.includes('this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0, 3241')) {
    content = content.replace(
      /this\.ve\s*-=\s*1,\s*__PRIVATE_hardAssert\(this\.ve\s*>=\s*0,\s*3241/g,
      'this.ve = Math.max(0, this.ve - 1), __PRIVATE_hardAssert(this.ve >= 0, 3241'
    );
    modified = true;
  }

  // Minified version without space: this.ve-=1,__PRIVATE_hardAssert(this.ve>=0,3241
  if (content.includes('this.ve-=1,__PRIVATE_hardAssert(this.ve>=0,3241')) {
    content = content.replace(
      /this\.ve-=1,__PRIVATE_hardAssert\(this\.ve>=0,3241/g,
      'this.ve=Math.max(0,this.ve-1),__PRIVATE_hardAssert(this.ve>=0,3241'
    );
    modified = true;
  }

  // Unminified version: hardAssert(this.pendingResponses >= 0, 0x0ca9
  if (content.includes('this.pendingResponses -= 1;\n        hardAssert(this.pendingResponses >= 0, 0x0ca9')) {
    content = content.replace(
      /this\.pendingResponses\s*-=\s*1;\s*hardAssert\(this\.pendingResponses\s*>=\s*0,\s*0x0ca9/g,
      'this.pendingResponses = Math.max(0, this.pendingResponses - 1); hardAssert(this.pendingResponses >= 0, 0x0ca9'
    );
    modified = true;
  } else if (content.includes('this.pendingResponses -= 1;        hardAssert(this.pendingResponses >= 0, 0x0ca9')) {
    content = content.replace(
      'this.pendingResponses -= 1;        hardAssert(this.pendingResponses >= 0, 0x0ca9',
      'this.pendingResponses = Math.max(0, this.pendingResponses - 1);        hardAssert(this.pendingResponses >= 0, 0x0ca9'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalPatched++;
    console.log(`[patch-firestore] Successfully applied fix to: ${relPath}`);
  }
}

console.log(`[patch-firestore] Patch check completed. Total files patched in this run: ${totalPatched}`);
