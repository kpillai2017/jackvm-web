import {test,expect} from '@playwright/test';
test('loaded games show Run instruction; Run/Step hide it and Reset restores it',async({page})=>{
 await page.goto('/');await expect(page.locator('#status-value')).toContainText('Ready — Sokoban');
 const prompt=page.locator('#start-prompt');await expect(prompt).toBeVisible();
 await expect(prompt).toContainText('Press the Run button to start the game.');
 const blank=()=>page.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,512,256).data;for(let i=0;i<d.length;i+=4)if(d[i])return false;return true;});
 expect(await blank()).toBe(true);
 await page.click('#run-btn');await expect(prompt).toBeHidden();await page.click('#pause-btn');await expect(prompt).toBeHidden();
 await page.click('#reset-btn');await expect(prompt).toBeVisible();expect(await blank()).toBe(true);
 await page.click('#step-btn');await expect(prompt).toBeHidden();
 await page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from('push constant 1\npop temp 0')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded 1 local VM');await expect(prompt).toBeVisible();
 await page.locator('canvas').click();await expect(page.locator('canvas')).toBeFocused();
 await page.click('#run-btn');await expect(prompt).toBeHidden();
});
