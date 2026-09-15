import {setLegacyWindows} from '/Users/apple/Programming/Web/InFalsusHanon/tests/legacy-windows.mjs';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
page.on('console',m=>console.log('CONSOLE',m.type(),m.text()));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.render_game_to_text);
await setLegacyWindows(page);
await page.locator('#bpm').fill('60');await page.locator('#division button').first().click();
await page.locator('[data-tab="judge"]').click();await page.locator('#early-enabled').check();
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
console.log('earlyProtection after check:',(await state()).earlyProtection);
const marker=await page.locator('.protection-point').boundingBox();
const axis=await page.locator('#axis').boundingBox();
console.log('marker box:',marker,'axis box:',axis);
// instrument pointer capture behavior
await page.evaluate(()=>{
  const m=document.querySelector('.protection-point');
  for(const ev of ['pointerdown','pointermove','pointerup','gotpointercapture','lostpointercapture'])
    m.addEventListener(ev,e=>console.log('EVT',ev,e.pointerId,e.clientX,e.clientY,`hasCapture=${m.hasPointerCapture(e.pointerId)}`));
});
await page.mouse.move(marker.x+marker.width/2,marker.y+marker.height/2);
await page.mouse.down();
await page.mouse.move(axis.x+axis.width*220/300,marker.y+marker.height/2);
await page.mouse.up();
console.log('earlyProtection after drag:',(await state()).earlyProtection);
await browser.close();
