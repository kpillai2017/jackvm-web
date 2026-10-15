/** Source presentation is independent of execution. PC is the NEXT instruction
 * to execute. The immediate active caller is recovered from the saved return
 * address at RAM[LCL-5], not from a guessed history of visited source lines.
 */
export class SourceView {
  constructor(container,select,callerButton) {
    Object.assign(this,{container,select,callerButton,program:null,files:[],file:null,rows:[],marked:[]});
    callerButton.addEventListener('click',()=>{
      if(!this.callerLocation || !this.currentLocation) return;
      this.showingCaller=!this.showingCaller;
      const target=this.showingCaller ? this.callerLocation : this.currentLocation;
      this.showFile(target.file);
      this.mark(this.currentLocation,this.callerLocation);
      this.reveal(this.rows[target.line-1]);
      this.updateButton();
    });
  }
  load(program,files) {
    this.program=program;this.files=files;this.file=null;this.rows=[];this.marked=[];
    this.showingCaller=false;this.lastPC=null;this.lastCaller=null;
    // Cache containing function names once instead of scanning on every step.
    let name='top-level script';
    this.functions=program.locations.map((location,pc)=>{
      if(program.instructions[pc*4]===13) name=location.text.split(/\s+/)[1];
      return name;
    });
  }
  updateButton() {
    const button=this.callerButton;
    button.disabled=!this.callerLocation || !this.currentLocation;
    button.setAttribute('aria-pressed',String(Boolean(this.showingCaller)));
    if(button.disabled) {
      button.textContent='↳ Caller: none (entry point)';
      button.title='No active VM caller';return;
    }
    const action=document.createElement('span');action.className='source-nav-action';
    action.textContent=this.showingCaller ? 'Show Current · ' : 'Show Caller · ';
    const caller=document.createElement('span');caller.className='caller-key';
    caller.textContent=`↳ Caller: ${this.callerLocation.file}:${this.callerLocation.line}`;
    const separator=document.createTextNode(' → ');
    const callee=document.createElement('span');callee.className='current-key';
    callee.textContent=`▶ ${this.currentFunction}`;
    button.replaceChildren(action,caller,separator,callee);
    button.title=this.showingCaller ? 'Return to the current instruction without stepping' : 'Show the active calling instruction without stepping';
  }
  callerPC(runtime) {
    if(runtime.status===1) return null;
    const frame=runtime.ram[1]&65535;
    if(frame<261 || frame>2048) return null;
    const address=(runtime.ram[frame-5]&65535)-1;
    // Bootstrap sentinel and malformed frames must never become source markers.
    if(address<0 || address>=this.program.locations.length || this.program.instructions[address*4]!==14) return null;
    return address;
  }
  showFile(name) {
    const index=this.files.findIndex(file=>file.name===name);
    if(index<0) return;
    this.select.value=String(index);
    const file=this.files[index];
    if(this.file===file) return;
    this.file=file;this.marked=[];
    const fragment=document.createDocumentFragment();
    this.rows=file.source.split('\n').map((text,index)=>{
      const row=document.createElement('div');row.className='source-line';row.dataset.line=String(index+1);
      const marker=document.createElement('span');marker.className='source-marker';marker.textContent=' ';
      const number=document.createElement('span');number.className='source-number';number.textContent=String(index+1).padStart(4)+' ';
      const code=document.createElement('span');code.textContent=text || ' ';
      row.append(marker,number,code);fragment.append(row);return row;
    });
    this.container.replaceChildren(fragment);
    this.container.scrollTop=0;this.container.scrollLeft=0;
  }
  mark(current,caller) {
    for(const row of this.marked) {
      row.classList.remove('source-current','source-caller');row.removeAttribute('aria-current');
      row.firstChild.textContent=' ';row.firstChild.removeAttribute('title');
    }
    this.marked=[];
    for(const [location,type] of [[caller,'caller'],[current,'current']]) {
      if(location?.file!==this.file?.name) continue;
      const row=this.rows[location.line-1];if(!row) continue;
      row.classList.add(`source-${type}`);row.firstChild.textContent=type==='current'?'▶':'↳';
      row.firstChild.title=type==='current'?'Current instruction (next to execute)':'Calling instruction';
      if(type==='current') row.setAttribute('aria-current','step');
      this.marked.push(row);
    }
  }
  reveal(row) {
    if(!row) return;
    // Scroll ONLY the source pane. scrollIntoView() can also move outer panels
    // and the document, breaking the viewport-fitted game layout.
    const pane=this.container.getBoundingClientRect(),line=row.getBoundingClientRect();
    const top=pane.top+this.container.clientTop,bottom=top+this.container.clientHeight;
    if(line.top<top+4 || line.bottom>bottom-4)
      this.container.scrollTop+=line.top-top-(this.container.clientHeight-line.height)/2;
    // Keep the arrow visible even after manually scrolling long source sideways.
    this.container.scrollLeft=0;
  }
  update(runtime) {
    if(!this.program) return;
    const callerPC=this.callerPC(runtime);
    this.callerLocation=callerPC===null ? null : this.program.locations[callerPC];
    this.currentLocation=this.program.locations[runtime.pc] ?? null;
    this.currentFunction=this.functions[runtime.pc] ?? 'program ended';
    // Ordinary UI refreshes must not undo a user's Caller view. Any actual
    // execution change resumes automatic following of the current instruction.
    if(runtime.instructionsExecuted!==this.lastExecuted || runtime.pc!==this.lastPC || callerPC!==this.lastCaller || !this.callerLocation) this.showingCaller=false;
    this.lastPC=runtime.pc;this.lastCaller=callerPC;this.lastExecuted=runtime.instructionsExecuted;
    this.updateButton();
    const target=this.showingCaller ? this.callerLocation : this.currentLocation;
    if(target) this.showFile(target.file);
    else if(!this.file && this.files.length) this.showFile(this.files[0].name);
    this.mark(this.currentLocation,this.callerLocation);
    this.reveal(target?.file===this.file?.name ? this.rows[target.line-1] : null);
  }
  browse(index) {
    const file=this.files[index];if(!file) return;
    this.showFile(file.name);this.mark(this.currentLocation,this.callerLocation);
    if(this.currentLocation?.file===file.name) this.reveal(this.rows[this.currentLocation.line-1]);
    else if(this.callerLocation?.file===file.name) this.reveal(this.rows[this.callerLocation.line-1]);
  }
}
