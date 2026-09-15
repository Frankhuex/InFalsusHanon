import * as THREE from 'three';
import {createIcons,Maximize,Play,Pause,RotateCcw,Plus,X,ArrowUp,ArrowDown} from 'lucide';
import data from './hanon_units.json';
import {defaults,makeChart,judgePress,SPEED_SCALE,judgementColors} from './core.js';

const $=s=>document.querySelector(s);
let colors=[];
let config=structuredClone({...defaults,transpose:'diatonic'});
try{const saved=JSON.parse(localStorage.getItem('hanon-six'));if(saved&&Array.isArray(saved.queue)&&saved.queue.every(id=>data[id])&&Array.isArray(saved.windows)&&saved.windows.length&&saved.windows.every((w,i)=>Number.isFinite(w.end)&&w.end>0&&(!i||w.end>saved.windows[i-1].end))&&saved.keys?.length===6)config={...config,...saved};}catch{}
const iconize=()=>createIcons({icons:{Maximize,Play,Pause,RotateCcw,Plus,X,ArrowUp,ArrowDown}});
function normalizeProtection(){if(config.earlyProtection!==null)config.earlyProtection=Math.max(config.windows.at(-1).end+1,Math.min(5000,Math.round(Number(config.earlyProtection)||200)));}
function refreshColors(){config.extraColors=Array.isArray(config.extraColors)?config.extraColors.filter(c=>/^#[0-9a-f]{6}$/i.test(c)):[];const needed=Math.max(0,config.windows.length-3);while(config.extraColors.length<needed){const c='#'+new THREE.Color().setHSL(Math.random(),.65+Math.random()*.2,.6+Math.random()*.12).getHexString();if(!config.extraColors.includes(c))config.extraColors.push(c);}colors=judgementColors(config.windows.length+1,config.extraColors);}
function save(){normalizeProtection();refreshColors();localStorage.setItem('hanon-six',JSON.stringify(config));}
const keyName=k=>k==='Space'?'Space':k==='ShiftLeft'?'L Shift':k==='ShiftRight'?'R Shift':k.replace(/^Key|^Digit/,'');
let mode='setup',chart,elapsed=0,anchor=0,manual=false,audio,audioZero=0,musicIndex=0,beatIndex=0,voices=[],pausedAt=0,resumeUntil=0,combo=0,maxCombo=0,weight=0,counts=[],errors=[],resolved=0,captureKey=-1;
let musicBus,hitBus;
const held=new Set(),flashes=Array(6).fill(0),noteMeshes=new Map();

const scene=new THREE.Scene();scene.background=new THREE.Color('#080e11');scene.fog=null;
const camera=new THREE.PerspectiveCamera(48,1,.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('#stage').append(renderer.domElement);
const world=new THREE.Group();scene.add(world);
// All surfaces use the same cross-section, so outer notes and receptors follow the raised lanes.
function wingRadians(){return config.slope===0?0:THREE.MathUtils.degToRad(config.wingAngle);}
function height(x){return Math.max(0,Math.abs(x)-2)*Math.tan(wingRadians());}
function lineZ(){return -config.judgementZ;}
const surfaces=[],receptors=[],lit=[];
function surface(x1,x2,z1,z2,color,y=0,opacity=1){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x1,height(x1)+y,z1,x2,height(x2)+y,z1,x2,height(x2)+y,z2,x1,height(x1)+y,z2],3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:opacity<1,opacity}));world.add(mesh);surfaces.push(mesh);return mesh;}
function buildTrack(){
  for(const mesh of surfaces){world.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  surfaces.length=0;receptors.length=0;lit.length=0;
  for(let i=0;i<6;i++){const x=i-3,color=i===0?'#b8b5ff':i===5?'#f3a0bc':'#91f4d7';
    surface(x+.025,x+.975,-config.farDistance,8,i===0?'#283349':i===5?'#402b3c':i%2?'#162d30':'#1a3334');
    surface(x+.025,x+.045,-config.farDistance,8,color,.006,.45);
    surface(x+.025,x+.975,-config.farDistance,-config.farDistance+.035,color,.012);
    receptors.push(surface(x+.055,x+.945,lineZ()-.055,lineZ()+.055,color,.025));
    lit.push(surface(x+.03,x+.97,lineZ()-5,lineZ()+.4,i===0?'#ac9dff':i===5?'#ffa0c0':'#86ffd8',.018,0));
    for(let z=-config.farDistance+3;z<8;z+=3)surface(x+.025,x+.975,z,z+.012,'#8abba9',.007,.12);
  }
}
for(const side of [-1,1]){for(let i=0;i<13;i++){const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.10),new THREE.MeshBasicMaterial({color:side<0?'#587e85':'#956076',wireframe:true}));mesh.position.set(side*(3.5+i*.09),.4,-i*3);world.add(mesh);}}
const noteGeo=new THREE.BoxGeometry(.86,.07,.22),noteMaterials=Array.from({length:6},(_,i)=>new THREE.MeshBasicMaterial({color:i===0?'#c3b6ff':i===5?'#ffa8c9':'#58b5ff'}));
function updateTrack(){buildTrack();resize();$('#slope-value').textContent=`${config.slope}°`;$('#wingAngle-value').textContent=`${config.wingAngle}°`;$('#judgementZ-value').textContent=config.judgementZ.toFixed(1);$('#farDistance-value').textContent=config.farDistance.toFixed(0);}
function project(lane,z=lineZ(),y=.15){return new THREE.Vector3(lane-2.5,height(lane-2.5)+y,z).project(camera);}
function resize(){
  const w=innerWidth,h=innerHeight,angle=THREE.MathUtils.degToRad(config.slope);
  renderer.setSize(w,h);camera.aspect=w/h;camera.zoom=Math.min(1,(w/h)/.95);
  const blend=THREE.MathUtils.smoothstep(config.slope,10,90);
  const targetZ=THREE.MathUtils.lerp(-10,(-config.farDistance+5.5)/2,blend);
  let distance=19.12+Math.max(0,config.slope-16)*.4;
  camera.setViewOffset(w,h,mode==='setup'&&w>850?w*.16:0,w/h<.8?-h*.17*(1-blend):0,w,h);
  camera.updateProjectionMatrix();
  // Fit the spawn edge and receptors as the camera approaches an overhead view.
  for(let i=0;i<90;i++){
    camera.position.set(0,Math.sin(angle)*distance,targetZ+Math.cos(angle)*distance);
    camera.up.set(0,Math.cos(angle),-Math.sin(angle));camera.lookAt(0,0,targetZ);camera.updateMatrixWorld();
    const corners=[-3,-2,-1,0,1,2,3].flatMap(x=>[[x,-config.farDistance],[x,5]]);
    const shift=mode==='setup'&&w>850?-.32:0;
    const fits=corners.every(([x,z])=>{const p=new THREE.Vector3(x,height(x)+.1,z).project(camera);return p.x>=-.92+shift&&p.x<=.92+shift&&p.y>=-.84&&p.y<=.55&&p.z<1;});
    if(fits)break;distance*=1.06;
  }
  if(blend>0){const center=mode==='setup'&&w>850?-.32:0;let extent=0;for(const z of [-config.farDistance,5])for(const x of [-3,3]){const p=new THREE.Vector3(x,height(x),z).project(camera);extent=Math.max(extent,Math.abs(p.x-center));}const target=mode==='setup'&&w>850?.55:.78;camera.projectionMatrix.elements[0]*=THREE.MathUtils.lerp(1,target/Math.max(.001,extent),blend);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
  positionLabels();
}
function positionLabels(){const w=innerWidth,h=innerHeight;$('#lane-labels').replaceChildren(...config.keys.map((key,i)=>{const e=document.createElement('span'),p=project(i,lineZ()+.9,.12);e.textContent=keyName(key);e.style.left=`${(p.x+1)*w/2}px`;e.style.top=`${(1-p.y)*h/2}px`;return e;}));}
addEventListener('resize',resize);

function renderQueue(){const lib=$('#library');lib.replaceChildren(...Object.keys(data).map(id=>{const b=document.createElement('button');b.textContent=id.padStart(2,'0');b.title=`添加哈农 ${id}`;b.classList.toggle('selected',config.queue.includes(id));b.onclick=()=>{if(config.queue.length>=100)return showError('最多编排 100 个练习');config.queue.push(id);changed();};return b;}));$('#queue').replaceChildren(...config.queue.map((id,i)=>{const li=document.createElement('li');li.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><strong>Hanon ${id.padStart(2,'0')}</strong><button title="上移" ${i===0?'disabled':''}><i data-lucide="arrow-up"></i></button><button title="下移" ${i===config.queue.length-1?'disabled':''}><i data-lucide="arrow-down"></i></button><button title="移除"><i data-lucide="x"></i></button>`;const buttons=li.querySelectorAll('button');buttons[0].onclick=()=>{[config.queue[i-1],config.queue[i]]=[config.queue[i],config.queue[i-1]];changed();};buttons[1].onclick=()=>{[config.queue[i+1],config.queue[i]]=[config.queue[i],config.queue[i+1]];changed();};buttons[2].onclick=()=>{config.queue.splice(i,1);changed();};return li;}));$('#queue-count').textContent=`${config.queue.length} 个练习`;iconize();}
function updateSummary(){const c=makeChart(data,config);$('#note-count').textContent=`${c.notes.length.toLocaleString()} NOTES`;const seconds=Math.ceil(c.end/1000);$('#duration').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;$('#start-meta').textContent=`${config.bpm} BPM`;$('#start').disabled=!c.notes.length;$('#speed-number').value=(config.speed/SPEED_SCALE).toFixed(2);}
function changed(){save();renderQueue();updateSummary();}
function showError(message=''){$('#error').textContent=message;}
function renderWindows(){refreshColors();const axis=$('#axis'),zoom=Number($('#zoom').value);axis.replaceChildren();let start=0;for(let i=0;i<config.windows.length;i++){const w=config.windows[i],c=colors[i%colors.length];if(start<zoom){const segment=document.createElement('button');segment.className='axis-range';segment.style.cssText=`left:${start/zoom*100}%;width:${(Math.min(w.end,zoom)-start)/zoom*100}%;--c:${c}`;segment.textContent=w.name;segment.title=`${start}–${w.end} ms`;segment.onclick=()=>$('#windows').children[i].querySelector('input').focus();axis.append(segment);}if(w.end<=zoom){const point=document.createElement('button');point.className='axis-point';point.title=`拖动 ${w.end} ms 端点`;point.style.left=`${w.end/zoom*100}%`;point.style.background=c;point.style.color=c;point.innerHTML=`<span>${w.end}</span>`;point.onpointerdown=e=>{e.preventDefault();point.setPointerCapture(e.pointerId);};point.onpointermove=e=>{if(!point.hasPointerCapture(e.pointerId))return;const rect=axis.getBoundingClientRect();const val=Math.round((e.clientX-rect.left)/rect.width*zoom);w.end=Math.max((config.windows[i-1]?.end??0)+1,Math.min(config.windows[i+1]?.end-1||2000,val));point.style.left=`${w.end/zoom*100}%`;point.firstChild.textContent=w.end;};point.onpointerup=()=>{save();renderWindows();updateSummary();};axis.append(point);}start=w.end;}axis.insertAdjacentHTML('beforeend',`<span class="axis-origin">0 ms</span><span class="axis-end">${zoom} ms → ∞</span>`);
$('#windows').replaceChildren(...config.windows.map((w,i)=>{const row=document.createElement('div');row.className='window-row';const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--c',colors[i%colors.length]);const name=document.createElement('input');name.value=w.name;name.maxLength=20;name.setAttribute('aria-label',`区间 ${i+1} 名称`);name.onchange=()=>{w.name=name.value.trim()||`LEVEL ${i+1}`;save();renderWindows();};const end=document.createElement('input');end.type='number';end.value=w.end;end.min=(config.windows[i-1]?.end??0)+1;end.max=config.windows[i+1]?.end-1||2000;end.setAttribute('aria-label',`区间 ${i+1} 端点毫秒`);end.onchange=()=>{w.end=Math.max(Number(end.min),Math.min(Number(end.max),Math.round(Number(end.value)||Number(end.min))));save();renderWindows();updateSummary();};const del=document.createElement('button');del.title='删除端点';del.innerHTML='<i data-lucide="x"></i>';del.disabled=config.windows.length===1;del.onclick=()=>{config.windows.splice(i,1);save();renderWindows();updateSummary();};row.append(swatch,name,end,del);return row;}));const tail=document.createElement('div');tail.className='window-row miss-row';
const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--c',colors.at(-1));
const name=document.createElement('input');name.id='miss-name';name.type='text';name.maxLength=20;name.value=config.missName;name.setAttribute('aria-label','漏击判定名称');name.onchange=()=>{config.missName=name.value.trim()||defaults.missName;save();renderWindows();};
const range=document.createElement('span');range.className='miss-range';range.textContent=`>${config.windows.at(-1).end} ms`;tail.append(swatch,name,range);$('#windows').append(tail);
const limit=config.windows.at(-1).end;if(limit<zoom){const segment=document.createElement('button');segment.className='axis-range miss-axis';segment.style.cssText=`left:${limit/zoom*100}%;width:${(zoom-limit)/zoom*100}%;--c:${colors.at(-1)}`;segment.textContent=config.missName;segment.title=`${config.missName}: >${limit} ms → +∞`;segment.onclick=()=>name.focus();axis.append(segment);}
renderProtection();iconize();}
function renderProtection(){
  normalizeProtection();
  const enabled=config.earlyProtection!==null,limit=config.windows.at(-1).end,axis=$('#axis'),zoom=Number($('#zoom').value);
  $('#early-enabled').checked=enabled;$('#early-point').disabled=!enabled;$('#early-point').min=limit+1;
  $('#early-point').value=enabled?config.earlyProtection:Math.max(limit+1,200);
  $('#early-summary').textContent=enabled?`早于 −${config.earlyProtection} ms 忽略；−${config.earlyProtection} 至 −${limit} ms（不含 −${limit}）按下判 ${config.missName}；晚于 +${limit} ms 自动 ${config.missName}。`:`关闭时，早于 −${limit} ms 的按键忽略。`;
  if(!enabled)return;
  const x=config.earlyProtection;
  if(limit<zoom){const region=document.createElement('div');region.className='early-miss-region';region.style.left=`${limit/zoom*100}%`;region.style.width=`${(Math.min(x,zoom)-limit)/zoom*100}%`;region.title=`仅提前侧：在此区间按下判 ${config.missName}`;axis.append(region);}
  if(x>zoom)return;
  const marker=document.createElement('button');marker.className='axis-point protection-point';marker.style.left=`${x/zoom*100}%`;marker.title=`过早保护 ${x} ms，仅作用于提前侧`;marker.setAttribute('aria-label','拖动过早保护端点');const caption=document.createElement('span');caption.textContent=`x ${x}`;marker.append(caption);
  marker.onpointerdown=e=>{e.preventDefault();marker.setPointerCapture(e.pointerId);};
  marker.onpointermove=e=>{if(!marker.hasPointerCapture(e.pointerId))return;const rect=axis.getBoundingClientRect();config.earlyProtection=Math.max(limit+1,Math.min(5000,Math.round((e.clientX-rect.left)/rect.width*zoom)));marker.style.left=`${config.earlyProtection/zoom*100}%`;caption.textContent=`x ${config.earlyProtection}`;};
  marker.onpointerup=()=>{save();renderWindows();};marker.onpointercancel=()=>{save();renderWindows();};axis.append(marker);
}
$('#early-enabled').onchange=e=>{config.earlyProtection=e.target.checked?Math.max(config.windows.at(-1).end+1,Number($('#early-point').value)||200):null;save();renderWindows();};
$('#early-point').onchange=()=>{config.earlyProtection=Number($('#early-point').value);save();renderWindows();};
$('#zoom').oninput=renderWindows;$('#add-boundary').onclick=()=>{const end=Math.round(Number($('#new-boundary').value));if(end<1||end>2000||config.windows.some(w=>w.end===end))return showError('端点需为 1–2000 ms 内不重复的整数');config.windows.push({end,name:'NEW'});config.windows.sort((a,b)=>a.end-b.end);showError();save();renderWindows();updateSummary();};
function renderBindings(){$('#bindings').replaceChildren(...config.keys.map((key,i)=>{const button=document.createElement('button');button.innerHTML=`<small>LANE ${i+1}</small><span>${captureKey===i?'按下新键':keyName(key)}</span>`;button.onclick=()=>{captureKey=i;renderBindings();};return button;}));positionLabels();}
function initializeControls(){
  for(const id of ['repeat','bpm','slope','wingAngle','judgementZ','farDistance','offset','volume','musicVolume','hitVolume']){
    const input=$('#'+id);input.value=config[id];
    input.oninput=()=>{if(!input.checkValidity())return;config[id]=Number(input.value);save();updateSummary();if(['slope','wingAngle','judgementZ','farDistance'].includes(id))updateTrack();if(['musicVolume','hitVolume','volume'].includes(id)){updateAudioBuses();updateVolumeLabels();}};
    input.onchange=()=>{if(!input.checkValidity()||!input.value)input.value=config[id];};
  }
  for(const id of ['speed','speed-number']){
    const input=$('#'+id);input.value=(config.speed/SPEED_SCALE).toFixed(2);
    input.oninput=()=>{if(!input.value||!input.checkValidity())return;config.speed=Number((Number(input.value)*SPEED_SCALE).toFixed(4));$('#speed').value=input.value;save();if(id==='speed')updateSummary();};
    input.onchange=()=>{input.value=(config.speed/SPEED_SCALE).toFixed(2);updateSummary();};
  }
  for(const id of ['sound','hitSound','metronome']){
    const input=$('#'+id);input.checked=config[id];
    input.onchange=()=>{config[id]=input.checked;save();updateAudioBuses();updateVolumeLabels();};
  }
  $('#division').replaceChildren(...[4,8,16,32].map(n=>{const b=document.createElement('button');b.textContent=`1/${n}`;b.classList.toggle('active',config.division===n);b.onclick=()=>{config.division=n;save();initializeControls();updateSummary();};return b;}));
  renderBindings();renderWindows();updateTrack();updateAudioBuses();updateVolumeLabels();changed();
}
document.querySelectorAll('[data-default]').forEach(button=>{button.onclick=()=>{const id=button.dataset.default;config[id]=defaults[id];$('#'+id).value=id==='speed'?(config.speed/SPEED_SCALE).toFixed(2):config[id];save();updateSummary();updateTrack();};});
const transposeLabel=document.createElement('label');transposeLabel.className='field';transposeLabel.textContent='重复移调';const transposeSelect=document.createElement('select');transposeSelect.innerHTML='<option value="diatonic">C 大调逐级</option><option value="whole">固定全音</option>';transposeSelect.value=config.transpose;transposeSelect.onchange=()=>{config.transpose=transposeSelect.value;save();};transposeLabel.append(transposeSelect);$('#tab-keys').append(transposeLabel);
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{captureKey=-1;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tab-content').forEach(x=>x.hidden=x.id!==`tab-${b.dataset.tab}`);showError();});
$('#reset-judgements').onclick=()=>{config.windows=structuredClone(defaults.windows);config.missName=defaults.missName;config.earlyProtection=defaults.earlyProtection;config.extraColors=[];config.offset=defaults.offset;$('#offset').value=config.offset;$('#zoom').value=200;$('#new-boundary').value=200;showError();save();renderWindows();updateSummary();};
$('#reset').onclick=()=>{config=structuredClone({...defaults,transpose:'diatonic'});transposeSelect.value=config.transpose;initializeControls();};

function updateVolumeLabels(){
  $('#volume-value').textContent=`${Math.round(config.volume*100)}%`;
  for(const [id,enabled] of [['musicVolume',config.sound],['hitVolume',config.hitSound]]){
    const slider=$('#'+id);slider.disabled=!enabled;slider.value=enabled?config[id]:0;
    $('#'+id+'-value').textContent=`${enabled?Math.round(config[id]*100):0}%`;
  }
}
function updateAudioBuses(){
  if(!audio)return;
  musicBus.gain.setValueAtTime(config.sound?config.musicVolume:0,audio.currentTime);
  hitBus.gain.setValueAtTime(config.hitSound?config.hitVolume:0,audio.currentTime);
}
function ensureAudio(){
  if(!audio){audio=new AudioContext();musicBus=audio.createGain();hitBus=audio.createGain();musicBus.connect(audio.destination);hitBus.connect(audio.destination);}
  updateAudioBuses();return audio.resume();
}
function tone(midi,when,length=.17,volume=1,channel=null){
  if(!audio||when<audio.currentTime-.03||config.volume*volume<=0)return;
  if(channel==='music'&&(!config.sound||config.musicVolume<=0))return;
  if(channel==='hit'&&(!config.hitSound||config.hitVolume<=0))return;
  const freq=440*2**((midi-69)/12);if(freq>18000)return;
  const g=audio.createGain();g.connect(channel==='music'?musicBus:channel==='hit'?hitBus:audio.destination);
  const start=Math.max(when,audio.currentTime);
  g.gain.setValueAtTime(0,start);
  g.gain.linearRampToValueAtTime(config.volume*.16*volume*(channel?2:1),start+.004);
  g.gain.exponentialRampToValueAtTime(.0001,start+length);
  for(const [multiple,level] of [[1,1],[2,.26],[3,.07]]){
    const osc=audio.createOscillator(),partial=audio.createGain();osc.type='sine';osc.frequency.value=freq*multiple;partial.gain.value=level;osc.connect(partial);partial.connect(g);osc.start(start);osc.stop(start+length+.02);voices.push(osc);
    osc.onended=()=>{osc.disconnect();partial.disconnect();voices=voices.filter(v=>v!==osc);};
  }
  setTimeout(()=>g.disconnect(),Math.max(0,(start+length-audio.currentTime)*1000+100));
}
function stopAudio(){for(const voice of voices){try{voice.stop();}catch{}}voices=[];}
function scheduleMusic(){if(mode!=='playing'||manual)return;while(musicIndex<chart.notes.length&&chart.notes[musicIndex].time<elapsed+160){const n=chart.notes[musicIndex++];if(config.sound&&config.musicVolume>0&&n.time>=elapsed-30)tone(n.midi,audioZero+n.time/1000,Math.max(.09,Math.min(.5,chart.step/1000*1.6)),1,'music');}if(config.metronome){const beat=60000/config.bpm;while(chart.start+beatIndex*beat<elapsed+160){const t=chart.start+beatIndex*beat;if(t>=elapsed-30)tone(beatIndex%4===0?96:89,audioZero+t/1000,.04,.32);beatIndex++;}}}
function syncAudio(){audioZero=audio.currentTime-elapsed/1000;musicIndex=chart.notes.findIndex(n=>n.time>=elapsed);if(musicIndex<0)musicIndex=chart.notes.length;beatIndex=Math.max(0,Math.ceil((elapsed-chart.start)/(60000/config.bpm)));}
function clearMeshes(){for(const mesh of noteMeshes.values())world.remove(mesh);noteMeshes.clear();}
async function start(){if(!config.queue.length)return;showError();try{await ensureAudio();}catch{return showError('浏览器无法启用音频，请重试');}stopAudio();chart=makeChart(data,config);elapsed=0;manual=false;anchor=performance.now();mode='playing';combo=0;maxCombo=0;weight=0;counts=Array(config.windows.length+1).fill(0);errors=[];resolved=0;held.clear();flashes.fill(0);clearMeshes();$('#effects').replaceChildren();$('#setup').hidden=true;$('#overlay').hidden=true;$('#hud').hidden=false;document.body.classList.add('playing');syncAudio();resize();updateHUD();}
function pause(){if(mode!=='playing'&&mode!=='resuming')return; if(mode==='playing'&&!manual)elapsed=performance.now()-anchor;mode='paused';pausedAt=elapsed;stopAudio();held.clear();flashes.fill(0);$('#countdown').textContent='';$('#overlay').hidden=false;$('#modal-title').textContent='暂停练习';$('#modal-tag').textContent='SESSION PAUSED';$('#results').replaceChildren();$('#resume').hidden=false;}
async function resume(){await ensureAudio();mode='resuming';resumeUntil=performance.now()+1500;$('#overlay').hidden=true;}
function back(){mode='setup';stopAudio();held.clear();flashes.fill(0);clearMeshes();$('#setup').hidden=false;$('#hud').hidden=true;$('#overlay').hidden=true;$('#countdown').textContent='';$('#effects').replaceChildren();document.body.classList.remove('playing');resize();}
function effect(lane,name,color,error){const p=project(lane,lineZ(),.4);const e=document.createElement('div');e.className='hit-text';e.style.left=`${(p.x+1)*innerWidth/2}px`;e.style.top=`${(1-p.y)*innerHeight/2}px`;e.style.color=color;e.textContent=name;if(error!==null){const s=document.createElement('small');s.textContent=`${error>0?'+':''}${Math.round(error)} ms`;e.append(s);}$('#effects').append(e);e.onanimationend=()=>e.remove();}
function resolve(note,index,error=null){note.done=true;resolved++;counts[index<0?config.windows.length:index]++;if(index<0){combo=0;effect(note.lane,config.missName,colors.at(-1),null);}else{if(config.hitSound&&config.hitVolume>0)tone(note.midi-12,audio.currentTime,.22,1,'hit');combo++;maxCombo=Math.max(combo,maxCombo);weight+=Math.max(0,1-Math.abs(error)/config.windows.at(-1).end);errors.push(error);effect(note.lane,config.windows[index].name,colors[index%colors.length],error);}const mesh=noteMeshes.get(note);if(mesh){world.remove(mesh);noteMeshes.delete(note);}updateHUD();}
function hit(lane){flashes[lane]=1;if(mode!=='playing')return;if(!manual)elapsed=performance.now()-anchor;expire();const time=elapsed-config.offset;const candidate=chart.notes.find(n=>!n.done&&n.lane===lane);if(!candidate)return;const error=time-candidate.time;const index=judgePress(error,config.windows,config.earlyProtection);if(index!==null)resolve(candidate,index,error);}
function expire(){const limit=config.windows.at(-1).end;for(const n of chart.notes){if(n.time>=elapsed-config.offset-limit)break;if(!n.done)resolve(n,-1);}}
function updateHUD(){$('#score').textContent=String(Math.round(weight/Math.max(1,chart.notes.length)*1000000)).padStart(7,'0');$('#accuracy').textContent=`${(resolved?weight/resolved*100:100).toFixed(2)}%`;$('#combo').innerHTML=combo>1?`${combo}<small>COMBO</small>`:'';$('#progress div').style.width=`${Math.min(100,elapsed/chart.end*100)}%`;const section=chart.sections.findLast(s=>s.time<=elapsed)||chart.sections[0];$('#current').textContent=`HANON ${section.id.padStart(2,'0')}`;$('#phase').textContent=`${section.direction==='up'?'上行':'下行'} · ${section.repeat} / ${config.repeat} · ${config.bpm} BPM`;}
function finish(){mode='results';stopAudio();held.clear();$('#overlay').hidden=false;$('#modal-title').textContent='练习完成';$('#modal-tag').textContent='SESSION COMPLETE';$('#resume').hidden=true;const results=$('#results');results.replaceChildren();const score=document.createElement('div');score.className='result-score';score.textContent=String(Math.round(weight/chart.notes.length*1000000)).padStart(7,'0');results.append(score);const rows=[['准确率',`${(weight/chart.notes.length*100).toFixed(2)}%`],['最大连击',maxCombo],...config.windows.map((w,i)=>[w.name,counts[i]]),[config.missName,counts.at(-1)],['平均偏差',errors.length?`${(errors.reduce((a,b)=>a+b,0)/errors.length).toFixed(1)} ms`:'—']];for(const [i,[name,value]]of rows.entries()){const row=document.createElement('div');row.className='result-row';if(i>=2&&i<3+config.windows.length)row.style.color=colors[i-2];const label=document.createElement('span'),v=document.createElement('span');label.textContent=name;v.textContent=value;row.append(label,v);results.append(row);}}
$('#start').onclick=start;$('#pause').onclick=pause;$('#resume').onclick=resume;$('#restart').onclick=start;$('#back').onclick=back;$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>showError('当前浏览器不支持全屏'));};
addEventListener('keydown',e=>{if(captureKey>=0){e.preventDefault();if(e.code==='Escape'){captureKey=-1;renderBindings();return;}if(['Escape','Tab','MetaLeft','MetaRight'].includes(e.code)||e.metaKey||e.ctrlKey||e.altKey)return;if(config.keys.includes(e.code)&&config.keys[captureKey]!==e.code)return showError('该按键已分配给其他轨道');config.keys[captureKey]=e.code;captureKey=-1;showError();save();renderBindings();return;}if(e.code==='Escape'){e.preventDefault();if(mode==='playing'||mode==='resuming')pause();else if(mode==='paused')resume();return;}if(e.target.matches('input,select,textarea'))return;const lane=config.keys.indexOf(e.code);if(lane<0)return;e.preventDefault();if(e.repeat||held.has(e.code))return;held.add(e.code);hit(lane);});
addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>{held.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const raycaster=new THREE.Raycaster();renderer.domElement.style.touchAction='none';renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='playing')return;raycaster.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);const hits=raycaster.intersectObjects(receptors);if(hits.length)hit(receptors.indexOf(hits[0].object));else{let best=0,d=Infinity;for(let i=0;i<6;i++){const p=project(i);const dist=Math.abs(e.clientX-(p.x+1)*innerWidth/2);if(dist<d){d=dist;best=i;}}hit(best);}});
function render(){
  const preview=mode==='setup';
  if(preview){
    clearMeshes();
    for(let i=0;i<12;i++){
      const lane=[0,2,3,4,5,4,3,2][i%8],mesh=new THREE.Mesh(noteGeo,noteMaterials[lane]);
      mesh.rotation.z=lane===0?-wingRadians():lane===5?wingRadians():0;
      const z=-config.farDistance+((i*(config.farDistance/12)+performance.now()/1600)%(config.farDistance+lineZ()));
      mesh.position.set(lane-2.5,height(lane-2.5)+.075,z);world.add(mesh);noteMeshes.set(i,mesh);
    }
  }else if(chart){
    for(const n of chart.notes){
      if(n.done)continue;
      const z=lineZ()-(n.time-elapsed)/1000*config.speed;
      if(z< -config.farDistance)break;
      if(z>8){const old=noteMeshes.get(n);if(old){world.remove(old);noteMeshes.delete(n);}continue;}
      let mesh=noteMeshes.get(n);if(!mesh){mesh=new THREE.Mesh(noteGeo,noteMaterials[n.lane]);mesh.rotation.z=n.lane===0?-wingRadians():n.lane===5?wingRadians():0;world.add(mesh);noteMeshes.set(n,mesh);}
      mesh.position.set(n.lane-2.5,height(n.lane-2.5)+.075,z);
    }
  }
  for(let i=0;i<6;i++){flashes[i]*=.9;lit[i].material.opacity=held.has(config.keys[i])?.38:flashes[i]*.4;}
  renderer.render(scene,camera);
}
function tick(){if(mode==='playing'){if(!manual)elapsed=performance.now()-anchor;expire();scheduleMusic();updateHUD();$('#countdown').textContent=elapsed<chart.start?String(Math.ceil((chart.start-elapsed)/1000)):'';if(elapsed>chart.end+Math.max(0,config.offset))finish();}else if(mode==='resuming'){$('#countdown').textContent=String(Math.ceil((resumeUntil-performance.now())/1000));if(performance.now()>=resumeUntil){mode='playing';elapsed=pausedAt;anchor=performance.now()-elapsed;syncAudio();}}render();requestAnimationFrame(tick);}
window.render_game_to_text=()=>JSON.stringify({mode,time:elapsed,chartStart:chart?.start,coordinateSystem:'lanes 0–5 left to right; lineZ=-judgementZ is the hit line; negative z away; error=input time minus target time',score:Math.round(weight/Math.max(1,chart?.notes.length||1)*1000000),combo,maxCombo,resolved,counts,windows:config.windows,missName:config.missName,judgementColors:colors,earlyProtection:config.earlyProtection,speed:config.speed/SPEED_SCALE,worldSpeed:config.speed,slope:config.slope,wingAngle:config.wingAngle,judgementZ:config.judgementZ,lineZ:lineZ(),camera:{position:camera.position.toArray(),targetZ:THREE.MathUtils.lerp(-10,(-config.farDistance+5.5)/2,THREE.MathUtils.smoothstep(config.slope,10,90))},farDistance:config.farDistance,musicVolume:config.musicVolume,hitVolume:config.hitVolume,fog:scene.fog,queue:config.queue,total:chart?.notes.length||0,renderedNotes:[...noteMeshes.entries()].filter(([n])=>typeof n==='object').map(([n,m])=>({time:n.time,lane:n.lane,z:m.position.z})),notes:chart?.notes.filter(n=>!n.done&&n.time<elapsed+4000).slice(0,32).map(n=>({lane:n.lane,time:n.time,midi:n.midi}))||[],audio:{state:audio?.state,scheduled:musicIndex,voices:voices.length,musicGain:musicBus?.gain.value,hitGain:hitBus?.gain.value},keys:config.keys});
window.advanceTime=ms=>{manual=true;stopAudio();if(mode==='playing'){elapsed+=ms;expire();updateHUD();if(elapsed>chart.end+Math.max(0,config.offset))finish();}render();};
initializeControls();resize();iconize();tick();
