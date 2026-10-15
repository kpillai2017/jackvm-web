import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseProgram} from '../web/parser.js';
import {Runtime} from '../web/runtime.js';
const wasm=await readFile(new URL('../web/runtime.wasm',import.meta.url));
async function execute(files) {
  const {instance}=await WebAssembly.instantiate(wasm,{env:{abort(){throw Error('abort');}}});
  const vm=new Runtime(instance);vm.load(parseProgram(files));vm.run(1000,0);return vm;
}
// A concatenated program must behave exactly like its separate class files.
const main=`function Main.main 0
push constant 11
pop static 0
call Other.value 0
pop temp 0
push static 0
pop temp 1
push constant 0
return`;
const other=`function Other.value 0
push constant 22
pop static 0
push static 0
return`;
test('merged multi-class VM preserves per-class static ownership',async()=>{
  const vm=await execute([{name:'Combined.vm',source:main+'\n'+other}]);
  assert.equal(vm.status,1);assert.equal(vm.error,0);
  assert.deepEqual([...vm.ram.slice(5,7)],[22,11]);
});
test('merged library and separate class file agree on static ownership',async()=>{
  const vm=await execute([{name:'Main.vm',source:main},{name:'Library.vm',source:other+'\nfunction Third.noop 0\npush constant 0\nreturn'}]);
  assert.equal(vm.status,1);assert.deepEqual([...vm.ram.slice(5,7)],[22,11]);
});
test('ordinary single-class VM files retain filename-scoped statics',async()=>{
  const vm=await execute([{name:'Main.vm',source:main},{name:'Renamed.vm',source:other}]);
  assert.equal(vm.status,1);assert.deepEqual([...vm.ram.slice(5,7)],[22,11]);
});
test('diagnostic lists all missing OS classes and functions together',()=>{
  assert.throws(()=>parseProgram([{name:'Main.vm',source:'call Memory.init 0\ncall Math.init 0\ncall Memory.alloc 1'}]),error=>{
    assert.deepEqual(error.missingClasses,['Math','Memory']);
    assert.deepEqual(error.missingFunctions,['Math.init','Memory.alloc','Memory.init']);
    assert.match(error.message,/Main.vm:1:/);return true;
  });
});
