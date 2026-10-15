import {test,expect} from '@playwright/test';
test('Sokoban preloads paused, runs without selecting files, and can be restored',async({page})=>{
 await page.goto('/');await expect(page.locator('#status-value')).toContainText('Ready — Sokoban');
 await expect(page.locator('#run-btn')).toBeEnabled();await expect(page.locator('#instr-count')).toHaveText('0');
 await expect(page.locator('#file-list')).toContainText('Levels.vm');
 await page.click('#run-btn');
 await expect.poll(()=>page.locator('canvas').evaluate(canvas=>{
  const data=canvas.getContext('2d').getImageData(0,0,512,256).data;
  let lit=0;for(let i=0;i<data.length;i+=4)if(data[i])lit++;
  return lit;
 })).toBeGreaterThan(1000);
 await page.click('#pause-btn');await expect(page.locator('#error-value')).toHaveText('None');
 await page.locator('#local-files').setInputFiles({name:'Test.vm',mimeType:'text/plain',buffer:Buffer.from('push constant 0\npop temp 0')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM');
 await page.click('#load-sokoban');await expect(page.locator('#status-value')).toContainText('Ready — Sokoban');
 await expect(page.locator('#instr-count')).toHaveText('0');
});
test('a late preload cannot overwrite an explicitly selected local program',async({page})=>{
 await page.route('**/games/sokoban/*.vm',async route=>{
  await new Promise(resolve=>setTimeout(resolve,500));await route.continue();
 });
 await page.goto('/');
 await page.locator('#local-files').setInputFiles({name:'User.vm',mimeType:'text/plain',buffer:Buffer.from('push constant 42\npop temp 0')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM');
 await page.waitForTimeout(700);
 await expect(page.locator('#file-list')).toHaveText('Selected: User.vm');
 await page.click('#run-btn');await expect(page.locator('#status-value')).toHaveText('Halted');
});
