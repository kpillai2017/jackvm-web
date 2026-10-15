import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
test('game folder runs with embedded OS and no dependency selection',async({page})=>{
 const folder=await mkdtemp(path.join(process.cwd(),'tmp_rovo_builtin_game_'));
 try {
  await writeFile(path.join(folder,'Main.vm'),`function Main.main 0
push constant 2
push constant 3
call Math.multiply 2
push constant 16384
pop pointer 1
pop that 0
push constant 0
return`);
  await page.goto('/');await page.locator('#local-folder').setInputFiles(folder);
  await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM file(s) + built-in Jack OS');
  await expect(page.locator('#run-btn')).toBeEnabled();await page.click('#run-btn');
  await expect(page.locator('#status-value')).toHaveText('Halted');
  await expect(page.locator('#error-value')).toHaveText('None');
  await page.fill('#mem-address','16384');await page.click('#mem-inspect-btn');
  await expect(page.locator('#memory-display')).toContainText('16384:      6');
 } finally {await rm(folder,{recursive:true,force:true});}
});
