/** Supply the embedded Jack OS only when an uploaded program needs it.
 * User function definitions win; missing OS definitions are filled from the
 * built-in library. VM-only stack exercises remain OS-free and start at PC 0.
 * The CPU still executes the OS as bytecode: no native drawing/heap shortcuts.
 */
import {OS_FILES} from './builtin-os.js';
import {parseProgram} from './parser.js';
const definitions = source => [...source.matchAll(/^\s*function\s+([^\s/]+)\s+\d+/gm)].map(match=>match[1]);
const osFunctions = new Set(OS_FILES.flatMap(file=>definitions(file.source)));
export function linkProgram(files,options={}) {
  try {return {...parseProgram(files,options),builtinFiles:[]};}
  catch(error) {
    if(!error.missingFunctions?.some(name=>osFunctions.has(name))) throw error;
  }
  const provided = new Set(files.flatMap(file=>definitions(file.source)));
  const builtins=[];
  for(const file of OS_FILES) {
    // Each declaration and its body stays together, preserving local label scope.
    const blocks=file.source.split(/(?=^function\s)/m);
    const source=blocks.filter(block=>{
      const name=definitions(block)[0];
      return name && !provided.has(name) && (name!=='Sys.init' || provided.has('Main.main'));
    }).join('');
    if(source.trim()) builtins.push({name:`$Builtin$${file.name}`,source,
      // Private parser metadata keeps statics shared with any user override.
      staticNamespace:file.name.slice(0,-3),builtin:true});
  }
  const combined=[...[...files].sort((a,b)=>a.name.localeCompare(b.name)),...builtins];
  // Put user scripts before library declarations. Stop script fallthrough at the
  // library boundary; a top-level file has no caller frame for an OS return.
  if(!provided.has('Main.main') && !provided.has('Sys.init')) {
    const initialize=['Memory.init','Math.init','Screen.init','Output.init','Keyboard.init']
      .map(name=>`call ${name} 0\npop temp 0`).join('\n');
    combined[0]={...combined[0],source:initialize+'\n'+combined[0].source};
    const last=combined[files.length-1];
    combined[files.length-1]={...last,source:last.source+'\ncall Sys.halt 0\n'};
  }
  const program=parseProgram(combined,{...options,preserveFileOrder:true});
  return {...program,builtinFiles:builtins};
}
