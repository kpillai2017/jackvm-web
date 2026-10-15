#!/usr/bin/env node
/** Ship the application with embedded Jack OS and GPL-2.0 Sokoban plus matching source.
 * Recreate dist so an old game-containing build cannot survive a new build.
 * Use a positive asset whitelist; never recursively copy the project root.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'dist');
if(process.argv.length>2) throw Error('No packaging flags are supported; Sokoban is the bundled default program.');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(path.join(out,'web'),{recursive:true});
for(const name of ['index.html','styles.css','theme.css','README.md','LICENSE','docs','games','corresponding-source'])
  fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'web')).filter(name=>/\.(js|wasm)$/.test(name)))
  fs.copyFileSync(path.join(root,'web',name),path.join(out,'web',name));
if(!fs.existsSync(path.join(out,'web/runtime.wasm'))) throw Error('Compile WASM first: npm run build');
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Built player with embedded Jack OS and preloaded Sokoban, including corresponding source.');
