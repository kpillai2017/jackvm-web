import {test,expect} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
const status=page=>page.locator('#status-value');
const fixture=(name,source)=>({name,mimeType:'text/plain',buffer:Buffer.from(source)});
// Synthetic test input, not a bundled downloadable program or game asset.
const screenSource=`push constant 16384
pop pointer 1
push constant 21845
pop that 0
label POLL
push constant 24576
pop pointer 1
push that 0
pop temp 0
goto POLL`;
async function ready(page) {
  await page.goto('/');await expect(status(page)).toContainText('Ready');
}
async function load(page,source=screenSource) {
  await ready(page);
  await page.locator('#local-files').setInputFiles(fixture('Main.vm',source));
  await expect(status(page)).toContainText('Loaded 1 local VM');
}
async function ram(page,address) {
  await page.fill('#mem-address',String(address));await page.click('#mem-inspect-btn');
  return page.locator('#memory-display');
}
test('single local file draws with WASM; run/pause/step/reset',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await load(page);await expect(page.locator('#game-select')).toHaveCount(0);
  await page.click('#run-btn');
  await expect(page.locator('#instr-count')).not.toHaveText('0');
  await expect.poll(()=>page.locator('canvas').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,16,1).data;
    return pixels[0]>200 && pixels[4]===0;
  })).toBe(true);
  await page.click('#pause-btn');const before=await page.locator('#instr-count').textContent();
  await page.waitForTimeout(100);await expect(page.locator('#instr-count')).toHaveText(before);
  await page.click('#step-btn');
  expect(Number((await page.locator('#instr-count').textContent()).replaceAll(',',''))).toBe(Number(before.replaceAll(',',''))+1);
  await page.click('#reset-btn');await expect(page.locator('#instr-count')).toHaveText('0');
  expect(errors).toEqual([]);
});
test('keyboard priority, ASCII Space and blur clearing',async({page})=>{
  await load(page);await page.click('#run-btn');
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(100);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);
  await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);
  const keys=await page.evaluate(async()=>{
    const {Keyboard}=await import('/web/keyboard.js');
    const c=document.createElement('canvas');c.tabIndex=0;document.body.append(c);c.focus();
    const k=new Keyboard(c);
    const emit=(type,key,code)=>c.dispatchEvent(new KeyboardEvent(type,{key,code,cancelable:true}));
    emit('keydown','ArrowLeft','ArrowLeft');const a=k.getKey();
    emit('keydown',' ','Space');const b=k.getKey();
    emit('keyup',' ','Space');const d=k.getKey();
    emit('keydown','a','KeyA');const e=k.getKey();
    c.blur();const f=k.getKey();c.remove();return[a,b,d,e,f];
  });
  expect(keys).toEqual([130,32,130,65,0]);
  await page.click('#pause-btn');await expect(await ram(page,24576)).toContainText('24576:      0');
});
test('multiple local VM files link and invalid replacement retains paused program',async({page})=>{
  await ready(page);
  await page.locator('#local-files').setInputFiles([
    fixture('Main.vm','function Main.main 0\ncall Other.answer 0\npop temp 0\npush constant 0\nreturn'),
    fixture('Other.vm','function Other.answer 0\npush constant 42\nreturn')
  ]);
  await expect(status(page)).toContainText('Loaded 2 local VM');await page.click('#run-btn');
  await expect(status(page)).toHaveText('Halted');
  await expect(await ram(page,5)).toContainText('5:     42');
  await page.locator('#local-files').setInputFiles(fixture('Broken.vm','push banana 1'));
  await expect(status(page)).toContainText('Broken.vm:1: Unknown segment');
  await page.click('#reset-btn');await expect(page.locator('#instr-count')).toHaveText('0');
});
test('missing OS/class files can be added after unresolved-call diagnostics',async({page})=>{
  await ready(page);
  await page.locator('#local-files').setInputFiles(fixture('Main.vm','function Main.main 0\ncall Helper.answer 0\npop temp 0\npush constant 0\nreturn'));
  await expect(status(page)).toContainText('Unresolved function Helper.answer');
  await expect(page.locator('#add-files')).toBeEnabled();
  await page.locator('#add-files').setInputFiles(fixture('Helper.vm','function Helper.answer 0\npush constant 73\nreturn'));
  await expect(status(page)).toContainText('Loaded 2 local VM');await page.click('#run-btn');
  await expect(status(page)).toHaveText('Halted');await expect(await ram(page,5)).toContainText('5:     73');
});
test('folder picker includes nested VM files, ignores other files, rejects duplicate basenames',async({page})=>{
  // Test files are workspace-local and removed even when assertions fail.
  const folder=await mkdtemp(path.join(process.cwd(),'tmp_rovo_vm_folder_'));
  try {
    await mkdir(path.join(folder,'classes'));
    await writeFile(path.join(folder,'Main.vm'),'function Main.main 0\ncall Other.answer 0\npop temp 0\npush constant 0\nreturn');
    await writeFile(path.join(folder,'classes','Other.vm'),'function Other.answer 0\npush constant 91\nreturn');
    await writeFile(path.join(folder,'README.txt'),'This is not VM source.');
    await ready(page);await page.locator('#local-folder').setInputFiles(folder);
    await expect(status(page)).toContainText('Loaded 2 local VM');
    await expect(page.locator('#file-list')).not.toContainText('README.txt');
    await page.click('#run-btn');await expect(status(page)).toHaveText('Halted');
    await expect(await ram(page,5)).toContainText('5:     91');
    await writeFile(path.join(folder,'classes','Main.vm'),'push constant 0');
    await page.locator('#local-folder').setInputFiles(folder);
    await expect(status(page)).toContainText('Duplicate VM filename: Main.vm');
    await page.click('#reset-btn');await expect(page.locator('#instr-count')).toHaveText('0');
  } finally {await rm(folder,{recursive:true,force:true});}
});
test('empty/non-VM selection gives feedback and does not erase loaded program',async({page})=>{
  await load(page);
  await page.locator('#local-files').setInputFiles(fixture('notes.txt','not VM'));
  await expect(status(page)).toContainText('No .vm files selected');
  await expect(page.locator('#run-btn')).toBeEnabled();
});
test('only bundled Sokoban is fetched and local programs are never uploaded',async({page})=>{
  const requests=[];page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  await load(page);
  expect(requests.filter(r=>r.method!=='GET')).toEqual([]);
  expect(requests.filter(r=>/\.(vm|json)(\?|$)/.test(r.url)).every(r=>r.url.includes('/games/sokoban/'))).toBe(true);
  expect(requests.some(r=>r.url.endsWith('/web/runtime.wasm'))).toBe(true);
});
test('static output includes Sokoban and corresponding source; server handles URLs',async({request})=>{
  const names=await readdir(new URL('../../dist/',import.meta.url));
  for(const forbidden of ['os','examples']) expect(names).not.toContain(forbidden);
  expect(names).toContain('games');expect(names).toContain('corresponding-source');
  expect((await request.get('/games/sokoban/Main.vm')).status()).toBe(200);
  expect((await request.get('/corresponding-source/sokoban/Main.jack')).status()).toBe(200);
  expect((await request.get('/corresponding-source/sokoban/LICENSE')).status()).toBe(200);
  for(const url of ['/games/manifest.json','/os/manifest.json','/examples/demo/Main.vm'])
    expect((await request.get(url)).status()).toBe(404);
  expect((await request.get('/?cache=1')).status()).toBe(200);
  expect((await request.get('/web/runtime.wasm')).headers()['content-type']).toBe('application/wasm');
  expect((await request.get('/%ZZ')).status()).toBe(400);
});
