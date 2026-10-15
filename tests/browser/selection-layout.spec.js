import {test,expect} from '@playwright/test';
test('selection card is compact and both Choose actions stay close to labels',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 const panel=await page.locator('.program-panel').boundingBox(),workspace=await page.locator('.workspace').boundingBox();
 expect(panel.width).toBeLessThanOrEqual(674);expect(panel.width).toBeLessThan(workspace.width*.7);
 expect(panel.x).toBe(workspace.x);
 await page.click('.extra-files summary');
 for(const[labelId,buttonId]of[['program-choice-label','program-choose'],['extra-choice-label','extra-choose']]){
  const label=await page.locator('#'+labelId).boundingBox(),button=await page.locator('#'+buttonId).boundingBox();
  expect(button.x-(label.x+label.width)).toBeGreaterThanOrEqual(8);
  expect(button.x-(label.x+label.width)).toBeLessThanOrEqual(16);
  expect(Math.abs((label.y+label.height/2)-(button.y+button.height/2))).toBeLessThan(2);
  expect(button.height).toBeGreaterThanOrEqual(32);
 }
 await page.click('#program-choose');await expect(page.getByRole('dialog')).toBeVisible();
 await page.click('#choose-cancel');await expect(page.locator('#program-choose')).toBeFocused();
});
