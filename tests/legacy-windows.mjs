// Keep the existing 140 ms workflow checks as coverage for user-configured windows.
export async function setLegacyWindows(page){
  await page.locator('[data-tab="judge"]').click();
  await page.locator('#zoom').evaluate(el=>{el.value='300';el.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const [i,value]of [35,80,140].entries()){
    const input=page.getByLabel(`区间 ${i+1} 端点毫秒`,{exact:true});
    await input.fill(String(value));await input.press('Tab');
  }
  await page.locator('#early-enabled').uncheck();
  await page.locator('[data-tab="chart"]').click();
}
