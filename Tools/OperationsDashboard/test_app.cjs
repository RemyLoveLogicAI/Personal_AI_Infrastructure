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
 console.log('PASS: unknown telemetry, task persistence, habit check, memory review, graph link and cascading removal');
})().catch(error=>{console.error(error);process.exitCode=1;});
