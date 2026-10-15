import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const fixture=(name,source)=>({name,mimeType:'text/plain',buffer:Buffer.from(source)});
test('uploaded merged classes retain independent statics and draw correct pixels',async({page})=>{
  await page.goto('/');
  const source=`function Main.main 0
push constant 21845
pop static 0
call Other.clobber 0
pop temp 0
push constant 16384
pop pointer 1
push static 0
pop that 0
push constant 0
return
function Other.clobber 0
push constant 0
pop static 0
push static 0
return`;
  await page.locator('#local-files').setInputFiles(fixture('Merged.vm',source));
  await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM');
  await page.click('#run-btn');await expect(page.locator('#status-value')).toHaveText('Halted');
  const pixels=await page.locator('canvas').evaluate(c=>[...c.getContext('2d').getImageData(0,0,2,1).data]);
  expect(pixels[0]).toBe(255);expect(pixels[4]).toBe(0);
});
test('game-like upload reports missing OS and accepts a separately selected OS folder',async({page})=>{
  const folder=await mkdtemp(path.join(process.cwd(),'tmp_rovo_os_folder_'));
  try {
    await writeFile(path.join(folder,'Helper.vm'),'function Helper.answer 0\npush constant 99\nreturn');
    await page.goto('/');
    await page.locator('#local-files').setInputFiles(fixture('Main.vm','function Main.main 0\ncall Helper.answer 0\npop temp 0\npush constant 0\nreturn'));
    await expect(page.locator('#load-feedback')).toContainText('program classes: Helper');
    // The valid preloaded Sokoban remains paused after a failed replacement.
    await expect(page.locator('#run-btn')).toBeEnabled();
    await page.locator('#add-folder').setInputFiles(folder);
    await expect(page.locator('#load-feedback')).toContainText('Loaded 2 local VM');
    await page.click('#run-btn');await expect(page.locator('#status-value')).toHaveText('Halted');
    await page.fill('#mem-address','5');await page.click('#mem-inspect-btn');
    await expect(page.locator('#memory-display')).toContainText('5:     99');
  }finally {await rm(folder,{recursive:true,force:true});}
});
