import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('output/panel',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.render_game_to_text);
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const range=(id,value)=>page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
const boxes=async()=>({panel:await page.locator('.settings').boundingBox(),scroll:await page.locator('.settings-scroll').boundingBox(),footer:await page.locator('.settings-footer').boundingBox(),start:await page.locator('#start').boundingBox(),reset:await page.locator('#reset').boundingBox()});
let a=await boxes();assert.ok(a.panel.height<=780&&a.panel.y+a.panel.height<=900);assert.ok(a.scroll.y+a.scroll.height<=a.footer.y);assert.ok(a.start.y>a.reset.y);
await range('farDistance',120);await page.locator('.settings-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});let b=await boxes();assert.deepEqual([b.footer.y,b.start.y,b.reset.y],[a.footer.y,a.start.y,a.reset.y]);assert.ok(await page.locator('.settings-scroll').evaluate(el=>el.scrollTop>0));await page.screenshot({path:'output/panel/scrolled-desktop.png'});
await page.locator('[data-tab="keys"]').click();assert.equal(await page.locator('#tab-keys #reset').count(),0);
await range('musicVolume',.37);await range('hitVolume',.65);await page.locator('#sound').uncheck();await page.locator('#hitSound').uncheck();
for(const [id,level] of [['musicVolume',.37],['hitVolume',.65]]){assert.equal((await state())[id],level);assert.equal(await page.locator('#'+id).isDisabled(),true);assert.equal(await page.locator('#'+id).inputValue(),'0');assert.equal(await page.locator('#'+id+'-value').innerText(),'0%');assert.ok((await page.locator('#'+id).evaluate(e=>getComputedStyle(e).opacity))<.5);}
await page.screenshot({path:'output/panel/audio-off.png'});
await page.locator('#sound').check();await page.locator('#hitSound').check();assert.equal(await page.locator('#musicVolume').isEnabled(),true);assert.equal(await page.locator('#hitVolume').isEnabled(),true);assert.equal(await page.locator('#musicVolume-value').innerText(),'37%');assert.equal(await page.locator('#hitVolume-value').innerText(),'65%');
await page.reload();await page.waitForFunction(()=>!!window.render_game_to_text);await page.locator('[data-tab="keys"]').click();assert.equal(await page.locator('#musicVolume').inputValue(),'0.37');assert.equal(await page.locator('#hitVolume').inputValue(),'0.65');
await page.locator('#reset').click();assert.equal((await state()).farDistance,70);assert.equal((await state()).musicVolume,1);assert.equal((await state()).hitVolume,1);assert.equal(await page.locator('#volume').inputValue(),'0.3');assert.equal(await page.locator('#musicVolume-value').innerText(),'100%');assert.equal(await page.locator('#hitVolume-value').innerText(),'100%');
await page.locator('[data-tab="chart"]').click();const initial=(await state()).camera.position;
await range('judgementZ',-4);const near=await state(),nearY=Number((await page.locator('#lane-labels span').first().getAttribute('style')).match(/top: ([0-9.]+)px/)[1]);assert.equal(near.lineZ,4);assert.deepEqual(near.camera.position,initial);
await range('judgementZ',4);const far=await state(),farY=Number((await page.locator('#lane-labels span').first().getAttribute('style')).match(/top: ([0-9.]+)px/)[1]);assert.equal(far.lineZ,-4);assert.deepEqual(far.camera.position,initial);assert.ok(farY<nearY,'larger number moves hit line away');await page.screenshot({path:'output/panel/judgement-far.png'});
await page.locator('#start').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');let playing=await state();assert.equal(playing.lineZ,-4);assert.deepEqual(playing.camera.position,(await state()).camera.position);await page.evaluate(t=>window.advanceTime(t-JSON.parse(window.render_game_to_text()).time),playing.chartStart);await page.keyboard.press('ShiftLeft');assert.equal((await state()).counts[0],1);await page.screenshot({path:'output/panel/game.png'});
await page.keyboard.press('Escape');await page.locator('#back').click();await page.setViewportSize({width:390,height:844});
for(const tab of ['chart','judge','keys']){await page.locator(`[data-tab="${tab}"]`).click();let p=await boxes();assert.ok(p.panel.x>=0&&p.panel.x+p.panel.width<=390&&p.panel.y+p.panel.height<=844);assert.ok(p.start.y+p.start.height<=844);assert.ok(p.scroll.y+p.scroll.height<=p.footer.y);await page.locator('.settings-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});const after=await boxes();assert.deepEqual([p.footer.y,p.start.y,p.reset.y],[after.footer.y,after.start.y,after.reset.y]);await page.screenshot({path:`output/panel/mobile-${tab}.png`});}
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,errors}));await browser.close();
