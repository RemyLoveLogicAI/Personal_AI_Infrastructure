// Dependency-free behavior smoke test. This does not replace browser layout testing.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.dataset={};this.value='';this.hidden=false;this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this[k]=v;}
 removeAttribute(k){delete this[k];}
 addEventListener(k,v){this.events[k]=v;}
 focus(){}
}
const html=readFileSync(__dirname+'/index.html','utf8');
let stored=null;
const telemetry={updatedAt:null,agents:['OpenClaw','Hermes','Claude Code','Codex'].map(name=>({name,status:'disconnected',sessions:null,tokens:null,credits:null,gateway:null})),dreams:[]};
function boot(){
 const controls=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Element()]));
 const document={getElementById:id=>{assert.ok(controls[id],`Missing DOM control: ${id}`);return controls[id];},querySelectorAll:()=>[],createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),createTextNode:text=>({textContent:text})};
 const context={document,window:{addEventListener(){}},location:{hash:''},localStorage:{getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},crypto:require('node:crypto').webcrypto,Intl,Date,console,setInterval(){},fetch:async()=>({ok:true,json:async()=>telemetry})};
 vm.createContext(context);vm.runInContext(readFileSync(__dirname+'/app.js','utf8'),context);
 return {controls,run:s=>vm.runInContext(s,context),submit:id=>controls[id].events.submit({preventDefault(){},submitter:new Element('button')})};
}
(async()=>{
 let app=boot();await new Promise(r=>setImmediate(r));
 assert.equal(app.controls['kpi-tokens'].textContent,'—');
 assert.equal(app.controls['agent-grid'].children.length,4);
 app.controls['task-title'].value='Test persistent task';app.controls['task-status'].value='doing';app.submit('task-form');
 assert.equal(JSON.parse(stored).tasks[0].status,'doing');
 app=boot();assert.equal(app.run('state.tasks[0].title'),'Test persistent task');
 app.controls['habit-title'].value='Read';app.submit('habit-form');
 const check=app.controls['habit-list'].children[0].children[0].children[0];check.checked=true;check.events.change();assert.equal(JSON.parse(stored).habits[0].days.length,1);
 app.controls['memory-text'].value='Review decision';app.submit('memory-form');
 app.controls['memory-list'].children[0].children[1].children[0].events.click();assert.equal(JSON.parse(stored).memories[0].reviewed,true);
 for(const label of ['Agents','Knowledge']){app.controls['node-label'].value=label;app.submit('node-form');}
 let saved=JSON.parse(stored);app.controls['link-source'].value=saved.nodes[0].id;app.controls['link-target'].value=saved.nodes[1].id;app.submit('link-form');assert.equal(JSON.parse(stored).links.length,1);
 app.controls['node-list'].children[0].children[1].events.click();saved=JSON.parse(stored);assert.equal(saved.nodes.length,1);assert.equal(saved.links.length,0);

 // Test User Intent form submission
 app.controls['input-intent-focus'].value = 'Elevate PAI Infrastructure';
 app.controls['input-intent-telos'].value = 'Human-centric AI synergy';
 app.controls['input-intent-priorities'].value = 'Universality, Proactive HUD';
 app.submit('intent-form');
 assert.equal(app.controls['intent-focus'].textContent, 'Elevate PAI Infrastructure');
 assert.equal(app.controls['intent-telos'].textContent, 'Human-centric AI synergy');

 // Test Guidance rendering and resolution
 app.run(`
   snapshot.guidance = [{
     id: 'g-1',
     agent: 'Hermes',
     question: 'Run migration?',
     options: ['Yes', 'No'],
     status: 'pending',
     time: '2026-01-01T00:00:00Z'
   }];
   renderGuidance();
 `);
 assert.equal(app.controls['guidance-count'].textContent, '1 pending');
 const yesBtn = app.controls['guidance-list'].children[0].children[2].children[0];
 await yesBtn.events.click();
 assert.equal(app.controls['guidance-count'].textContent, '0 pending');

 // Test Milestones rendering
 app.run(`
   snapshot.milestones = [{
     id: 'm-1',
     agent: 'Codex',
     title: 'Universal Context Ledger Launched',
     description: 'Connected cross-harness state to dashboard',
     category: 'feature',
     time: '2026-01-01T00:00:00Z',
     artifacts: ['Tools/HarnessEnhancements/TelemetryMCP/index.js']
   }];
   renderMilestones();
 `);
 assert.equal(app.controls['milestone-list'].children.length, 1);

 console.log('PASS: unknown telemetry, task persistence, habit check, memory review, graph link, intent form, guidance resolution, and milestones');
})().catch(error=>{console.error(error);process.exitCode=1;});
