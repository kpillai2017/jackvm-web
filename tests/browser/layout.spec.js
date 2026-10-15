import {test,expect} from '@playwright/test';
const source='label LOOP\npush constant 1\npop temp 0\ngoto LOOP';
async function load(page) {
 await page.goto('/');await page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from(source)});
 await expect(page.locator('#load-feedback')).toContainText('Loaded');
}
test('game occupies wide workspace by default; controls and docs are right',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await expect(page.locator('#source-pane')).toBeHidden();
 await expect(page.locator('#source-toggle')).toHaveAttribute('aria-expanded','false');
 const screen=await page.locator('canvas').boundingBox();const sidebar=await page.locator('.control-panel').boundingBox();
 expect(screen.width).toBeGreaterThan(900);expect(sidebar.x).toBeGreaterThan(screen.x+screen.width);
 for(const id of ['playback-heading','memory-heading','docs-heading']) {
  const box=await page.locator('#'+id).boundingBox();expect(box.x).toBeGreaterThan(screen.x+screen.width);
 }
 expect(Math.abs(screen.width/screen.height-2)).toBeLessThan(.02);
});
test('source toggle shrinks game then restores it without executing or resetting VM',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await load(page);
 const large=await page.locator('canvas').boundingBox();
 const before=await page.locator('#instr-count').textContent();
 await page.getByRole('button',{name:'Show source',exact:true}).click();
 await expect(page.locator('#source-pane')).toBeVisible();
 await expect(page.locator('#source-toggle')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#source-code')).toContainText('push constant 1');
 const small=await page.locator('canvas').boundingBox();expect(small.width).toBeLessThan(large.width*.65);
 expect(Math.abs(small.width/small.height-2)).toBeLessThan(.02);
 await expect(page.locator('#instr-count')).toHaveText(before);
 await page.click('#step-btn');await expect(page.locator('#instr-count')).toHaveText('1');
 await page.getByRole('button',{name:'Hide source',exact:true}).click();
 await expect(page.locator('#source-pane')).toBeHidden();
 await expect(page.locator('#instr-count')).toHaveText('1');
 const restored=await page.locator('canvas').boundingBox();expect(restored.width).toBe(large.width);
 await page.click('#run-btn');await expect(page.locator('#instr-count')).not.toHaveText('1');
 await page.click('#source-toggle');await expect(page.locator('#status-value')).toHaveText('Running');
 await page.click('#pause-btn');
 const dimensions=await page.locator('canvas').evaluate(c=>[c.width,c.height]);expect(dimensions).toEqual([512,256]);
});
test('narrow layout stacks panels and source without horizontal page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await load(page);
 const screen=await page.locator('canvas').boundingBox(),controls=await page.locator('.control-panel').boundingBox();
 expect(controls.y).toBeGreaterThan(screen.y+screen.height);
 await page.click('#source-toggle');await expect(page.locator('#source-pane')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.click('#source-toggle');await expect(page.locator('#source-pane')).toBeHidden();
});
