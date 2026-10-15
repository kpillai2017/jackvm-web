#!/usr/bin/env node
/** Regenerate the checked-in embedded library from a local JackOS checkout.
 * Normal builds use the generated module and never need sibling repositories.
 * Only OS classes are read here: no games, assets or game folders are imported.
 */
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(root,'../jackos/src');
const files=await Promise.all((await readdir(source)).filter(name=>name.endsWith('.vm')).sort()
  .map(async name=>({name,source:await readFile(path.join(source,name),'utf8')})));
if(!files.length) throw Error('No OS VM classes found');
await writeFile(path.join(root,'web/builtin-os.js'),
  '/** Generated Jack OS bytecode library. See docs/OS_PROVENANCE.md before redistribution.\n * Regenerate with: node tools/embed-os.mjs [OS-source-directory]\n * This is the runtime standard library, not a collection of games. */\nexport const OS_FILES = '+JSON.stringify(files,null,2)+';\n');
console.log(`Embedded ${files.length} OS classes in web/builtin-os.js`);
