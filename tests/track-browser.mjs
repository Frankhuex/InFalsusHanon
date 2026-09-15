import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('output/track',{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.ramps=[];const original=AudioParam.prototype.linearRampToValueAtTime;AudioParam.prototype.linearRampToValueAtTime=function(value,time){window.ramps.push(value);return original.call(this,value,time);};});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.render_game_to_text);
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const range=async(id,value)=>page.locator('#'+id).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
const start=async()=>{await page.locator('#start').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');};
const jump=t=>page.evaluate(t=>window.advanceTime(t-JSON.parse(window.render_game_to_text()).time),t);
const back=async()=>{await page.keyboard.press('Escape');await page.locator('#back').click();await page.locator('[data-tab="chart"]').click();};
assert.equal((await state()).fog,null);assert.equal(await page.locator('#slope').getAttribute('min'),'0');assert.equal(await page.locator('#slope').getAttribute('max'),'90');
await page.screenshot({path:'output/track/setup.png',fullPage:true});
for(const [slope,far,z]of [[10,20,-4],[10,120,4],[0,58,0],[90,58,0],[90,120,4]]){
  await range('slope',slope);await range('farDistance',far);await range('judgementZ',z);await start();const s=await state();const spawn=s.chartStart-(far-z)/s.worldSpeed*1000;
  assert.ok(spawn>=0);await jump(spawn-1);assert.equal((await state()).renderedNotes.some(n=>n.time===s.chartStart),false);
  await jump(spawn+.1);let note=(await state()).renderedNotes.find(n=>n.time===s.chartStart);assert.ok(note);assert.ok(Math.abs(note.z+far)<.01);await page.screenshot({path:`output/track/spawn-${slope}-${far}.png`});
  await jump(s.chartStart);note=(await state()).renderedNotes.find(n=>n.time===s.chartStart);assert.ok(Math.abs(note.z+z)<.0001);await page.keyboard.press('ShiftLeft');assert.equal((await state()).counts[0],1);
  for(const label of await page.locator('#lane-labels span').all()){const b=await label.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=1440&&b.y>=0&&b.y+b.height<=1000,'labels in frame');}
  await page.screenshot({path:`output/track/hit-${slope}-${far}.png`});await back();
}
await range('slope',9);await range('farDistance',70);await range('judgementZ',-4);await page.locator('[data-tab="keys"]').click();await range('musicVolume',.25);await range('hitVolume',.75);await page.screenshot({path:'output/track/volumes.png',fullPage:true});await page.reload();await page.waitForFunction(()=>!!window.render_game_to_text);assert.equal((await state()).musicVolume,.25);assert.equal((await state()).hitVolume,.75);
await start();assert.equal((await state()).audio.musicGain,.25);assert.equal((await state()).audio.hitGain,.75);await page.waitForTimeout(2450);assert.ok(await page.evaluate(()=>window.ramps.some(v=>Math.abs(v-.096)<1e-6)));const nextNote=(await state()).notes[0];await jump(nextNote.time);await page.evaluate(()=>{window.ramps=[];});await page.keyboard.press(['ShiftLeft','a','s','d','f','Space'][nextNote.lane]);assert.ok(await page.evaluate(()=>window.ramps.some(v=>Math.abs(v-.096)<1e-6)));await back();
await page.locator('[data-tab="keys"]').click();await range('musicVolume',0);await range('hitVolume',0);await page.evaluate(()=>{window.ramps=[];});await start();await page.waitForTimeout(2450);await jump(2500);await page.keyboard.press('ShiftLeft');assert.deepEqual(await page.evaluate(()=>window.ramps),[]);await back();
await page.setViewportSize({width:390,height:844});for(const slope of [0,90]){await range('slope',slope);await start();await jump(2300);await page.screenshot({path:`output/track/mobile-${slope}.png`});for(const label of await page.locator('#lane-labels span').all()){const b=await label.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390&&b.y>=0&&b.y+b.height<=844);}await back();}
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,errors}));await browser.close();
