import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
test('single Choose opens files picker; native filename fields stay hidden',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Choose',exact:true})).toHaveCount(1);
 for(const id of ['local-files','local-folder','add-files','add-folder']) await expect(page.locator('#'+id)).toBeHidden();
 await page.click('#program-choose');await expect(page.getByRole('dialog')).toBeVisible();
 const pending=page.waitForEvent('filechooser');await page.click('#choose-files');
 const picker=await pending;expect(await picker.element().getAttribute('id')).toBe('local-files');
 await picker.setFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from('push constant 42\npop temp 0')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM');
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.click('.extra-files summary');await expect(page.getByRole('button',{name:'Choose',exact:true})).toHaveCount(2);
 await page.click('#extra-choose');await expect(page.locator('#choose-heading')).toHaveText('Add extra VM classes');
 const added=page.waitForEvent('filechooser');await page.click('#choose-files');
 const extra=await added;expect(await extra.element().getAttribute('id')).toBe('add-files');
 await extra.setFiles({name:'Helper.vm',mimeType:'text/plain',buffer:Buffer.from('function Helper.value 0\npush constant 0\nreturn')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded 2 local VM');
});
test('Choose folder route loads directory; cancel and Escape return focus',async({page})=>{
 const folder=await mkdtemp(path.join(process.cwd(),'tmp_rovo_choose_'));
 try {
  await writeFile(path.join(folder,'Main.vm'),'push constant 0\npop temp 0');
  await page.goto('/');await page.click('#program-choose');
  const pending=page.waitForEvent('filechooser');await page.click('#choose-folder');
  const picker=await pending;expect(await picker.element().getAttribute('id')).toBe('local-folder');await picker.setFiles(folder);
  await expect(page.locator('#load-feedback')).toContainText('Loaded');
  await page.click('#program-choose');await page.click('#choose-cancel');
  await expect(page.locator('#program-choose')).toBeFocused();
  await page.click('#program-choose');await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#program-choose')).toBeFocused();
  await page.click('.extra-files summary');await page.click('#extra-choose');
  const extraPending=page.waitForEvent('filechooser');await page.click('#choose-folder');
  const extra=await extraPending;expect(await extra.element().getAttribute('id')).toBe('add-folder');
 } finally {await rm(folder,{recursive:true,force:true});}
});
