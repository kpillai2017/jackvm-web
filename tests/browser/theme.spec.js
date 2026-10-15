import {test,expect} from '@playwright/test';
test('theme uses neutral surfaces, distinct readable disabled controls and focus ring',async({page})=>{
 await page.goto('/');
 const style=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement),panel=getComputedStyle(document.querySelector('.panel-section'));
  const button=getComputedStyle(document.querySelector('#run-btn'));
  return {surface:root.getPropertyValue('--surface').trim(),bg:panel.backgroundColor,disabled:button.color,opacity:button.opacity};
 });
 expect(style.surface).toBe('#1e293b');expect(style.bg).toBe('rgb(30, 41, 59)');
 expect(style.disabled).toBe('rgb(148, 163, 184)');expect(style.opacity).toBe('1');
 await page.locator('#source-toggle').focus();
 const outline=await page.locator('#source-toggle').evaluate(e=>({width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor}));
 expect(outline).toEqual({width:'3px',color:'rgb(56, 189, 248)'});
});
test('load failure and success retain explicit messages with semantic colors',async({page})=>{
 await page.goto('/');
 const upload=async source=>page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from(source)});
 await upload('push nope 1');await expect(page.locator('#load-feedback')).toHaveAttribute('data-tone','error');
 await expect(page.locator('#load-feedback')).toContainText('Load failed');
 expect(await page.locator('#load-feedback').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(253, 164, 175)');
 await upload('push constant 1\npop temp 0');await expect(page.locator('#load-feedback')).toHaveAttribute('data-tone','success');
 await expect(page.locator('#load-feedback')).toContainText('Loaded');
});
