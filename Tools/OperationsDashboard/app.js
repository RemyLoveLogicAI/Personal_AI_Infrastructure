'use strict';
const $ = id => document.getElementById(id);
const NAMES = ['OpenClaw', 'Hermes', 'Claude Code', 'Codex'];
const KEY = 'agent-operations-workboard-v1';
const empty = () => ({tasks:[],habits:[],memories:[],nodes:[],links:[],hidden:[]});
let state = empty(), snapshot = null, fetching = false;
const el = (tag, text, cls) => {const n=document.createElement(tag); if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const id = () => crypto.randomUUID();
const day = () => {const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
const date = x => x && Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString() : 'Never received';
const num = x => typeof x==='number' ? new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(x) : '—';
function storageError(message){$('storage-alert').hidden=false;$('storage-alert').textContent=message;}
try {const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){if(!['tasks','habits','memories','nodes','links','hidden'].every(k=>Array.isArray(saved[k])) || !saved.tasks.every(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&['backlog','doing','done'].includes(x.status)) || !saved.habits.every(x=>x&&typeof x.title==='string'&&Array.isArray(x.days)) || !saved.memories.every(x=>x&&typeof x.text==='string') || !saved.nodes.every(x=>x&&typeof x.id==='string'&&typeof x.label==='string') || !saved.links.every(x=>x&&typeof x.source==='string'&&typeof x.target==='string'))throw Error('Invalid saved data');state=saved;}}
catch{storageError('Saved workboard could not be read. Changes are kept in this tab until browser storage is available.');}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('storage-alert').hidden=true;}catch{storageError('Browser storage is unavailable or full. Changes in this tab are not saved.');}}
function button(text, action, cls='button secondary'){const n=el('button',text,cls);n.type='button';n.addEventListener('click',action);return n;}
function showView(name){for(const v of ['operations','workboard'])$(v+'-view').hidden=v!==name;$('page-title').textContent=name==='operations'?'Operations':'Workboard';document.querySelectorAll('[data-view-target]').forEach(n=>{const active=n.dataset.viewTarget===name;n.classList.toggle('is-active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});}
function route(){showView(location.hash==='#workboard'?'workboard':'operations');}
document.querySelectorAll('[data-view-target]').forEach(n=>n.addEventListener('click',()=>{location.hash=n.dataset.viewTarget;}));
window.addEventListener('hashchange',route);route();
$('customize-button').addEventListener('click',()=>{const open=$('customize-panel').hidden;$('customize-panel').hidden=!open;$('customize-button').setAttribute('aria-expanded',String(open));});
for(const widget of document.querySelectorAll('[data-widget]')){const label=el('label'),check=el('input');check.type='checkbox';check.checked=!state.hidden.includes(widget.dataset.widget);widget.hidden=!check.checked;check.addEventListener('change',()=>{widget.hidden=!check.checked;state.hidden=check.checked?state.hidden.filter(x=>x!==widget.dataset.widget):[...state.hidden,widget.dataset.widget];save();});label.append(check,document.createTextNode(widget.dataset.widgetLabel));$('widget-toggles').append(label);}
async function postSnapshot(){
  if(!snapshot)return;
  try {
    const payload = JSON.stringify(snapshot);
    await fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});
  } catch(e) {
    console.error('Failed to sync snapshot to server:', e);
  }
}

function renderIntent(){
  const intent = snapshot?.user_intent;
  $('intent-focus').textContent = intent?.focus || 'Universal User-Centric Infrastructure';
  $('intent-telos').textContent = intent?.telos || 'Empower human agency through proactive, transparent, and seamless AI co-working.';
  $('intent-priorities').replaceChildren();
  const priorities = intent?.priorities || ['Zero disruption to existing architecture', 'Human-in-the-loop attention center', 'Universal cross-harness state alignment'];
  for(const p of priorities){
    $('intent-priorities').append(el('span', p, 'tag'));
  }
}

$('edit-intent-btn').addEventListener('click',()=>{
  const intent = snapshot?.user_intent;
  $('input-intent-focus').value = intent?.focus || $('intent-focus').textContent;
  $('input-intent-telos').value = intent?.telos || $('intent-telos').textContent;
  $('input-intent-priorities').value = (intent?.priorities || []).join(', ');
  $('intent-display').hidden = true;
  $('intent-form').hidden = false;
  $('edit-intent-btn').hidden = true;
});

$('cancel-intent-btn').addEventListener('click',()=>{
  $('intent-display').hidden = false;
  $('intent-form').hidden = true;
  $('edit-intent-btn').hidden = false;
});

$('intent-form').addEventListener('submit',async (e)=>{
  e.preventDefault();
  const focus = $('input-intent-focus').value.trim();
  const telos = $('input-intent-telos').value.trim();
  const rawPri = $('input-intent-priorities').value.trim();
  const priorities = rawPri ? rawPri.split(',').map(s=>s.trim()).filter(Boolean) : [];
  if(!focus) return;
  if(!snapshot) snapshot = { updatedAt: new Date().toISOString(), agents: NAMES.map(name=>({name,status:'disconnected'})), dreams: [] };
  snapshot.user_intent = { focus, telos, priorities, updatedAt: new Date().toISOString() };
  snapshot.updatedAt = new Date().toISOString();
  renderIntent();
  $('intent-display').hidden = false;
  $('intent-form').hidden = true;
  $('edit-intent-btn').hidden = false;
  await postSnapshot();
});

function renderGuidance(){
  const items = snapshot?.guidance || [];
  const pending = items.filter(x => x.status === 'pending');
  $('guidance-count').textContent = `${pending.length} pending`;
  const widget = $('guidance-widget');
  if(widget && widget.classList) widget.classList.toggle('has-pending', pending.length > 0);

  $('guidance-list').replaceChildren();
  if(!items.length){
    $('guidance-list').append(el('p', 'No agent requests pending your guidance.', 'empty-state'));
    return;
  }

  for(const item of items){
    const card = el('article', undefined, `guidance-card ${item.status === 'resolved' ? 'resolved' : ''}`);
    const header = el('div', undefined, 'guidance-header');
    header.append(el('strong', item.agent || 'Agent'), el('small', `${date(item.time)} · ${item.status}`));
    card.append(header);
    card.append(el('p', item.question, 'guidance-question'));
    if(item.context){
      card.append(el('p', item.context, 'guidance-context'));
    }

    if(item.status === 'pending'){
      if(item.options && item.options.length){
        const optRow = el('div', undefined, 'guidance-options');
        for(const opt of item.options){
          const optBtn = button(opt, async ()=>{
            item.status = 'resolved';
            item.resolution = opt;
            item.resolvedAt = new Date().toISOString();
            snapshot.updatedAt = new Date().toISOString();
            renderGuidance();
            await postSnapshot();
          }, 'button primary');
          optRow.append(optBtn);
        }
        card.append(optRow);
      }

      const inputRow = el('div', undefined, 'guidance-input-row');
      const input = el('input');
      input.placeholder = 'Custom guidance or instruction...';
      const sendBtn = button('Submit', async ()=>{
        const val = input.value.trim();
        if(!val) return;
        item.status = 'resolved';
        item.resolution = val;
        item.resolvedAt = new Date().toISOString();
        snapshot.updatedAt = new Date().toISOString();
        renderGuidance();
        await postSnapshot();
      }, 'button secondary');
      inputRow.append(input, sendBtn);
      card.append(inputRow);
    } else {
      const resP = el('p', `Resolution: ${item.resolution || 'Resolved'}`, 'guidance-resolution');
      card.append(resP);
    }

    $('guidance-list').append(card);
  }
}

function renderMilestones(){
  const milestones = [...(snapshot?.milestones || [])].sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0));
  $('milestone-list').replaceChildren();
  if(!milestones.length){
    $('milestone-list').append(el('li', 'No milestones logged yet.', 'empty-state'));
    return;
  }
  for(const m of milestones){
    const li = el('li');
    const badge = el('span', m.category || 'general', `category-badge ${m.category || 'general'}`);
    li.append(badge, el('strong', m.title), el('small', ` · ${m.agent || 'System'} · ${date(m.time)}`));
    li.append(el('p', m.description));
    if(m.artifacts && m.artifacts.length){
      const artDiv = el('div', undefined, 'artifacts-list');
      for(const art of m.artifacts){
        artDiv.append(el('span', art, 'artifact-tag'));
      }
      li.append(artDiv);
    }
    $('milestone-list').append(li);
  }
}

function total(key){const agents=snapshot?.agents||[];const values=agents.map(a=>a[key]);return values.length&&values.every(x=>typeof x==='number')?num(values.reduce((a,b)=>a+b,0)):'—';}
function renderTelemetry(){const agents=snapshot?.agents||NAMES.map(name=>({name,status:'disconnected'}));const stamp=snapshot?.updatedAt;const stale=stamp&&Date.now()-Date.parse(stamp)>300000;
 $('snapshot-time').textContent=date(stamp);$('snapshot-freshness').textContent=!stamp?'Unknown':stale?'Stale · over 5 minutes':'Fresh snapshot';$('snapshot-freshness').className=stale?'stale':'';
 $('source-chip').replaceChildren(el('span','',`status-dot ${stale?'idle':'unknown'}`),el('span',!stamp?'Awaiting snapshot':stale?'Stale snapshot':'Source snapshot'));
 $('kpi-connected').textContent=stamp?String(agents.filter(a=>['online','idle'].includes(a.status)).length):'—';$('kpi-connected-note').textContent=stamp?'Online or idle in snapshot':'No snapshot';$('kpi-sessions').textContent=total('sessions');$('kpi-tokens').textContent=total('tokens');
 const gateways=agents.map(a=>a.gateway);$('kpi-gateway').textContent=gateways.includes('down')?'Down':gateways.includes('degraded')?'Degraded':gateways.every(g=>g==='healthy')?'Healthy':'Unknown';$('kpi-gateway-note').textContent=`${gateways.filter(g=>g==='healthy').length} of ${NAMES.length} reported healthy`;
 $('agent-grid').replaceChildren();for(const agent of agents){const card=el('article',undefined,'agent-card'),header=el('div',undefined,'agent-header');header.append(el('span',agent.name.slice(0,2),'agent-avatar'),el('span',agent.status,`status-badge ${agent.status}`));card.append(header,el('h3',agent.name));const dl=el('dl');for(const [label,value] of [['Sessions',num(agent.sessions)],['Tokens',num(agent.tokens)],['Credits',num(agent.credits)],['Gateway',agent.gateway||'Unknown']]){const row=el('div');row.append(el('dt',label),el('dd',value));dl.append(row);}card.append(dl,el('p',stamp?(stale?'Stale source snapshot':'Reported by source'):'Not connected','agent-note'));$('agent-grid').append(card);}
 $('dream-list').replaceChildren();const dreams=[...(snapshot?.dreams||[])].sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0));for(const dream of dreams){const li=el('li');li.append(el('strong',dream.agent),el('small',` · ${date(dream.time)}`),el('p',dream.message));$('dream-list').append(li);}if(!dreams.length)$('dream-list').append(el('li','No dreaming entries in this snapshot.','empty-state'));

 renderIntent();
 renderGuidance();
 renderMilestones();

 const ledger = snapshot?.ledger;
 if(ledger && ((ledger.tasks && Object.keys(ledger.tasks).length) || ledger.active_task)){
   const dl = el('dl');
   const tasks = ledger.tasks ? Object.values(ledger.tasks) : [ledger];
   for (const task of tasks) {
     if(task && task.active_task){
       dl.append(el('dt', 'Active Task'), el('dd', `${task.active_task.goal} (Status: ${task.active_task.status})`));
       if(task.context_continuation) {
          dl.append(el('dt', 'Handoff Summary'), el('dd', task.context_continuation.handoff_summary || 'None'));
          dl.append(el('dt', 'Blocked On'), el('dd', task.context_continuation.blocked_on || 'None'));
       }
       if(task.shared_memory_pointers && task.shared_memory_pointers.length) {
          dl.append(el('dt', 'Memory Pointers'), el('dd', task.shared_memory_pointers.join(', ')));
       }
     }
   }
   $('ledger-content').replaceChildren(dl);
 } else {
   $('ledger-content').replaceChildren(el('p', 'No context ledger saved.', 'empty-state'));
 }
}
function telemetryError(message){$('telemetry-alert').hidden=false;$('telemetry-alert').textContent=message;$('telemetry-alert').className='alert error';}
async function refresh(){if(fetching)return;fetching=true;$('refresh-button').disabled=true;try{const response=await fetch('/api/telemetry',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Telemetry unavailable');if(!Array.isArray(data.agents)||!Array.isArray(data.dreams))throw Error('Invalid telemetry response');snapshot=data;$('telemetry-alert').hidden=true;renderTelemetry();if(snapshot.backlog&&snapshot.backlog.length){state.tasks=snapshot.backlog;save();taskRender();}}catch(error){telemetryError(`${error.message}. ${snapshot?'Showing the last received snapshot.':'No telemetry is available.'}`);$('source-chip').textContent='Feed unavailable';}finally{fetching=false;$('refresh-button').disabled=false;}}
$('refresh-button').addEventListener('click',refresh);
$('import-form').addEventListener('submit',async event=>{event.preventDefault();const file=$('telemetry-file').files[0];if(!file)return telemetryError('Choose a JSON snapshot first.');if(file.size>1048576)return telemetryError('Snapshot must be no larger than 1 MiB.');const submit=event.submitter;submit.disabled=true;try{const body=JSON.stringify(JSON.parse(await file.text()));const response=await fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body});const data=await response.json();if(!response.ok)throw Error(data.error||'Import failed');snapshot=data;renderTelemetry();$('telemetry-alert').className='alert';$('telemetry-alert').hidden=false;$('telemetry-alert').textContent='Snapshot imported. Values reflect the source timestamp.';}catch(error){telemetryError(`Import failed: ${error.message}`);}finally{submit.disabled=false;}});
function taskRender(){$('kanban').replaceChildren();for(const [status,label] of [['backlog','Backlog'],['doing','In progress'],['done','Done']]){const column=el('section',undefined,'kanban-column');const tasks=state.tasks.filter(t=>t.status===status);column.append(el('h3',`${label} · ${tasks.length}`));for(const task of tasks){const card=el('article',undefined,'task-card'),actions=el('div',undefined,'task-actions'),select=el('select');select.setAttribute('aria-label',`Status for ${task.title}`);for(const [value,text] of [['backlog','Backlog'],['doing','In progress'],['done','Done']]){const option=el('option',text);option.value=value;select.append(option);}select.value=task.status;select.addEventListener('change',()=>{task.status=select.value;save();taskRender();});actions.append(select,button('Delete',()=>{state.tasks=state.tasks.filter(t=>t.id!==task.id);save();taskRender();},'delete-button'));card.append(el('p',task.title),actions);column.append(card);}if(!tasks.length)column.append(el('p','No tasks here.','empty-state'));$('kanban').append(column);}}
function habitRender(){const today=day();$('habit-list').replaceChildren();$('habit-score').textContent=`${state.habits.filter(h=>h.days.includes(today)).length} / ${state.habits.length} today`;for(const habit of state.habits){const row=el('div',undefined,'habit-row'),label=el('label'),check=el('input');check.type='checkbox';check.checked=habit.days.includes(today);check.addEventListener('change',()=>{habit.days=check.checked?[...habit.days,today]:habit.days.filter(d=>d!==today);save();habitRender();});label.append(check,document.createTextNode(habit.title));row.append(label,button('Delete',()=>{state.habits=state.habits.filter(h=>h.id!==habit.id);save();habitRender();},'delete-button'));$('habit-list').append(row);}if(!state.habits.length)$('habit-list').append(el('p','Add a habit to track your daily rhythm.','empty-state'));}
function memoryRender(){$('memory-list').replaceChildren();$('memory-count').textContent=`${state.memories.filter(m=>!m.reviewed).length} pending`;for(const memory of state.memories){const row=el('div',undefined,`memory-row ${memory.reviewed?'reviewed':''}`),actions=el('div',undefined,'item-actions');actions.append(button(memory.reviewed?'Reopen':'Reviewed',()=>{memory.reviewed=!memory.reviewed;save();memoryRender();}),button('Delete',()=>{state.memories=state.memories.filter(m=>m.id!==memory.id);save();memoryRender();},'delete-button'));row.append(el('p',memory.text),actions);$('memory-list').append(row);}if(!state.memories.length)$('memory-list').append(el('p','Add something you want to revisit.','empty-state'));}
function svg(tag,attrs,text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;}
function graphRender(){const graph=$('knowledge-graph');graph.replaceChildren();$('graph-empty').hidden=state.nodes.length>0;$('node-count').textContent=`${state.nodes.length} nodes · ${state.links.length} links`;$('node-list').replaceChildren();for(const select of [$('link-source'),$('link-target')]){select.replaceChildren();for(const node of state.nodes){const option=el('option',node.label);option.value=node.id;select.append(option);}}if(state.nodes.length>1)$('link-target').selectedIndex=1;
 const positions=new Map(state.nodes.map((node,index)=>[node.id,{x:360+250*Math.cos(index/state.nodes.length*Math.PI*2),y:165+115*Math.sin(index/state.nodes.length*Math.PI*2)}]));for(const link of state.links){const a=positions.get(link.source),b=positions.get(link.target);if(a&&b)graph.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'graph-edge'}));}for(const node of state.nodes){const p=positions.get(node.id),group=svg('g',{class:'graph-node'});group.append(svg('circle',{cx:p.x,cy:p.y,r:19}),svg('text',{x:p.x,y:p.y+38},node.label.length>20?node.label.slice(0,18)+'…':node.label),svg('title',{},node.label));graph.append(group);const li=el('li');li.append(el('span',node.label),button('Remove',()=>{state.nodes=state.nodes.filter(n=>n.id!==node.id);state.links=state.links.filter(l=>l.source!==node.id&&l.target!==node.id);save();graphRender();},'delete-button'));$('node-list').append(li);}
 for(const link of state.links){const source=state.nodes.find(n=>n.id===link.source),target=state.nodes.find(n=>n.id===link.target);if(source&&target){const li=el('li');li.append(el('span',`${source.label} ↔ ${target.label}`),button('Unlink',()=>{state.links=state.links.filter(l=>l!==link);save();graphRender();},'delete-button'));$('node-list').append(li);}}
}
function form(formId,inputId,action,render){$(formId).addEventListener('submit',event=>{event.preventDefault();const value=$(inputId).value.trim();if(!value)return;if(action(value)===false)return;$(inputId).value='';save();render();$(inputId).focus();});}
form('task-form','task-title',title=>state.tasks.push({id:id(),title,status:$('task-status').value}),taskRender);
form('habit-form','habit-title',title=>state.habits.push({id:id(),title,days:[]}),habitRender);
form('memory-form','memory-text',text=>state.memories.push({id:id(),text,reviewed:false}),memoryRender);
form('node-form','node-label',label=>{if(state.nodes.length>=24){storageError('The graph supports 24 nodes. Remove a node before adding more.');return false;}state.nodes.push({id:id(),label});},graphRender);
$('link-form').addEventListener('submit',event=>{event.preventDefault();const source=$('link-source').value,target=$('link-target').value;if(!source||!target||source===target){storageError('Choose two different knowledge nodes to connect.');return;}const exists=state.links.some(l=>(l.source===source&&l.target===target)||(l.source===target&&l.target===source));if(!exists){state.links.push({source,target});save();graphRender();}});
taskRender();habitRender();memoryRender();graphRender();renderTelemetry();refresh();
let lastDay=day();setInterval(()=>{refresh();if(lastDay!==day()){lastDay=day();habitRender();}},30000);
