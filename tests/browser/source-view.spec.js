import {test,expect} from '@playwright/test';
const fixture=(name,source)=>({name,mimeType:'text/plain',buffer:Buffer.from(source)});
async function visiblePC(page) {
 const row=page.locator('#source-code .source-current');await expect(row).toHaveCount(1);
 expect(await row.evaluate(e=>{
  const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();
  return r.top>=p.top && r.bottom<=p.bottom;
 })).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
}
test('current red arrow follows distant call, return and jump; caller is light blue',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 const main=['function Main.main 0','call Main.helper 0','pop temp 0','goto END',
  ...Array.from({length:150},(_,i)=>`// padding ${i}`),'label END','push constant 0','return',
  ...Array.from({length:150},(_,i)=>`// more padding ${i}`),'function Main.helper 0','push constant 42','return'].join('\n');
 await page.locator('#local-files').setInputFiles(fixture('Main.vm',main));await expect(page.locator('#load-feedback')).toContainText('Loaded');
 await page.click('#source-toggle');await visiblePC(page);
 await page.click('#step-btn');await page.click('#step-btn'); // inside helper
 await visiblePC(page);await expect(page.locator('.source-current')).toContainText('function Main.helper');
 await expect(page.locator('.source-caller')).toContainText('call Main.helper');
 expect(await page.locator('.source-current .source-marker').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(248, 113, 113)');
 expect(await page.locator('.source-caller .source-marker').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(125, 211, 252)');
 await page.click('#source-caller');
 expect(await page.locator('.source-caller').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;})).toBe(true);
 await expect(page.locator('#source-caller .current-key')).toHaveText('▶ Main.helper');
 await page.click('#source-caller');await visiblePC(page);
 await page.click('#step-btn');await page.click('#step-btn');await page.click('#step-btn'); // return
 await visiblePC(page);await expect(page.locator('.source-current')).toContainText('pop temp 0');
 await expect(page.locator('.source-caller')).toHaveCount(0); // synthetic entry caller not shown
 await page.click('#step-btn');await page.click('#step-btn');await visiblePC(page);
 await expect(page.locator('.source-current')).toContainText('push constant 0');
 // Manually move away; the next step must bring the instruction back.
 await page.locator('#source-code').evaluate(e=>{e.scrollTop=0;e.scrollLeft=50;});
 await page.click('#step-btn');await visiblePC(page);await expect(page.locator('.source-current')).toContainText('return');
});
test('cross-file nested calls show active caller and return follows correct file',async({page})=>{
 await page.goto('/');await page.locator('#local-files').setInputFiles([
  fixture('Main.vm','function Main.main 0\ncall Other.work 0\npop temp 0\npush constant 0\nreturn'),
  fixture('Other.vm','function Other.work 0\ncall Last.value 0\nreturn'),
  fixture('Last.vm','function Last.value 0\npush constant 9\nreturn')]);
 await expect(page.locator('#load-feedback')).toContainText('Loaded');await page.click('#source-toggle');
 const step=async n=>{for(let i=0;i<n;i++)await page.click('#step-btn');};
 await step(2);await visiblePC(page);await expect(page.locator('#source-caller')).toContainText('Main.vm:2');
 const count=await page.locator('#instr-count').textContent();
 await expect(page.locator('#source-caller .current-key')).toHaveText('▶ Other.work');
 expect(await page.locator('#source-caller .current-key').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(248, 113, 113)');
 expect(await page.locator('#source-caller .caller-key').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(125, 211, 252)');
 await page.click('#source-caller');await expect(page.locator('.source-caller')).toContainText('call Other.work');
 await expect(page.locator('#source-caller')).toContainText('Show Current');
 await expect(page.locator('#source-caller')).toHaveAttribute('aria-pressed','true');
 await page.click('#source-caller');await visiblePC(page);
 await expect(page.locator('.source-current')).toContainText('function Other.work');
 await expect(page.locator('#source-caller')).toContainText('Show Caller');
 await expect(page.locator('#instr-count')).toHaveText(count);
 await step(2);await visiblePC(page);await expect(page.locator('.source-current')).toContainText('function Last.value');
 await expect(page.locator('#source-caller')).toContainText('Other.vm:2');
 await step(3);await visiblePC(page);await expect(page.locator('.source-current')).toContainText('return');
 await expect(page.locator('#source-caller')).toContainText('Main.vm:2');
 await step(1);await visiblePC(page);await expect(page.locator('.source-current')).toContainText('pop temp 0');
 await expect(page.locator('#source-caller')).toBeDisabled();
});
