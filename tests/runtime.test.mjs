import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseProgram} from '../web/parser.js';
import {Runtime} from '../web/runtime.js';
const wasm = await readFile(new URL('../web/runtime.wasm',import.meta.url));
async function machine(source, options) {
  const {instance} = await WebAssembly.instantiate(wasm,{env:{abort(){throw Error('WASM abort');}}});
  const vm = new Runtime(instance);
  vm.load(parseProgram(typeof source === 'string' ? [{name:'Main.vm',source}] : source,options));
  return vm;
}
function finish(vm, limit=1000000) { for(let i=0;i<limit/10000 && vm.status===0;i++) vm.run(10000,123); return vm; }

test('all arithmetic operations wrap signed 16-bit values',async()=>{
  const vm=await machine(`push constant 32767\npush constant 1\nadd\npop temp 0
push constant 3\nneg\npush constant 2\nsub\npop temp 1
push constant 32767\npush constant 1\nadd\npush constant 0\nlt\npop temp 2
push constant 7\npush constant 3\nand\nnot\npush constant 2\nor\npop temp 3
push constant 9\npush constant 2\ngt\npush constant 1\nneg\neq\npop temp 4`);
  finish(vm); assert.equal(vm.status,1); assert.deepEqual([...vm.ram.slice(5,10)],[-32768,-5,-1,-2,-1]);
});
test('nested calls, arguments, locals, recursion, bootstrap return',async()=>{
  const vm=await machine(`function Main.main 0
push constant 6
call Main.sum 1
pop temp 0
push constant 0
return
function Main.sum 1
push argument 0
push constant 0
eq
if-goto BASE
push argument 0
push constant 1
sub
call Main.sum 1
push argument 0
add
return
label BASE
push constant 0
return`);
  finish(vm); assert.equal(vm.status,1); assert.equal(vm.ram[5],21); assert.equal(vm.ram[0],257);
});
test('segments, class-scoped statics and pointer restoration',async()=>{
  const vm=await machine([{name:'Main.vm',source:`function Main.main 0
push constant 3000
pop pointer 0
push constant 123
pop this 4
push constant 4000
pop pointer 1
push constant 456
pop that 2
push constant 10
pop static 0
call Other.work 0
pop temp 0
push static 0
pop temp 1
push this 4
pop temp 2
push that 2
pop temp 3
push constant 0
return`},{name:'Other.vm',source:`function Other.work 0
push constant 333
pop pointer 0
push constant 20
pop static 0
push static 0
return`}]);
  finish(vm); assert.equal(vm.status,1); assert.deepEqual([...vm.ram.slice(5,9)],[20,10,123,456]);
});
test('label scope separates functions and allows forward branches',async()=>{
  const vm=await machine(`function Main.main 0
goto END
push constant 100
label END
call Main.other 0
return
function Main.other 0
label END
push constant 77
return`);
  finish(vm);assert.equal(vm.ram[256],77);
});
test('clock native calls, key register, screen and reset',async()=>{
  const vm=await machine(`function Main.main 0
call Clock.supported 0
pop temp 0
call Clock.now 0
pop temp 1
push constant 24576
pop pointer 1
push that 0
pop temp 2
push constant 16384
pop pointer 1
push constant 1
neg
pop that 0
push constant 0
return`);
  vm.setKey(130); vm.run(100,32770); assert.deepEqual([...vm.ram.slice(5,8)],[-1,2,130]);assert.equal(vm.ram[16384],-1);
  vm.reset(); assert.equal(vm.ram[16384],0);assert.equal(vm.ram[24576],0);assert.equal(vm.instructionsExecuted,0);
});
test('halts and errors have explicit statuses',async()=>{
  const halt=await machine('call Sys.halt 0');finish(halt);assert.equal(halt.status,1);
  const error=await machine('push constant 30\ncall Sys.error 1');finish(error);assert.equal(error.status,2);assert.equal(error.error,1030);
});
test('invalid memory and stack access trap without escaping WASM',async()=>{
  const mem=await machine('push constant 1\nneg\npop pointer 1\npush that 0');finish(mem);assert.equal(mem.error,1);
  const under=await machine('pop temp 0');finish(under);assert.equal(under.error,3);
  const over=await machine('function Main.main 2000');finish(over);assert.equal(over.error,2);
  const ret=await machine('return',{entry:'script'});finish(ret);assert.equal(ret.error,5);
});
test('strict parser rejects malformed and unresolved source with locations',()=>{
  for(const source of ['push constant -1','pop constant 1','push pointer 2','push temp 8','push static 240','add extra','call Missing.fn 0','goto MISSING','label A\nlabel A','function Main.main 0\nfunction Main.main 0','call Clock.now 1','constructor'])
    assert.throws(()=>parseProgram([{name:'Bad.vm',source}]),/Bad.vm:\d+:/);
  assert.throws(()=>parseProgram([{name:'Main.vm',source:'push constant 0'},{name:'sub/Main.vm',source:'push constant 0'}]),/Duplicate/);
});
test('self-contained user program writes screen RAM without OS dependencies',async()=>{
  const vm=await machine(`push constant 16384
pop pointer 1
push constant 21845
pop that 0`);
  finish(vm);assert.equal(vm.status,1);assert.equal(vm.ram[16384],21845);
});
