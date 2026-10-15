import {test,expect} from '@playwright/test';
// The VM continuously copies KEYBOARD into SCREEN[0]. Reading pixels checks the
// full path: Chrome event → keyboard adapter → scheduler → WASM RAM → renderer.
const mirror=`label POLL
push constant 24576
pop pointer 1
push that 0
pop temp 0
push constant 16384
pop pointer 1
push temp 0
pop that 0
goto POLL`;
async function start(page) {
 await page.goto('/');
 await page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from(mirror)});
 await expect(page.locator('#load-feedback')).toContainText('Loaded');await page.click('#run-btn');
}
async function screenCode(page) {
 return page.locator('canvas').evaluate(canvas=>{
  const pixels=canvas.getContext('2d').getImageData(0,0,16,1).data;
  let value=0;for(let bit=0;bit<16;bit++) if(pixels[bit*4]>127)value|=1<<bit;
  return value;
 });
}
async function assertCode(page,value) {await expect.poll(()=>screenCode(page)).toBe(value);}
test('all Hack special keys reach WASM with correct codes',async({page})=>{
 await start(page);
 const special=[['Enter',128],['Backspace',129],['ArrowLeft',130],['ArrowUp',131],
  ['ArrowRight',132],['ArrowDown',133],['Home',134],['End',135],['PageUp',136],
  ['PageDown',137],['Insert',138],['Delete',139],['Escape',140],
  ...Array.from({length:12},(_,i)=>[`F${i+1}`,141+i])];
 for(const [key,code] of special) {
  await page.keyboard.down(key);await assertCode(page,code);
  await page.keyboard.up(key);await assertCode(page,0);
 }
});
test('letters normalize to uppercase; digits, punctuation and Space stay ASCII',async({page})=>{
 await start(page);
 for(const [key,code] of [['a',65],['q',81],['w',87],['A',65],['z',90],['0',48],['9',57],['Space',32],['!',33],['.',46]]) {
  await page.keyboard.down(key);await assertCode(page,code);
  await page.keyboard.up(key);await assertCode(page,0);
 }
});
test('overlapping arrows restore older held key and blur clears input',async({page})=>{
 await start(page);
 await page.keyboard.down('ArrowLeft');await assertCode(page,130);
 await page.keyboard.down('ArrowUp');await assertCode(page,131);
 await page.keyboard.down('ArrowRight');await assertCode(page,132);
 await page.keyboard.up('ArrowRight');await assertCode(page,131);
 await page.keyboard.up('ArrowUp');await assertCode(page,130);
 await page.locator('#mem-address').focus();await assertCode(page,0);
 await page.keyboard.up('ArrowLeft');
 await page.locator('canvas').focus();await assertCode(page,0);
});
