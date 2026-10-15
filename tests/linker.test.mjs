import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {linkProgram} from '../web/linker.js';
import {Runtime} from '../web/runtime.js';
const wasm=await readFile(new URL('../web/runtime.wasm',import.meta.url));
async function execute(files) {
 const program=linkProgram(files);const{instance}=await WebAssembly.instantiate(wasm,{env:{abort(){throw Error('abort')}}});
 const vm=new Runtime(instance);vm.load(program);
 for(let i=0;i<100 && vm.status===0;i++)vm.run(100000,i*16);
 return {program,vm};
}
test('OS-free stack scripts remain OS-free',async()=>{
 const{program,vm}=await execute([{name:'Main.vm',source:'push constant 42\npop temp 0'}]);
 assert.equal(program.builtinFiles.length,0);assert.equal(vm.ram[5],42);assert.equal(vm.status,1);
});
test('game-only Main gets built-in initialization, heap, math and screen',async()=>{
 const{program,vm}=await execute([{name:'Main.vm',source:`function Main.main 0
push constant 12
push constant 13
call Math.multiply 2
pop static 0
push constant 1
call Array.new 1
pop pointer 1
push static 0
pop that 0
push constant 16384
push that 0
call Memory.poke 2
pop temp 0
push constant 0
return`}]);
 assert.ok(program.builtinFiles.length>0);assert.equal(vm.error,0);assert.equal(vm.status,1);assert.equal(vm.ram[16384],156);
});
test('provided OS function overrides built-in fallback without duplicates',async()=>{
 const{vm}=await execute([{name:'Main.vm',source:`function Main.main 0
push constant 2
push constant 3
call Math.multiply 2
push constant 16384
pop pointer 1
pop that 0
push constant 1
call Array.new 1
pop temp 0
push constant 0
return`},{name:'Math.vm',source:'function Math.multiply 0\npush constant 123\nreturn'}]);
 assert.equal(vm.error,0);assert.equal(vm.ram[16384],123);
});
test('top-level arithmetic script can use OS without starting in a library',async()=>{
 const{vm}=await execute([{name:'Exercise.vm',source:'push constant 6\npush constant 7\ncall Math.multiply 2\npop temp 0'}]);
 assert.equal(vm.status,1);assert.equal(vm.error,0);assert.equal(vm.ram[5],42);
});
test('unknown game classes are still reported, not silently replaced',()=>{
 assert.throws(()=>linkProgram([{name:'Main.vm',source:'call MissingGame.run 0'}]),/MissingGame/);
});
