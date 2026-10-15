/** Composition root: local files → linker → WASM CPU → browser adapters.
 * Sokoban is preloaded from same-origin static assets. File.text() reads custom
 * programs explicitly selected by the user; local VM content is never uploaded.
 * A replacement is transactional: an invalid selection leaves the previous
 * program paused. The selection is retained so missing OS/classes can be added.
 */
import {linkProgram} from './linker.js';
import {Runtime, FAULTS} from './runtime.js';
import {Display} from './display.js';
import {Keyboard} from './keyboard.js';
import {Player,ORIGINAL_INSTRUCTIONS_PER_FRAME} from './player.js';
const $ = id => document.getElementById(id);
const canvas = $('display-canvas');
const display = new Display(canvas);
const keyboard = new Keyboard(canvas);
let runtime, player, program, files=[], selectedFiles=[], loadVersion=0, loading=false;
function feedbackTone(message) {
  return /(?:failed|fault|error|cannot run|still needs|no \.vm files)/i.test(message) ? 'error'
    : /^(?:Loaded|Running)/.test(message) ? 'success' : 'neutral';
}
const status = message => {
  $('status-value').textContent=message;
  $('status-value').dataset.tone=feedbackTone(message);
};
function loadFeedback(message) {
  $('load-feedback').textContent=message;
  $('load-feedback').dataset.tone=feedbackTone(message);
}
const fault = code => code >= 1000 ? `Sys.error(${code-1000})` : FAULTS[code] || `Fault ${code}`;
const describe = code => code===2 ? `Fault: ${fault(runtime.error)}` : code===1 ? 'Halted' : 'Paused';
function buttons() {
  const running=player?.isPlaying() ?? false;
  $('run-btn').disabled=loading || !runtime || running || runtime.status!==0;
  $('pause-btn').disabled=!running;
  $('step-btn').disabled=loading || !runtime || running || runtime.status!==0;
  $('reset-btn').disabled=loading || !runtime;
  $('add-files').disabled=loading || !selectedFiles.length;
  $('add-folder').disabled=loading || !selectedFiles.length;
  $('extra-choose').disabled=loading || !selectedFiles.length;
}
function sourceView() {
  // Source rendering can be expensive for OS/library files. Do no hidden work
  // in game mode; populate the panel on demand when the user reveals it.
  if(!program || $('source-pane').hidden) return;
  const location=program.locations[runtime.pc];
  // Follow the current instruction; the selector can also browse files manually.
  if(location) $('source-file-select').value=files.findIndex(f=>f.name===location.file);
  const file=files[Number($('source-file-select').value)];
  if(file) $('source-code').textContent=file.source.split('\n').map((text,i)=>
    `${location?.file===file.name && location.line===i+1 ? '▶':' '} ${String(i+1).padStart(4)} ${text}`).join('\n');
}
function refresh() {
  if(!runtime) return;
  $('instr-count').textContent=runtime.instructionsExecuted.toLocaleString();
  $('pc-value').textContent=runtime.pc;
  $('error-value').textContent=runtime.error ? fault(runtime.error) : 'None';
  sourceView();buttons();
}
function pause(message='Paused') {
  player?.stop();keyboard.clearAll();runtime?.setKey(0);status(message);refresh();buttons();
}
function unique(files) {
  const names=new Set();
  for(const file of files) {
    const key=file.name.toLowerCase();
    if(names.has(key)) throw Error(`Duplicate VM filename: ${file.name}. Select one program and one copy of each class.`);
    names.add(key);
  }
  return files;
}
async function local(event, append=false, builtinName='') {
  const selected=[...event.target.files].filter(file=>/\.vm$/i.test(file.name));
  // Reset so choosing the same on-disk files after editing triggers change again.
  event.target.value='';
  if(!selected.length) {
    const message='No .vm files selected. Choose a VM file or a folder containing VM files.';
    status(message);loadFeedback(message);return;
  }
  const version=++loadVersion;
  // Capture the current selection before asynchronous File reads. Last request wins.
  const previous=append ? selectedFiles : [];
  loading=true;pause('Reading local VM files…');buttons();
  try {
    unique([...previous,...selected]);
    const added=await Promise.all(selected.map(async file=>({name:file.name,source:await file.text()})));
    if(version!==loadVersion) return;
    selectedFiles=[...previous,...added];
    $('file-list').textContent=`Selected: ${selectedFiles.map(file=>file.name).join(', ')}`;
    const linked=linkProgram(selectedFiles);
    // This fetch loads the application CPU only, never user VM files.
    const next=await Runtime.create();next.load(linked);
    if(version!==loadVersion) return;
    runtime=next;program=linked;files=[...selectedFiles,...linked.builtinFiles];
    player=new Player(runtime,display,keyboard);
    player.setBudget(Number($('speed-slider').value));
    player.onFrame=refresh;
    player.onStatusChange=message=>{status(runtime.status===2 ? describe(2) : message);buttons();};
    $('source-file-select').replaceChildren(...files.map((file,i)=>new Option(file.name,i)));
    display.clear();display.render(runtime.ram);
    const message=builtinName
      ? `Ready — ${builtinName} loaded with built-in Jack OS. Press Run to play, or Choose your own program.`
      : `Loaded ${selectedFiles.length} local VM file(s)${linked.builtinFiles.length ? ' + built-in Jack OS' : ''} — press Run, then use the focused screen.`;
    status(message);loadFeedback(message);refresh();
  } catch(error) {
    if(version!==loadVersion) return;
    const message=`Load failed: ${error.message} Previous program, if any, remains paused.`;
    status(message);
    loadFeedback(error.missingClasses
      ? `This selection still needs program classes: ${error.missingClasses.join(', ')}. Jack OS is built in; add the missing game/application classes using the Add files/folder controls. No files are uploaded.`
      : message);
  } finally {
    if(version===loadVersion) {loading=false;buttons();}
  }
}
// A file input cannot simultaneously select files AND directories in browsers.
// One visible Choose action opens a native accessible dialog, then dispatches
// the chosen picker synchronously inside its button gesture (no popup blocker).
let chooseExtra=false;
const chooseDialog=$('choose-dialog');
function openChooser(extra) {
  chooseExtra=extra;
  $('choose-heading').textContent=extra ? 'Add extra VM classes' : 'Choose a program';
  $('choose-folder').disabled=!('webkitdirectory' in $('local-folder'));
  chooseDialog.showModal();
}
$('program-choose').addEventListener('click',()=>openChooser(false));
$('extra-choose').addEventListener('click',()=>openChooser(true));
$('choose-files').addEventListener('click',()=>{
  chooseDialog.close();$(chooseExtra ? 'add-files' : 'local-files').click();
});
$('choose-folder').addEventListener('click',()=>{
  chooseDialog.close();$(chooseExtra ? 'add-folder' : 'local-folder').click();
});
$('choose-cancel').addEventListener('click',()=>chooseDialog.close());
$('local-folder').addEventListener('change',event=>local(event));
$('local-files').addEventListener('change',event=>local(event));
$('add-files').addEventListener('change',event=>local(event,true));
$('add-folder').addEventListener('change',event=>local(event,true));
$('run-btn').addEventListener('click',()=>{
  if(!runtime || loading || runtime.status!==0) return;
  player.start();canvas.focus();status('Running');buttons();
});
$('pause-btn').addEventListener('click',()=>pause());
$('step-btn').addEventListener('click',()=>{
  if(!runtime || loading) return;pause();const code=player.step(performance.now());status(describe(code));refresh();
});
$('reset-btn').addEventListener('click',()=>{
  if(!runtime || loading) return;pause();runtime.reset();display.clear();display.render(runtime.ram);status('Reset — paused');refresh();
});
function setSpeed(budget) {
  $('speed-slider').value=String(budget);
  $('speed-display').textContent=budget.toLocaleString();
  player?.setBudget(budget);
}
setSpeed(ORIGINAL_INSTRUCTIONS_PER_FRAME);
$('speed-slider').addEventListener('input',event=>setSpeed(Number(event.target.value)));
$('speed-original').addEventListener('click',()=>setSpeed(ORIGINAL_INSTRUCTIONS_PER_FRAME));
$('source-toggle').addEventListener('click',()=>{
  const show=$('source-pane').hidden;
  $('source-pane').hidden=!show;
  $('display-area').classList.toggle('source-visible',show);
  $('source-toggle').textContent=show ? 'Hide source' : 'Show source';
  $('source-toggle').setAttribute('aria-expanded',String(show));
  if(show) sourceView();
  // Changing the view never restarts, steps or pauses the CPU. The physical
  // canvas remains the same element and retains its framebuffer and resolution.
});
$('source-file-select').addEventListener('change',()=>{
  const file=files[Number($('source-file-select').value)];if(file) $('source-code').textContent=file.source;
});
$('mem-inspect-btn').addEventListener('click',()=>{
  if(!runtime) return;
  const start=Number($('mem-address').value);
  if(!Number.isInteger(start) || start<0 || start>=32768) {status('RAM address must be 0..32767');return;}
  $('memory-display').textContent=[...runtime.ram.slice(start,Math.min(start+16,32768))]
    .map((value,i)=>`${String(start+i).padStart(5)}: ${String(value).padStart(6)}  0x${(value&65535).toString(16).padStart(4,'0')}`).join('\n');
});
canvas.addEventListener('blur',()=>{keyboard.clearAll();runtime?.setKey(0);});
window.addEventListener('blur',()=>{keyboard.clearAll();runtime?.setKey(0);});
document.addEventListener('visibilitychange',()=>{if(document.hidden) pause('Paused (tab hidden)');});
buttons();
// Start the same transactional load immediately: a later local selection wins,
// even if these fetches are still pending. The bundled program starts paused.
function loadSokoban() {
  const names=['Board','Draw','Game','History','Levels','Main','SaveCodec'];
  return local({target:{value:'',files:names.map(name=>({name:`${name}.vm`,async text(){
    const response=await fetch(new URL(`../games/sokoban/${name}.vm`,import.meta.url));
    if(!response.ok) throw Error(`Sokoban ${name}.vm: HTTP ${response.status}`);
    return response.text();
  }}))}},false,'Sokoban');
}
$('load-sokoban').addEventListener('click',()=>loadSokoban());
loadSokoban();
