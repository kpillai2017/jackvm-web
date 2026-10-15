/**
 * A two-pass assembler/linker for the standard nand2tetris VM language.
 * Pass one validates source, scopes labels and assigns class-local statics.
 * Pass two resolves symbolic branches/calls into numeric instruction addresses.
 * Keeping text handling outside WASM makes diagnostics pleasant without putting
 * the execution hot loop in JavaScript. Every linked record contains four i32s.
 */
export const OPCODES = Object.freeze({push:0, pop:1, add:2, sub:3, neg:4, eq:5,
  gt:6, lt:7, and:8, or:9, not:10, goto:11, 'if-goto':12, function:13, call:14, return:15});
const SEGMENTS = {constant:0, local:1, argument:2, this:3, that:4, temp:5, pointer:6, static:7};
const HOOKS = new Map([['Clock.supported',[16,0]], ['Clock.now',[17,0]],
  ['Sys.halt',[18,0]], ['Sys.error',[19,1]]]);
const SYMBOL = /^[A-Za-z_.$:][A-Za-z0-9_.$:]*$/;
const own = (object, key) => Object.hasOwn(object, key);

export function parseProgram(files, {entry = 'auto', preserveFileOrder = false} = {}) {
  if (!Array.isArray(files) || !files.length) throw new Error('Choose at least one .vm file.');
  const commands = [], locations = [], functions = new Map(), labels = new Map();
  const staticSlots = new Map(), names = new Set();
  const fail = (location, message) => { throw new Error(`${location.file}:${location.line}: ${message}`); };
  const symbol = (value, loc) => { if (!SYMBOL.test(value ?? '')) fail(loc, `Invalid symbol: ${value}`); return value; };
  const number = (value, loc) => {
    if (!/^\d+$/.test(value ?? '') || Number(value) > 32767) fail(loc, `Expected integer 0..32767, got ${value}`);
    return Number(value);
  };
  // Sort filenames so static allocation does not depend on browser directory order.
  const orderedFiles = preserveFileOrder ? files : [...files].sort((a,b) => a.name.localeCompare(b.name));
  for (const file of orderedFiles) {
    if (typeof file.name !== 'string' || !/\.vm$/i.test(file.name) || typeof file.source !== 'string')
      throw new Error('Every input must have a .vm filename and text source.');
    const basename = file.name.split(/[\\/]/).pop();
    const nameKey = basename.toLowerCase();
    if (names.has(nameKey)) throw new Error(`Duplicate VM filename: ${basename}. Select one program, not several games.`);
    names.add(nameKey);
    const className = file.staticNamespace ?? basename.slice(0,-3);
    symbol(className, {file:file.name,line:1});
    let scope = `file:${className}`;
    const lines = file.source.replace(/^\uFEFF/,'').split(/\r?\n/);
    // Conventional VM files own their statics by filename. Some companion tools
    // concatenate entire classes into one file (e.g. JackOS.vm). In that case,
    // preserve the original classes from function prefixes instead of aliasing
    // Math.static 0, Memory.static 0 and Output.static 0 to one RAM word.
    const classes = new Set(lines.map(line => line.split('//')[0].trim()
      .match(/^function\s+([A-Za-z_.$:][A-Za-z0-9_.$:]*)\s+/)?.[1]?.split('.')[0]).filter(Boolean));
    const mergedClasses = classes.size > 1;
    let staticClass = className;
    for (let line = 0; line < lines.length; line++) {
      const text = lines[line].split('//')[0].trim();
      if (!text) continue;
      const loc = {file: file.name, line: line+1, text};
      const parts = text.split(/\s+/), [op, first, second] = parts;
      const arity = op === 'push' || op === 'pop' || op === 'function' || op === 'call' ? 3
        : op === 'label' || op === 'goto' || op === 'if-goto' ? 2 : 1;
      if (op !== 'label' && !own(OPCODES, op)) fail(loc, `Unknown command ${op}`);
      if (parts.length !== arity) fail(loc, `${op} expects ${arity-1} operand(s)`);
      if (op === 'label') {
        symbol(first,loc);
        const key = JSON.stringify([scope,first]);
        if (labels.has(key)) fail(loc, `Duplicate label ${first}`);
        labels.set(key, commands.length); continue;
      }
      const cmd = {op, scope, loc, a:0, b:0, segment:0};
      if (op === 'function') {
        symbol(first,loc); cmd.a = number(second,loc); scope = `function:${first}`; cmd.scope = scope;
        if (functions.has(first)) fail(loc, `Duplicate function ${first}`);
        functions.set(first,commands.length);
        staticClass = mergedClasses ? first.split('.')[0] : className;
      } else if (op === 'call') {
        cmd.target = symbol(first,loc); cmd.b = number(second,loc);
      } else if (op === 'goto' || op === 'if-goto') {
        cmd.target = JSON.stringify([scope,symbol(first,loc)]);
      } else if (op === 'push' || op === 'pop') {
        if (!own(SEGMENTS,first)) fail(loc, `Unknown segment ${first}`);
        cmd.segment = SEGMENTS[first]; cmd.a = number(second,loc);
        if (op === 'pop' && first === 'constant') fail(loc, 'Cannot pop constant');
        if (first === 'pointer' && cmd.a > 1) fail(loc,'Pointer index must be 0 or 1');
        if (first === 'temp' && cmd.a > 7) fail(loc,'Temp index must be 0..7');
        if (first === 'static') {
          if (cmd.a > 239) fail(loc,'Static index must be 0..239');
          const key = `${staticClass}:${cmd.a}`;
          if (!staticSlots.has(key)) staticSlots.set(key, 16 + staticSlots.size);
          if (staticSlots.size > 240) fail(loc,'Static variables exceed RAM 16..255');
          cmd.a = staticSlots.get(key);
        }
      }
      commands.push(cmd); locations.push(loc);
      // Return addresses are stored in 16-bit RAM; 65535 is the bootstrap sentinel.
      if (commands.length > 65534) fail(loc,'Program exceeds 65534 linked instructions');
    }
  }
  if (!commands.length) throw new Error('No executable VM instructions found.');
  // Report the whole missing dependency set, not one function per upload attempt.
  const unresolved = commands.filter(cmd => cmd.op === 'call' && !HOOKS.has(cmd.target) && !functions.has(cmd.target));
  if (unresolved.length) {
    const missingFunctions = [...new Set(unresolved.map(cmd => cmd.target))].sort();
    const missingClasses = [...new Set(missingFunctions.map(name => name.split('.')[0]))];
    const first = unresolved[0];
    const error = new Error(`${first.loc.file}:${first.loc.line}: Unresolved function ${first.target}. Missing classes: ${missingClasses.join(', ')}. Add their .vm files (or the folder containing your OS).`);
    error.missingFunctions = missingFunctions;
    error.missingClasses = missingClasses;
    throw error;
  }
  const instructions = new Int32Array(commands.length * 4);
  commands.forEach((cmd, i) => {
    let opcode = OPCODES[cmd.op], a = cmd.a;
    if (cmd.op === 'call') {
      const hook = HOOKS.get(cmd.target);
      if (hook) {
        if (cmd.b !== hook[1]) fail(cmd.loc,`${cmd.target} expects ${hook[1]} argument(s)`);
        opcode = hook[0];
      } else {
        if (!functions.has(cmd.target)) fail(cmd.loc,`Unresolved function ${cmd.target}. Include its OS/class .vm file.`);
        a = functions.get(cmd.target);
      }
    } else if (cmd.op === 'goto' || cmd.op === 'if-goto') {
      if (!labels.has(cmd.target)) fail(cmd.loc,`Unresolved label ${cmd.target}`);
      a = labels.get(cmd.target);
    }
    instructions.set([opcode,cmd.segment,a,cmd.b],i*4);
  });
  let start = -1; // A Project 7/8 script can execute directly, without a call frame.
  if (entry === 'auto') start = functions.get('Sys.init') ?? functions.get('Main.main') ?? -1;
  else if (entry !== 'script') {
    if (!functions.has(entry)) throw new Error(`Entry function not found: ${entry}`);
    start = functions.get(entry);
  }
  return {instructions, locations, entry:start, statics: Object.fromEntries(staticSlots)};
}
