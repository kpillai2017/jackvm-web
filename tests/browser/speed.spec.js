import {test,expect} from '@playwright/test';
test('speed defaults to original 40000 and Original restores it without resetting VM',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#speed-slider')).toHaveValue('40000');
 await expect(page.locator('#speed-display')).toHaveText('40,000');
 await page.locator('#speed-slider').fill('200000');await expect(page.locator('#speed-display')).toHaveText('200,000');
 await page.click('#speed-original');await expect(page.locator('#speed-slider')).toHaveValue('40000');
 await page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from('label LOOP\npush constant 1\npop temp 0\ngoto LOOP')});
 await expect(page.locator('#load-feedback')).toContainText('Loaded');
 await page.click('#step-btn');const pc=await page.locator('#pc-value').textContent();
 await page.locator('#speed-slider').fill('10000');await page.click('#speed-original');
 await expect(page.locator('#instr-count')).toHaveText('1');await expect(page.locator('#pc-value')).toHaveText(pc);
 await page.click('#run-btn');await expect(page.locator('#instr-count')).not.toHaveText('1');
 await page.locator('#speed-slider').fill('80000');await page.click('#speed-original');
 await expect(page.locator('#status-value')).toHaveText('Running');await expect(page.locator('#speed-slider')).toHaveValue('40000');
 await page.click('#pause-btn');
 const original=await page.evaluate(async()=>{
  const {Player,ORIGINAL_INSTRUCTIONS_PER_FRAME}=await import('/web/player.js');
  return {default:new Player(null,null,null).instructionBudget,constant:ORIGINAL_INSTRUCTIONS_PER_FRAME};
 });
 expect(original).toEqual({default:40000,constant:40000});
});
