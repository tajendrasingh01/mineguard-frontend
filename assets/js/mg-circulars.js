/* Circulars, Guidelines & Notifications: inbox, publishing, acknowledgement, tracking, version history, dashboard section.
   Who can see or publish what is decided by the API from the signed-in user's database record; this file only presents it. */
(function(){
const MG=window.MG,V=MG.views,esc=MG.esc;
const PRI={normal:{l:'Normal',c:'#64748b',o:3},important:{l:'Important',c:'#2563eb',o:2},urgent:{l:'Urgent',c:'#d97706',o:1},critical:{l:'Critical',c:'#dc2626',o:0}};
const CATS=['Circular','Guideline','Instruction','Advisory','Safety Alert','Notification'];
const ISSUER={HQ_SAFETY_HEAD:'HQ',AREA_SAFETY_OFFICER:'ASO',MINE_MANAGER:'Mine Manager',MINE_SO_MINING:'Mine Safety Officer',MINE_SO_EM:'Mine Safety Officer'};
const EVT={published:'Published',amended:'Amended',viewed:'Viewed',acknowledged:'Acknowledged',archived:'Archived'};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const role=()=>MG.state.user.role;
const canPublish=MG.circ_canPublish=()=>['HQ_SAFETY_HEAD','AREA_SAFETY_OFFICER','MINE_MANAGER','MINE_SO_MINING','MINE_SO_EM'].includes(role());
const maxPri=()=>MG.can.isMineSO()?'important':'critical';
const priAllowed=()=>Object.keys(PRI).filter(k=>PRI[k].o>=PRI[maxPri()].o);
const post=(p,b)=>MG.api(p,{method:'POST',body:JSON.stringify(b||{})});

/* ---------- sanitiser (applied to everything rendered from the server, and to editor output) ---------- */
const OK=new Set(['P','BR','B','STRONG','I','EM','U','UL','OL','LI','H3','H4','BLOCKQUOTE','A','SPAN','HR']);
MG.sanitize=html=>{
  const doc=new DOMParser().parseFromString('<body>'+String(html||'')+'</body>','text/html');
  const walk=n=>{[...n.childNodes].forEach(c=>{
    if(c.nodeType===3)return;
    if(c.nodeType!==1){c.remove();return}
    if(!OK.has(c.tagName)){if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH'].includes(c.tagName)){c.remove();return}walk(c);c.replaceWith(...c.childNodes);return}
    [...c.attributes].forEach(a=>{if(!(c.tagName==='A'&&a.name==='href'&&/^(https?:\/\/|mailto:)/i.test(a.value.trim())))c.removeAttribute(a.name)});
    if(c.tagName==='A'){c.setAttribute('target','_blank');c.setAttribute('rel','noopener noreferrer')}
    walk(c)})};
  walk(doc.body);return doc.body.innerHTML;
};
const pri=k=>{const m=PRI[k]||PRI.normal;return '<span class="pill cir-pri" style="--c:'+m.c+'"><span class="dot"></span>'+m.l+'</span>'};
const scopeText=c=>c.scope_type==='ALL'?'All Areas, Mines & Projects':c.scope_type==='AREA'?(c.area_name||'Area')+' · Area-wide':(c.mine_name||'Mine')+' · Mine only';
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
const q=(h,s)=>h.querySelector(s);

/* ---------- counters, nav badge, bell rows ---------- */
const C=MG.circ={canPublish,counts:{unread:0,pending_ack:0,urgent_open:0},sum:null,timer:null};
C.fetch=async()=>{try{const d=await MG.api('/api/safety/circulars/summary');const prev=C.sum;C.sum=d;C.counts=d.counts;C.paint();
  const seen=new Set(prev?[...(prev.urgent||[]),...(prev.unread||[])].map(i=>i.id+':'+i.version):[]);
  const fresh=(d.urgent||[]).filter(i=>i.unread&&!seen.has(i.id+':'+i.version));
  if(prev===null||!prev){if(fresh.length&&!sessionStorage.getItem('mg_circ_toast')){sessionStorage.setItem('mg_circ_toast','1');MG.toast(fresh.length+' urgent communication'+(fresh.length>1?'s':'')+' awaiting your attention')}}
  else if(fresh.length)MG.toast((PRI[fresh[0].priority]||PRI.normal).l+' communication: '+fresh[0].title);
 }catch{}return C.sum};
C.start=()=>{C.fetch();clearInterval(C.timer);C.timer=setInterval(()=>{if(document.visibilityState==='visible')C.fetch()},60000)};
C.paint=()=>{const a=document.querySelector('[data-nav=circulars]');if(a){let b=a.querySelector('.nav-n');if(!b){b=document.createElement('b');b.className='nav-n';a.appendChild(b)}const n=C.counts.unread;b.textContent=n>99?'99+':n;b.classList.toggle('on',n>0)}
  if(MG.notify&&MG.notify.paintBadge)MG.notify.paintBadge()};
C.bellRows=()=>{const s=C.sum;if(!s)return '';const list=[...(s.urgent||[]),...(s.unread||[]),...(s.pending||[])].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,6);
  return list.map(i=>'<button type="button" class="nt-row cir-nt" data-cir="'+esc(i.id)+'" style="--c:'+(PRI[i.priority]||PRI.normal).c+'"><span class="nt-dot'+(i.unread?' new':'')+'"></span><span class="nt-main"><b>'+esc(i.title)+' <small>'+esc(i.ref_no)+'</small></b><span>'+esc((PRI[i.priority]||PRI.normal).l+' · '+(i.pending_ack?'Acknowledgement pending':i.unread?'New communication':'Circular'))+'</span><small>'+esc(ISSUER[i.issuer_role]||'')+' · '+esc(MG.relTime(i.created_at))+'</small></span><span class="nt-tag cir">Circular</span></button>').join('')};

/* ---------- list rows ---------- */
const rowHtml=i=>'<a class="cir-row'+(i.unread?' unread':'')+'" href="#/circulars/'+esc(i.id)+'" style="--c:'+(PRI[i.priority]||PRI.normal).c+'">'
  +'<span class="cir-bar"></span><span class="cir-main"><span class="cir-t">'+(i.unread?'<i class="cir-dot" title="Unread"></i>':'')+'<b>'+esc(i.title)+'</b>'+(i.version>1?'<em class="cir-v">v'+i.version+' amended</em>':'')+'</span>'
  +'<span class="cir-s">'+esc(i.subject)+'</span>'
  +'<span class="cir-m"><span>'+esc(i.ref_no)+'</span><span>'+esc(i.category)+'</span><span>'+esc(ISSUER[i.issuer_role]||'')+' · '+esc(i.issuer_name)+'</span><span>'+MG.date(i.issue_date)+'</span></span></span>'
  +'<span class="cir-side">'+pri(i.priority)+(i.status==='archived'?'<span class="pill" style="--c:#64748b"><span class="dot"></span>Archived</span>':i.pending_ack?'<span class="pill" style="--c:#d97706"><span class="dot"></span>Ack pending</span>':i.is_recipient&&i.requires_ack&&i.acknowledged_at?'<span class="pill" style="--c:#059669"><span class="dot"></span>Acknowledged</span>':'')+'</span></a>';

/* ---------- dashboard section ---------- */
C.mountPanel=host=>{
  if(!host||!host.isConnected)return;
  const s=C.sum;if(!s){host.innerHTML='<div class="card cir-panel"><div class="card-h"><div><h3>Circulars &amp; Guidelines</h3><p class="sub">Loading…</p></div></div></div>';return}
  const tabs=[['latest','Latest',s.latest],['urgent','Urgent & critical',s.urgent],['unread','Unread',s.unread],['pending','Pending acknowledgement',s.pending],['recent','Recently issued',s.recent]];
  let cur=host._tab||(s.urgent&&s.urgent.length?'urgent':'latest');
  const draw=()=>{host._tab=cur;const t=tabs.find(x=>x[0]===cur),n=C.counts;
    host.innerHTML='<div class="card cir-panel"><div class="card-h"><div><h3>'+MG.icon('msg')+' Circulars &amp; Guidelines '+(n.unread?'<span class="cir-badge">'+n.unread+' unread</span>':'')+'</h3><p class="sub">Official communications from HQ, your Area and your Mine'+(n.pending_ack?' · <b>'+n.pending_ack+'</b> awaiting your acknowledgement':'')+'</p></div><a class="btn btn-secondary btn-sm" href="#/circulars">View all</a></div>'
      +'<div class="seg cir-tabs">'+tabs.map(x=>'<button type="button" data-t="'+x[0]+'" class="'+(x[0]===cur?'active':'')+'">'+x[1]+((x[0]==='unread'&&n.unread)||(x[0]==='pending'&&n.pending_ack)||(x[0]==='urgent'&&n.urgent_open)?' <span class="cir-c">'+(x[0]==='unread'?n.unread:x[0]==='pending'?n.pending_ack:n.urgent_open)+'</span>':'')+'</button>').join('')+'</div>'
      +'<div class="cir-list">'+((t[2]||[]).length?t[2].map(rowHtml).join(''):MG.empty('check','Nothing here','You are up to date for this view.'))+'</div></div>';
    host.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{cur=b.dataset.t;draw()})};
  draw();
};

/* ---------- inbox ---------- */
V.circulars={async render(host,params){
  const Q=params.query,st={view:Q.get('view')||'inbox',flag:Q.get('flag')||'',q:'',priority:'',category:'',issuer_role:'',ref:'',from:'',to:'',offset:0},LIM=15;
  host.innerHTML='<div class="cir-head card"><div><h3>Circulars, Guidelines &amp; Notifications</h3><p class="sub">'+(MG.can.isHQ()?'Issued by you reach every Area, Mine and Project.':MG.can.isArea()?'Issued by you reach only the Mines and Projects in your Area.':MG.can.isManager()?'Issued by you reach users of your Mine.':'Official instructions addressed to you.')+'</p></div>'+(canPublish()?'<a class="btn btn-accent" href="#/circulars/new">'+MG.icon('plus')+'Issue communication</a>':'')+'</div>'
   +'<div class="card cir-filters"><div class="cir-top"><div class="seg" id="cView"><button data-v="inbox">Inbox</button>'+(canPublish()?'<button data-v="issued">Issued by me</button>':'')+'<button data-v="archive">Archive</button></div><div class="chips" id="cFlag"><button class="chip" data-f="">All</button><button class="chip" data-f="unread">Unread</button><button class="chip" data-f="pending">Pending acknowledgement</button></div></div>'
   +'<div class="cir-fgrid"><input class="input" id="fq" placeholder="Search title, subject, issuer…" aria-label="Search"><input class="input" id="fref" placeholder="Reference no." aria-label="Reference number">'
   +'<select class="select" id="fpri" aria-label="Priority"><option value="">Any priority</option>'+Object.keys(PRI).map(k=>'<option value="'+k+'">'+PRI[k].l+'</option>').join('')+'</select>'
   +'<select class="select" id="fcat" aria-label="Category"><option value="">Any category</option>'+CATS.map(c=>'<option>'+c+'</option>').join('')+'</select>'
   +'<select class="select" id="fiss" aria-label="Issuing authority"><option value="">Any issuing authority</option><option value="HQ_SAFETY_HEAD">HQ</option><option value="AREA_SAFETY_OFFICER">ASO</option><option value="MINE_MANAGER">Mine Manager</option><option value="MINE_SO_MINING">Mine Safety Officer</option></select>'
   +'<input class="input" type="date" id="ffrom" aria-label="From date" title="Issued from"><input class="input" type="date" id="fto" aria-label="To date" title="Issued up to"></div></div>'
   +'<div id="cList" aria-live="polite"></div>';
  const list=q(host,'#cList');let tk=0,tm=null;
  const sync=()=>{host.querySelectorAll('#cView button').forEach(b=>b.classList.toggle('active',b.dataset.v===st.view));host.querySelectorAll('#cFlag .chip').forEach(b=>b.classList.toggle('on',b.dataset.f===st.flag))};
  const load=async()=>{const my=++tk;sync();list.innerHTML='<div class="card">'+MG.loaderHtml('Loading communications')+'</div>';
    const p=new URLSearchParams({view:st.view,limit:LIM,offset:st.offset});['flag','q','priority','category','issuer_role','ref','from','to'].forEach(k=>{if(st[k])p.set(k,st[k])});
    try{const d=await MG.api('/api/safety/circulars?'+p);if(my!==tk)return;
      const pages=Math.max(1,Math.ceil(d.total/LIM)),pg=Math.floor(st.offset/LIM)+1;
      list.innerHTML='<div class="cir-list card">'+(d.items.length?d.items.map(rowHtml).join(''):MG.empty('msg',st.view==='archive'?'No archived communications':'No communications match','Try clearing a filter.'))+'</div>'
        +(d.total>LIM?'<div class="cir-pager"><button class="btn btn-secondary btn-sm" id="pp" '+(pg<=1?'disabled':'')+'>Previous</button><span>Page '+pg+' of '+pages+' · '+d.total+' communications</span><button class="btn btn-secondary btn-sm" id="pn" '+(pg>=pages?'disabled':'')+'>Next</button></div>':'<div class="cir-pager"><span>'+d.total+' communication'+(d.total===1?'':'s')+'</span></div>');
      const pp=q(list,'#pp'),pn=q(list,'#pn');if(pp)pp.onclick=()=>{st.offset=Math.max(0,st.offset-LIM);load()};if(pn)pn.onclick=()=>{st.offset+=LIM;load()};
    }catch(e){if(my===tk)list.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span></div>'}};
  host.querySelectorAll('#cView button').forEach(b=>b.onclick=()=>{st.view=b.dataset.v;st.offset=0;load()});
  host.querySelectorAll('#cFlag .chip').forEach(b=>b.onclick=()=>{st.flag=b.dataset.f;st.offset=0;load()});
  const bindF=(id,k,delay)=>{const el=q(host,id);el.oninput=el.onchange=()=>{st[k]=el.value.trim();st.offset=0;clearTimeout(tm);tm=setTimeout(load,delay)}};
  bindF('#fq','q',300);bindF('#fref','ref',300);bindF('#fpri','priority',0);bindF('#fcat','category',0);bindF('#fiss','issuer_role',0);bindF('#ffrom','from',0);bindF('#fto','to',0);
  load();
}};

/* ---------- rich-text composer (new + amend) ---------- */
const TB=[['bold','B','Bold'],['italic','I','Italic'],['underline','U','Underline'],['formatBlock:H3','H','Heading'],['insertUnorderedList','•','Bulleted list'],['insertOrderedList','1.','Numbered list'],['formatBlock:BLOCKQUOTE','❝','Quote'],['createLink','🔗','Link'],['removeFormat','⌫','Clear formatting']];
function editor(host,html){
  host.innerHTML='<div class="rte-bar" role="toolbar" aria-label="Formatting">'+TB.map(t=>'<button type="button" class="rte-b" data-c="'+t[0]+'" title="'+t[2]+'" aria-label="'+t[2]+'">'+t[1]+'</button>').join('')+'</div><div class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Description" id="rte"></div>';
  const ed=q(host,'#rte');ed.innerHTML=MG.sanitize(html||'');
  host.querySelectorAll('.rte-b').forEach(b=>b.onmousedown=e=>{e.preventDefault();const [c,v]=b.dataset.c.split(':');
    if(c==='createLink'){const u=prompt('Link address (https://…)');if(u&&/^(https?:\/\/|mailto:)/i.test(u))document.execCommand('createLink',false,u);return}
    if(c==='formatBlock'){const cur=document.queryCommandValue('formatBlock').toUpperCase();document.execCommand('formatBlock',false,cur===v?'P':v);return}
    document.execCommand(c,false,null)});
  ed.addEventListener('paste',e=>{e.preventDefault();const t=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,t)});
  return {html:()=>MG.sanitize(ed.innerHTML),text:()=>ed.textContent.trim()};
}
const readFile=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok({name:f.name,type:f.type,size:f.size,data:r.result});r.onerror=()=>no(new Error('Could not read '+f.name));r.readAsDataURL(f)});
const FT=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp'];
function audienceNote(){const r=role(),sc=MG.state;return r==='HQ_SAFETY_HEAD'?'<b>All Areas, Mines and Projects</b> — every registered user will receive this.':r==='AREA_SAFETY_OFFICER'?'<b>Mines and Projects in your Area only</b> ('+esc((sc.areas[0]||{}).name||'your Area')+'). Other Areas will not receive or see it.':'<b>Users of your Mine only</b> ('+esc((sc.mines[0]||{}).name||'your Mine')+'). You cannot issue Area-wide or HQ-wide communications.'}
function form(host,{amend,onDone}){
  const a=amend;
  host.innerHTML='<form class="card cir-form" novalidate><div class="cir-aud">'+MG.icon('users')+'<span>Audience: '+audienceNote()+' Recipients are determined automatically from your role.</span></div>'
   +(a?'<div class="field"><label for="cAm">What is being amended? <span class="req">*</span></label><input class="input" id="cAm" maxlength="1000" placeholder="e.g. Corrected the deadline in point 3"><span class="hint">Recipients who already read or acknowledged will be asked to read it again. The earlier version stays on record.</span></div>':'')
   +'<div class="field-row"><div class="field"><label for="cT">Title <span class="req">*</span></label><input class="input" id="cT" maxlength="200" placeholder="e.g. Revised guidelines for belt conveyor inspection"></div>'
   +'<div class="field"><label for="cS">Subject <span class="req">*</span></label><input class="input" id="cS" maxlength="300" placeholder="One-line subject"></div></div>'
   +'<div class="field-row three"><div class="field"><label for="cC">Category</label><select class="select" id="cC"'+(a?' disabled':'')+'>'+CATS.map(c=>'<option>'+c+'</option>').join('')+'</select></div>'
   +'<div class="field"><label for="cP">Priority</label><select class="select" id="cP">'+priAllowed().reverse().map(k=>'<option value="'+k+'">'+PRI[k].l+'</option>').join('')+'</select>'+(MG.can.isMineSO()?'<span class="hint">Safety Officers may issue up to Important.</span>':'')+'</div>'
   +'<div class="field"><label for="cR">Reference no.</label><input class="input" id="cR" maxlength="60" placeholder="Auto-generated if blank"'+(a?' disabled':'')+'></div></div>'
   +'<div class="field-row"><div class="field"><label for="cI">Issue date</label><input class="input" type="date" id="cI"'+(a?' disabled':'')+'></div><div class="field"><label for="cE">Effective date</label><input class="input" type="date" id="cE"></div></div>'
   +'<div class="field"><label>Description <span class="req">*</span></label><div id="cBody" class="rte-wrap"></div></div>'
   +'<div class="field"><label>Attachments</label><label class="cir-drop"><input type="file" id="cF" multiple accept=".pdf,.docx,image/png,image/jpeg,image/webp" hidden>'+MG.icon('file')+'<span>Add PDF, DOCX or image files (max 5, 3 MB each)</span></label><div id="cFiles" class="cir-files"></div></div>'
   +'<label class="cir-chk"><input type="checkbox" id="cA" checked> Ask recipients to acknowledge</label>'
   +'<div id="cErr" class="err-box" role="alert"></div><div class="cir-actions"><a class="btn btn-secondary" href="#/circulars'+(a?'/'+esc(a.id):'')+'">Cancel</a><button class="btn btn-primary" type="submit" id="cGo">'+(a?'Publish amendment':'Publish communication')+'</button></div></form>';
  const f=q(host,'form'),ed=editor(q(host,'#cBody'),a?a.body_html:'');let files=[];
  q(f,'#cI').value=a?a.issue_date:today();
  if(a){q(f,'#cT').value=a.title;q(f,'#cS').value=a.subject;q(f,'#cC').value=a.category;q(f,'#cP').value=a.priority;q(f,'#cR').value=a.ref_no;q(f,'#cE').value=a.effective_date||'';q(f,'#cA').checked=!!a.requires_ack}
  const paintFiles=()=>{q(f,'#cFiles').innerHTML=files.map((x,i)=>'<span class="cir-file">'+MG.icon('file')+esc(x.name)+' <small>'+bytes(x.size)+'</small><button type="button" data-i="'+i+'" aria-label="Remove '+esc(x.name)+'">×</button></span>').join('');f.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{files.splice(+b.dataset.i,1);paintFiles()})};
  q(f,'#cF').onchange=async e=>{const err=q(f,'#cErr');err.classList.remove('on');
    for(const x of e.target.files){if(!FT.includes(x.type)){err.textContent=x.name+': only PDF, DOCX, PNG, JPEG or WEBP files are allowed.';err.classList.add('on');continue}
      if(x.size>3*1024*1024){err.textContent=x.name+' is larger than 3 MB.';err.classList.add('on');continue}
      if(files.length>=5){err.textContent='At most 5 attachments.';err.classList.add('on');break}files.push(await readFile(x))}
    e.target.value='';paintFiles()};
  f.onsubmit=async e=>{e.preventDefault();const err=q(f,'#cErr');err.classList.remove('on');
    const body={title:q(f,'#cT').value.trim(),subject:q(f,'#cS').value.trim(),category:q(f,'#cC').value,priority:q(f,'#cP').value,ref_no:q(f,'#cR').value.trim(),issue_date:q(f,'#cI').value,effective_date:q(f,'#cE').value,requires_ack:q(f,'#cA').checked,body_html:ed.html(),attachments:files.map(x=>({name:x.name,type:x.type,data:x.data}))};
    const bad=body.title.length<3?'Enter a title.':body.subject.length<3?'Enter a subject.':ed.text().length<3?'Enter the description.':a&&q(f,'#cAm').value.trim().length<3?'Describe what is being amended.':body.effective_date&&body.issue_date&&body.effective_date<body.issue_date?'Effective date cannot be before the issue date.':'';
    if(bad){err.textContent=bad;err.classList.add('on');return}
    const msg=a?'Publish this amendment? Recipients will be notified and asked to review it again.':'Publish now? It is delivered immediately to the audience shown above and cannot be deleted (it can be amended or archived).';
    if(!confirm(msg))return;
    const btn=q(f,'#cGo');btn.disabled=true;btn.classList.add('loading');
    try{if(a){body.amendment_note=q(f,'#cAm').value.trim();await post('/api/safety/circulars/'+a.id+'/amend',body);MG.toast('Amendment published');onDone(a.id)}
      else{const d=await post('/api/safety/circulars',body);MG.toast('Published to '+d.recipients+' recipient'+(d.recipients===1?'':'s'));onDone(d.circular.id)}
      C.fetch()}
    catch(ex){err.textContent=ex.message;err.classList.add('on');btn.disabled=false;btn.classList.remove('loading')}};
}
V.circularNew={async render(host){
  if(!canPublish()){host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>Your role cannot issue communications.</span></div>';return}
  host.innerHTML='<div class="cir-head card"><div><h3>Issue a communication</h3><p class="sub">Circulars, guidelines, instructions and advisories are delivered automatically according to your organisational scope.</p></div></div><div id="fHost"></div>';
  form(q(host,'#fHost'),{onDone:id=>MG.go('/circulars/'+id)});
}};

/* ---------- detail ---------- */
async function openFile(cid,a,dl){
  try{const d=await MG.api('/api/safety/circulars/'+cid+'/attachments/'+a.id),bin=atob(d.data_base64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([u],{type:d.mime_type}));
    if(dl||!/^(application\/pdf|image\/)/.test(d.mime_type)){const l=document.createElement('a');l.href=url;l.download=d.file_name;document.body.appendChild(l);l.click();l.remove()}else window.open(url,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){MG.toast(e.message,'err')}
}
const stat=(l,v,c)=>'<div class="cir-stat" style="--c:'+c+'"><b>'+v+'</b><span>'+l+'</span></div>';
V.circular={async render(host,params){
  host.innerHTML='<div class="card">'+MG.loaderHtml('Loading communication')+'</div>';
  const id=params.id;let d;
  try{d=await MG.api('/api/safety/circulars/'+id)}catch(e){host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span></div><p><a class="btn btn-secondary" href="#/circulars">Back to communications</a></p>';return}
  C.fetch();
  const c=d.circular;MG.setCrumbs([{label:'Circulars & Guidelines',href:'/circulars'},{label:c.ref_no}],true);
  const show=()=>{
   host.innerHTML='<article class="card cir-doc" style="--c:'+(PRI[c.priority]||PRI.normal).c+'"><div class="cir-doc-top">'+pri(c.priority)+'<span class="pill" style="--c:#475569"><span class="dot"></span>'+esc(c.category)+'</span>'+(c.status==='archived'?'<span class="pill" style="--c:#64748b"><span class="dot"></span>Archived</span>':'')+(c.version>1?'<span class="pill" style="--c:#7c3aed"><span class="dot"></span>Version '+c.version+'</span>':'')+'<span class="cir-ref">'+esc(c.ref_no)+'</span></div>'
    +'<h2>'+esc(c.title)+'</h2><p class="cir-subj">'+esc(c.subject)+'</p>'
    +'<dl class="cir-meta"><div><dt>Issued by</dt><dd>'+esc(ISSUER[c.issuer_role]||'')+' · '+esc(c.issuer_name)+'</dd></div><div><dt>Audience</dt><dd>'+esc(scopeText(c))+'</dd></div><div><dt>Issue date</dt><dd>'+MG.date(c.issue_date)+'</dd></div><div><dt>Effective from</dt><dd>'+(c.effective_date?MG.date(c.effective_date):'On issue')+'</dd></div></dl>'
    +'<div class="cir-body">'+MG.sanitize(c.body_html)+'</div>'
    +(d.attachments.length?'<div class="cir-att"><h4>Attachments</h4>'+d.attachments.map(a=>'<div class="cir-att-i">'+MG.icon('file')+'<span><b>'+esc(a.file_name)+'</b><small>'+bytes(a.size_bytes)+(a.added_in_version>1?' · added in v'+a.added_in_version:'')+'</small></span>'+(/^(application\/pdf|image\/)/.test(a.mime_type)?'<button class="btn btn-secondary btn-sm" data-view="'+a.id+'">View</button>':'')+'<button class="btn btn-secondary btn-sm" data-dl="'+a.id+'">Download</button></div>').join('')+'</div>':'')
    +'<div class="cir-ack" id="ackBar"></div></article>'
    +'<div class="cir-tools card"><div class="seg" id="tTabs">'+(d.can_track?'<button data-t="track">Delivery &amp; acknowledgement</button>':'')+'<button data-t="ver">Version history'+(d.versions.length?' ('+(d.versions.length+1)+')':'')+'</button>'+(c.is_issuer||MG.can.isHQ()?'<button data-t="audit">Audit trail</button>':'')+'</div><div class="cir-tool-acts">'
    +(d.can_amend?'<button class="btn btn-secondary btn-sm" id="bAm">'+MG.icon('edit')+'Amend</button>':'')+(d.can_archive?'<button class="btn btn-secondary btn-sm" id="bAr">Archive</button>':'')+'</div><div id="tBody"></div></div>';
   const ack=q(host,'#ackBar');
   if(c.is_recipient&&c.status==='published'){
     const done=!!c.acknowledged_at;
     ack.innerHTML=done?'<span class="ok">'+MG.icon('check')+'Acknowledged on '+MG.dateTime(c.acknowledged_at)+'</span>':'<span>'+(c.requires_ack?'Please acknowledge that you have read and understood this communication.':'Mark this communication as read.')+'</span><button class="btn btn-primary" id="bAck">'+(c.requires_ack?'Acknowledge':'Mark as read')+'</button>';
     const b=q(ack,'#bAck');if(b)b.onclick=async()=>{b.disabled=true;try{const r=await post('/api/safety/circulars/'+c.id+'/acknowledge');c.acknowledged_at=r.acknowledged_at;c.pending_ack=false;MG.toast('Acknowledged');show();C.fetch()}catch(e){MG.toast(e.message,'err');b.disabled=false}}}
   else if(c.is_issuer)ack.innerHTML='<span>You issued this communication.</span>';else ack.remove();
   host.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openFile(c.id,d.attachments.find(a=>a.id===b.dataset.view),false));
   host.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>openFile(c.id,d.attachments.find(a=>a.id===b.dataset.dl),true));
   const am=q(host,'#bAm');if(am)am.onclick=()=>{host.innerHTML='<div class="cir-head card"><div><h3>Amend: '+esc(c.title)+'</h3><p class="sub">The published text is never overwritten silently: the current version is kept in the history.</p></div></div><div id="fHost"></div>';form(q(host,'#fHost'),{amend:c,onDone:()=>MG.refresh()})};
   const ar=q(host,'#bAr');if(ar)ar.onclick=async()=>{if(!confirm('Archive this communication? It stays on record permanently but is removed from active inboxes.'))return;try{await post('/api/safety/circulars/'+c.id+'/archive');MG.toast('Archived');MG.refresh()}catch(e){MG.toast(e.message,'err')}};
   const body=q(host,'#tBody');
   const tabs={
    async track(){body.innerHTML=MG.loaderHtml('Loading tracking');try{const t=await MG.api('/api/safety/circulars/'+c.id+'/tracking'),s=t.stats,pc=n=>s.total_recipients?Math.round(n/s.total_recipients*100):0;
      body.innerHTML=(t.area_restricted?'<p class="small muted">Showing recipients in your Area only.</p>':'')+'<div class="cir-stats">'+stat('Recipients',s.total_recipients,'#475569')+stat('Delivered',s.delivered,'#2563eb')+stat('Viewed',s.viewed+' <small>'+pc(s.viewed)+'%</small>','#7c3aed')+stat('Acknowledged',s.acknowledged+' <small>'+pc(s.acknowledged)+'%</small>','#059669')+stat('Pending acknowledgement',s.pending_ack,'#d97706')+'</div>'
       +'<h4 class="cir-h4">By Mine / office</h4><div class="cir-tbl"><table><thead><tr><th>Mine / office</th><th>Recipients</th><th>Viewed</th><th>Acknowledged</th><th style="width:30%">Progress</th></tr></thead><tbody>'+t.by_mine.map(m=>'<tr><td>'+esc(m.name)+'</td><td>'+m.total+'</td><td>'+m.viewed+'</td><td>'+m.acknowledged+'</td><td><span class="cir-prog"><i style="width:'+(m.total?m.acknowledged/m.total*100:0)+'%"></i></span></td></tr>').join('')+'</tbody></table></div>'
       +'<h4 class="cir-h4">'+(c.requires_ack?'Yet to acknowledge':'Yet to view')+' ('+t.pending.length+(t.pending.length>=300?'+':'')+')</h4>'+(t.pending.length?'<div class="cir-pend">'+t.pending.map(u=>'<span class="cir-chip">'+esc(u.name)+' <small>'+esc(ISSUER[u.role]||'')+(u.mine?' · '+esc(u.mine):'')+(u.viewed?' · viewed':'')+'</small></span>').join('')+'</div>':'<p class="muted small">Everyone has responded.</p>')}catch(e){body.innerHTML='<div class="banner error">'+esc(e.message)+'</div>'}},
    async ver(){const cur='<div class="cir-ver now"><b>Version '+c.version+' (current)</b><span>'+MG.dateTime(c.updated_at)+'</span></div>',old=d.versions.map(v=>'<details class="cir-ver"><summary><b>Version '+v.version+'</b><span>superseded '+MG.dateTime(v.created_at)+'</span><em>'+esc(v.amendment_note||'')+'</em></summary><h5>'+esc(v.title)+'</h5><p class="small muted">'+esc(v.subject)+' · '+esc((PRI[v.priority]||PRI.normal).l)+'</p><div class="cir-body">'+MG.sanitize(v.body_html)+'</div></details>').join('');body.innerHTML=cur+(old||'<p class="muted small">This communication has not been amended.</p>')},
    async audit(){body.innerHTML=MG.loaderHtml('Loading audit trail');try{const a=await MG.api('/api/safety/circulars/'+c.id+'/audit');body.innerHTML=a.events.length?'<div class="cir-tbl"><table><thead><tr><th>When</th><th>Event</th><th>By</th><th>Details</th></tr></thead><tbody>'+a.events.map(e=>'<tr><td>'+MG.dateTime(e.created_at)+'</td><td>'+esc(EVT[e.event]||e.event)+'</td><td>'+esc(e.actor_name)+' <small class="muted">'+esc(ISSUER[e.actor_role]||'')+'</small></td><td class="small muted">'+esc(e.detail&&e.detail.note||(e.detail&&e.detail.version?'v'+e.detail.version:'')||(e.detail&&e.detail.recipients!=null?e.detail.recipients+' recipients':''))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted small">No events yet.</p>'}catch(e){body.innerHTML='<div class="banner error">'+esc(e.message)+'</div>'}}};
   const tb=host.querySelectorAll('#tTabs button'),open=t=>{tb.forEach(b=>b.classList.toggle('active',b.dataset.t===t));tabs[t]()};
   tb.forEach(b=>b.onclick=()=>open(b.dataset.t));if(tb.length)open(tb[0].dataset.t);
  };
  show();
}};
})();
