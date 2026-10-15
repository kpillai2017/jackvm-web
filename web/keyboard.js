/** Hack has one keyboard register: the most recently pressed held key wins.
 * Printable keys use ASCII (letters normalized to uppercase), special keys use
 * 128..152. Track physical codes so Shift changes before keyup cannot stick keys.
 * Only the focused canvas consumes game keys; browser shortcuts remain usable.
 */
export class Keyboard {
  constructor(canvas) {
    this.canvas=canvas;this.held=new Map();this.enabled=true;
    this.special=new Map(Object.entries({Enter:128,Backspace:129,ArrowLeft:130,ArrowUp:131,
      ArrowRight:132,ArrowDown:133,Home:134,End:135,PageUp:136,PageDown:137,Insert:138,Delete:139,Escape:140}));
    for(let i=1;i<=12;i++) this.special.set(`F${i}`,140+i);
    canvas.addEventListener('keydown',event=>{
      if(!this.enabled || document.activeElement!==canvas || event.ctrlKey || event.metaKey || event.altKey) return;
      const value=this.special.get(event.key) ?? (event.key.length===1 && event.key.charCodeAt(0)>=32 && event.key.charCodeAt(0)<=126 ? event.key.toUpperCase().charCodeAt(0):undefined);
      if(value===undefined) return;
      event.preventDefault();
      const physical=event.code || event.key;
      if(!this.held.has(physical)) this.held.set(physical,value);
    });
    canvas.addEventListener('keyup',event=>{
      if(this.held.delete(event.code || event.key)) event.preventDefault();
    });
    canvas.addEventListener('blur',()=>this.clearAll());
    window.addEventListener('blur',()=>this.clearAll());
  }
  getKey() {return [...this.held.values()].at(-1) ?? 0;}
  clearAll() {this.held.clear();}
  isKeyPressed(code) {return [...this.held.values()].includes(code);}
  setEnabled(enabled) {this.enabled=enabled;if(!enabled) this.clearAll();}
}
