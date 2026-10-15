/**
 * The actual CPU lives in WebAssembly, not in a JavaScript interpreter.
 * RAM is signed 16-bit, but addresses and the instruction pointer are i32.
 * The host links source into fixed-width records: [opcode, segment, a, b].
 * No OS implementation is hidden here: ordinary OS calls execute VM bytecode.
 */
const RAM: usize = memory.data(65536);
const CODE: usize = memory.data(65534 * 16);
let count: i32 = 0;
let pc: i32 = 0;
let status: i32 = 1; // 0 running, 1 halted, 2 fault
let error: i32 = 0;
let executed: f64 = 0;
let clock: i32 = 0;

export function ramPointer(): usize { return RAM; }
export function codePointer(): usize { return CODE; }
export function getPC(): i32 { return pc; }
export function getStatus(): i32 { return status; }
export function getError(): i32 { return error; }
export function getExecuted(): f64 { return executed; }

function fail(code: i32): void { error = code; status = 2; }
function read(address: i32): i32 {
  if (address < 0 || address >= 32768) { fail(1); return 0; }
  return load<i16>(RAM + <usize>(address * 2));
}
function write(address: i32, value: i32): void {
  if (address < 0 || address >= 32768) { fail(1); return; }
  store<i16>(RAM + <usize>(address * 2), <i16>value);
}
function push(value: i32): void {
  const sp = read(0);
  // Stack/heap separation deliberately traps overflow instead of corrupting OS objects.
  if (sp < 256 || sp >= 2048) { fail(2); return; }
  write(sp, value); write(0, sp + 1);
}
function pop(): i32 {
  const sp = read(0);
  if (sp <= 256 || sp > 2048) { fail(3); return 0; }
  write(0, sp - 1); return read(sp - 1);
}
function address(segment: i32, index: i32): i32 {
  // 0 constant, 1 local, 2 argument, 3 this, 4 that, 5 temp, 6 pointer, 7 static.
  if (segment >= 1 && segment <= 4) return (read(segment) & 65535) + index;
  if (segment == 5) return 5 + index;
  if (segment == 6) return 3 + index;
  return index; // static has already been relocated to an absolute RAM address.
}
function enter(target: i32, args: i32, returnPC: i32): void {
  if (read(0) - args < 256) { fail(3); return; }
  push(returnPC);
  for (let r = 1; r <= 4; r++) push(read(r));
  write(2, read(0) - args - 5); write(1, read(0)); pc = target;
}
export function reset(length: i32, entry: i32): void {
  memory.fill(RAM, 0, 65536);
  count = length; pc = 0; error = 0; executed = 0; status = 0;
  write(0, 256);
  if (length < 1 || length > 65534 || entry < -1 || entry >= length) { fail(4); return; }
  // A synthetic caller lets Main.main / Sys.init return cleanly.
  if (entry >= 0) enter(entry, 0, 65535);
}
export function setKey(code: i32): void { write(24576, code); }

/** Execute at most budget instructions and yield to the browser. now is monotonic ms. */
export function run(budget: i32, now: f64): i32 {
  clock = <i32>(now % 32768.0) & 32767;
  for (let step = 0; step < budget && status == 0; step++) {
    if (pc == count) { status = 1; break; }
    if (pc < 0 || pc >= count) { fail(4); break; }
    const instruction = CODE + <usize>(pc * 16);
    const op = load<i32>(instruction);
    const segment = load<i32>(instruction + 4);
    const a = load<i32>(instruction + 8);
    const b = load<i32>(instruction + 12);
    pc++; executed++;
    let x: i32 = 0, y: i32 = 0;
    switch (op) {
      case 0: push(segment == 0 ? a : read(address(segment, a))); break;
      case 1: x = pop(); if (status == 0) write(address(segment, a), x); break;
      case 2: y = pop(); x = pop(); push(x + y); break;
      case 3: y = pop(); x = pop(); push(x - y); break;
      case 4: x = pop(); push(-x); break;
      case 5: y = pop(); x = pop(); push(x == y ? -1 : 0); break;
      case 6: y = pop(); x = pop(); push(x > y ? -1 : 0); break;
      case 7: y = pop(); x = pop(); push(x < y ? -1 : 0); break;
      case 8: y = pop(); x = pop(); push(x & y); break;
      case 9: y = pop(); x = pop(); push(x | y); break;
      case 10: x = pop(); push(~x); break;
      case 11: pc = a; break;
      case 12: x = pop(); if (x != 0) pc = a; break;
      case 13: for (let i = 0; i < a && status == 0; i++) push(0); break;
      case 14: enter(a, b, pc); break;
      case 15: {
        const frame = read(1) & 65535;
        if (frame < 261 || frame > 2048 || read(0) <= frame) { fail(5); break; }
        const ret = read(frame - 5) & 65535;
        const arg = read(2) & 65535;
        x = pop(); write(arg, x); write(0, arg + 1);
        for (let r = 4; r >= 1; r--) write(r, read(frame - (5 - r)));
        if (ret == 65535) status = 1; else pc = ret;
        break;
      }
      // Native *call* instructions replace arguments with one return value.
      // The parser verifies arities; no call frame is needed for these leaf hooks.
      case 16: push(-1); break; // Clock.supported
      case 17: push(clock); break; // Clock.now
      case 18: status = 1; break; // Sys.halt
      case 19: x = pop(); error = 1000 + (x & 65535); status = 2; break; // Sys.error
      default: fail(6);
    }
  }
  return status;
}
