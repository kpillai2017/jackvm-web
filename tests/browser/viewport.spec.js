import {test,expect} from '@playwright/test';
for(const [width,height] of [[1440,900],[1366,768],[1280,720],[1024,600],[1920,1080],[390,844]]) {
 test(`player fits ${width}×${height} with source hidden and shown`,async({page})=>{
  await page.setViewportSize({width,height});await page.goto('/');
  await page.locator('#local-files').setInputFiles({name:'Main.vm',mimeType:'text/plain',buffer:Buffer.from('label LOOP\npush constant 1\npop temp 0\ngoto LOOP')});
  await expect(page.locator('#load-feedback')).toContainText('Loaded');
  for(const show of [false,true]) {
   if(show) await page.click('#source-toggle');
   await page.fill('#mem-address','16384');await page.click('#mem-inspect-btn');
   const dimensions=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,
    footer:document.querySelector('footer').getBoundingClientRect().bottom
   }));
   expect(dimensions.scrollHeight).toBeLessThanOrEqual(height);
   expect(dimensions.bodyHeight).toBeLessThanOrEqual(height);
   expect(dimensions.scrollWidth).toBeLessThanOrEqual(width);
   expect(dimensions.footer).toBeLessThanOrEqual(height);
   const screen=await page.locator('canvas').boundingBox();
   expect(screen.width).toBeGreaterThan(50);expect(screen.height).toBeGreaterThan(25);
   expect(screen.y+screen.height).toBeLessThan(height);
   expect(Math.abs(screen.width/screen.height-2)).toBeLessThan(.02);
   await page.click('#run-btn');await expect(page.locator('#instr-count')).not.toHaveText('0');await page.click('#pause-btn');
  }
 });
}
