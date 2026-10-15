/** Thin host adapter. All instruction execution happens in runtime.wasm. */
export const FAULTS = Object.freeze({1:'RAM address outside 0..32767',2:'Stack overflow (heap begins at 2048)',
  3:'Stack underflow',4:'Invalid instruction address',5:'Invalid return frame',6:'Unknown opcode'});
export class Runtime {
  constructor(instance) { this.cpu = instance.exports; this.program = null; }
  static async create(url = new URL('./runtime.wasm', import.meta.url)) {
    // Read bytes instead of requiring streaming: works on servers lacking the WASM MIME type.
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot load WebAssembly: HTTP ${response.status}`);
    const {instance} = await WebAssembly.instantiate(await response.arrayBuffer(), {
      env:{abort: (_message,_file,line,column) => { throw new Error(`WASM assertion at ${line}:${column}`); }}
    });
    return new Runtime(instance);
  }
  get ram() { return new Int16Array(this.cpu.memory.buffer, this.cpu.ramPointer(),32768); }
  get pc() { return this.cpu.getPC(); }
  get error() { return this.cpu.getError(); }
  get instructionsExecuted() { return this.cpu.getExecuted(); }
  get status() { return this.cpu.getStatus(); }
  load(program) {
    if (!(program.instructions instanceof Int32Array) || program.instructions.length % 4 ||
        program.instructions.length < 4 || program.instructions.length > 65534*4 ||
        !Number.isInteger(program.entry) || program.entry < -1 || program.entry >= program.instructions.length/4)
      throw new Error('Invalid linked program');
    this.program = program;
    new Int32Array(this.cpu.memory.buffer,this.cpu.codePointer(),program.instructions.length).set(program.instructions);
    this.reset();
  }
  reset() {
    if (!this.program) return;
    this.cpu.reset(this.program.instructions.length/4,this.program.entry);
  }
  run(budget, nowMillis = performance.now()) {
    if (!Number.isInteger(budget) || budget < 0 || budget > 10000000 || !Number.isFinite(nowMillis) || nowMillis < 0)
      throw new Error('Invalid execution budget or clock');
    return this.cpu.run(budget,nowMillis);
  }
  step(nowMillis = performance.now()) { return this.run(1,nowMillis); }
  setKey(code) { this.cpu.setKey(code); }
}
