/* Report incident wizard, My Reports and SOP library. Payload shape matches POST /api/safety/incidents. */
(function(){
const MG=window.MG,S=MG.state,D=MG.data,esc=MG.esc,V=MG.views=MG.views||{};

const T={
 en:{eyebrow:'Operational Safety',title:'Report Incident',sub:'Five quick steps. Add as much detail as you can.',s1:'Classify',s2:'When & where',s3:'Details',s4:'Evidence',s5:'Review',
  cat:'Report category',catMore:'More classifications',type:'Incident type',sev:'Severity level',date:'Date',time:'Time',loc:'Location',locd:'Level / zone detail',inj:'Persons injured',mine:'Mine / Project',disc:'Discipline',
  desc:'What happened?',act:'Immediate actions taken',ppe:'PPE worn?',sop:'SOPs followed?',wit:'Witnesses',sup:'Supervisor on duty',photos:'Photos / evidence',choose:'Choose files',cam:'Camera',drop:'Drop photos here or choose files',
  back:'Back',next:'Continue',submit:'Submit report',discard:'Discard',yes:'Yes',no:'No',partial:'Partial',unknown:'Unknown',as:'Reporting as',optional:'optional',edit:'Edit',none:'None',
  ph:{desc:'Describe the sequence of events…',act:'e.g. Area evacuated, first aid given…',wit:'Names of any witnesses',sup:'Supervisor name',zone:'e.g. Level 4 – Block 2A'}},
 hi:{eyebrow:'परिचालन सुरक्षा',title:'घटना की रिपोर्ट करें',sub:'पाँच छोटे चरण। यथासंभव पूरी जानकारी भरें।',s1:'वर्गीकरण',s2:'कब और कहाँ',s3:'विवरण',s4:'साक्ष्य',s5:'समीक्षा',
  cat:'रिपोर्ट श्रेणी',catMore:'अन्य वर्गीकरण',type:'घटना का प्रकार',sev:'गंभीरता का स्तर',date:'दिनांक',time:'समय',loc:'स्थान',locd:'लेवल / क्षेत्र का विवरण',inj:'घायल व्यक्ति',mine:'खदान / परियोजना',disc:'अनुशासन',
  desc:'क्या हुआ?',act:'तत्काल की गई कार्रवाई',ppe:'PPE पहना था?',sop:'SOP का पालन किया गया?',wit:'गवाह',sup:'ड्यूटी पर पर्यवेक्षक',photos:'फोटो / साक्ष्य',choose:'फ़ाइलें चुनें',cam:'कैमरा',drop:'फोटो यहाँ छोड़ें या फ़ाइलें चुनें',
  back:'पीछे',next:'आगे बढ़ें',submit:'रिपोर्ट जमा करें',discard:'हटाएं',yes:'हाँ',no:'नहीं',partial:'आंशिक',unknown:'अज्ञात',as:'रिपोर्टकर्ता',optional:'वैकल्पिक',edit:'बदलें',none:'कोई नहीं',
  ph:{desc:'घटनाक्रम का वर्णन करें…',act:'जैसे: क्षेत्र खाली कराया, प्राथमिक उपचार दिया…',wit:'गवाहों के नाम',sup:'पर्यवेक्षक का नाम',zone:'जैसे: लेवल 4 – ब्लॉक 2A'}}
};
const CATS=[['Unsafe Act','act','Unsafe behaviour or practice observed'],['Unsafe Condition','condition','Hazardous equipment or surroundings'],['Near Miss','near','Could have caused harm but did not'],['Incident Reporting','incident','An actual incident or injury occurred']];
const MORE_CATS=['Unsafe Practice','Unsafe Acts'];
const TYPES=['Rock Fall / Ground Failure','Blasting Accident','Equipment / Machinery Accident','Electrical Incident','Fire / Explosion','Gas / Fume Exposure','Fall from Height','Slip, Trip or Fall','Flooding / Inrush','Entrapment / Entanglement','Chemical Exposure / Spill','Vehicle Collision','Lifting / Manual Handling Injury','Near Miss','Other'];
const LOCS=['Surface – General','Surface – Workshop','UG – Stope','UG – Development','UG – Haulage','UG – Ventilation','Conveyor Belt','Incline','Dispatch'];
const LOC_IC={'Surface – General':'mapf','Surface – Workshop':'hard','UG – Stope':'layers','UG – Development':'layers','UG – Haulage':'send','UG – Ventilation':'activity','Conveyor Belt':'list','Incline':'trend','Dispatch':'upright'};
const STEPS=['s1','s2','s3','s4','s5'];
let R=null,lang='en';
const fresh=()=>({step:0,category:'',type:'',severity:'',date:new Date().toISOString().slice(0,10),time:new Date().toTimeString().slice(0,5),mine_id:'',discipline:'Mining',location:'',zone:'',injured:0,desc:'',act:'',ppe:'yes',sop:'yes',wit:'',sup:'',photos:[]});
const t=()=>T[lang];

/* ---------- image helpers ---------- */
const readUrl=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
async function packPhoto(f){
  try{
    const src=await readUrl(f),img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src});
    const max=1600,sc=Math.min(1,max/Math.max(img.width,img.height));if(sc===1&&f.size<600000)return {name:f.name,type:f.type,data:src};
    const c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return {name:f.name.replace(/\.\w+$/,'')+'.jpg',type:'image/jpeg',data:c.toDataURL('image/jpeg',.8)};
  }catch{return {name:f.name,type:f.type,data:await readUrl(f)}}
}

/* ---------- wizard ---------- */
V.report={
  render(host){
    if(!R){R=fresh();R.discipline=S.user.role==='MINE_SO_MINING'?'Mining':'Electrical & Mechanical'}
    const draw=()=>{
      const L=t(),s=R.step;
      host.innerHTML='<div class="wz"><div class="wz-head"><div><div class="eyebrow">'+esc(L.eyebrow)+'</div><h2>'+esc(L.title)+'</h2><p class="muted" style="margin-top:3px">'+esc(L.sub)+'</p></div><div class="seg" role="group" aria-label="Language"><button type="button" data-l="en" class="'+(lang==='en'?'active':'')+'">EN</button><button type="button" data-l="hi" class="'+(lang==='hi'?'active':'')+'">हिं</button></div></div>'
       +'<div class="wz-steps" role="list">'+STEPS.map((k,i)=>'<button type="button" role="listitem" class="wz-step '+(i===s?'active':i<s?'done':'')+'" data-s="'+i+'"><span class="n">'+(i<s?'✓':i+1)+'</span>'+esc(L[k])+'</button>').join('')+'</div>'
       +'<form class="card" id="wzForm" novalidate><div class="wz-panel" id="panel">'+panel(s)+'</div><div class="wz-actions"><div style="display:flex;gap:8px">'+(s>0?'<button type="button" class="btn btn-secondary" id="bk">'+MG.icon('left')+esc(L.back)+'</button>':'')+'<button type="button" class="btn btn-ghost" id="dc">'+esc(L.discard)+'</button></div>'+(s<4?'<button type="button" class="btn btn-primary" id="nx">'+esc(L.next)+MG.icon('arrow')+'</button>':'<button type="submit" class="btn btn-accent" id="sb">'+MG.icon('send')+esc(L.submit)+'</button>')+'</div></form></div>';
      wire(host,draw);
    };
    draw();
  }
};
const field=(l,inner,span,hint)=>'<div class="field'+(span?' span':'')+'"><label>'+esc(l)+'</label>'+inner+(hint?'<span class="hint">'+esc(hint)+'</span>':'')+'</div>';
function panel(s){
  const L=t(),mineSO=MG.can.isMineSO(),minesList=S.mines;
  if(s===0){
    const sevs=MG.SEV_KEYS.map(k=>{const m=MG.SEVERITY[k];return '<button type="button" class="choice '+(R.severity===k?'sel':'')+'" data-sev="'+k+'" style="--c:'+m.color+';--bg-c:'+MG.tint(m.color,.08)+'"><b>'+m.label+'</b></button>'}).join('');
    return '<div class="small muted">'+esc(L.as)+' <b style="color:var(--ink)">'+esc(S.user.name||S.user.worker_id)+'</b> · '+esc(S.user.worker_id||'')+(S.user.department?' · '+esc(S.user.department):'')+'</div>'
     +field(L.cat,'<div class="choice-grid">'+CATS.map(([v,k,d])=>'<button type="button" class="choice '+(R.category===v?'sel':'')+'" data-cat="'+esc(v)+'" style="--c:'+MG.CATEGORY[k].color+';--bg-c:'+MG.tint(MG.CATEGORY[k].color,.08)+'"><b>'+esc(v)+'</b><small>'+esc(d)+'</small></button>').join('')+'</div><details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">'+esc(L.catMore)+'</summary><div class="chips" style="margin-top:8px">'+MORE_CATS.map(v=>'<button type="button" class="chip '+(R.category===v?'on':'')+'" data-cat="'+esc(v)+'">'+esc(v)+'</button>').join('')+'</div></details>',true)
     +field(L.type,'<select class="select" id="fType"><option value="">— Select —</option>'+TYPES.map(x=>'<option '+(R.type===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>',true)
     +field(L.sev,'<div class="choice-grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">'+sevs+'</div>',true);
  }
  if(s===1){
    return '<div class="field-row">'+field(L.date,'<input class="input" type="date" id="fDate" value="'+esc(R.date)+'" max="'+new Date().toISOString().slice(0,10)+'">')+field(L.time,'<input class="input" type="time" id="fTime" value="'+esc(R.time)+'">')+'</div>'
     +(MG.can.isHQ()?'<div class="field-row">'+field(L.mine,'<select class="select" id="fMine"><option value="">— Select —</option>'+minesList.map(m=>'<option value="'+esc(m.id)+'" '+(R.mine_id===m.id?'selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select>')+field(L.disc,'<select class="select" id="fDisc">'+['Mining','Electrical & Mechanical'].map(d=>'<option '+(R.discipline===d?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select>')+'</div>'
        :mineSO&&minesList[0]?'<div class="small muted">'+MG.icon('pin')+' '+esc(L.mine)+': <b style="color:var(--ink)">'+esc(minesList[0].name)+'</b></div>':'')
     +field(L.loc,'<div class="choice-grid">'+LOCS.map(l=>'<button type="button" class="choice '+(R.location===l?'sel':'')+'" data-loc="'+esc(l)+'" style="display:flex;align-items:center;gap:9px">'+MG.icon(LOC_IC[l]||'pin')+'<b>'+esc(l)+'</b></button>').join('')+'</div>',true)
     +'<div class="field-row">'+field(L.locd,'<input class="input" id="fZone" maxlength="500" placeholder="'+esc(L.ph.zone)+'" value="'+esc(R.zone)+'">')+field(L.inj,'<input class="input" id="fInj" type="number" min="0" max="999" value="'+esc(R.injured)+'">')+'</div>';
  }
  if(s===2){
    const tog=(id,cur,opts)=>'<div class="toggle3" id="'+id+'">'+opts.map(o=>'<button type="button" data-v="'+o+'" class="'+(cur===o?'active':'')+'">'+esc(L[o])+'</button>').join('')+'</div>';
    return field(L.desc,'<textarea class="textarea" id="fDesc" maxlength="10000" style="min-height:130px" placeholder="'+esc(L.ph.desc)+'">'+esc(R.desc)+'</textarea>',true)
     +field(L.act+' ('+L.optional+')','<textarea class="textarea" id="fAct" maxlength="5000" placeholder="'+esc(L.ph.act)+'">'+esc(R.act)+'</textarea>',true)
     +'<div class="field-row">'+field(L.ppe,tog('tPPE',R.ppe,['yes','no','partial']))+field(L.sop,tog('tSOP',R.sop,['yes','no','unknown']))+'</div>'
     +'<div class="field-row">'+field(L.wit+' ('+L.optional+')','<input class="input" id="fWit" maxlength="1000" placeholder="'+esc(L.ph.wit)+'" value="'+esc(R.wit)+'">')+field(L.sup+' ('+L.optional+')','<input class="input" id="fSup" maxlength="150" placeholder="'+esc(L.ph.sup)+'" value="'+esc(R.sup)+'">')+'</div>';
  }
  if(s===3){
    return field(L.photos+' ('+L.optional+')','<div class="drop" id="drop"><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn btn-secondary btn-sm" id="pg">'+MG.icon('image')+esc(L.choose)+'</button><button type="button" class="btn btn-secondary btn-sm" id="pc">'+MG.icon('camera')+esc(L.cam)+'</button></div><span class="small">'+esc(L.drop)+'</span></div><input type="file" id="fileG" accept="image/*" multiple hidden><input type="file" id="fileC" accept="image/*" capture="environment" hidden><div class="thumbs" id="thumbs" style="margin-top:12px">'+thumbs()+'</div>',true);
  }
  const rows=[[L.cat,R.category],[L.type,R.type],[L.sev,MG.sevMeta(R.severity).label],[L.date,R.date+' '+R.time],[L.loc,[R.location,R.zone].filter(Boolean).join(' · ')],[L.inj,R.injured],[L.ppe+' / '+L.sop,L[R.ppe]+' / '+L[R.sop]],[L.photos,R.photos.length+'']];
  if(MG.can.isHQ())rows.splice(3,0,[L.mine,S.mineMap.get(R.mine_id)?.name||''],[L.disc,R.discipline]);
  return '<div class="summary-box">'+rows.map(([k,v])=>'<div><small>'+esc(k)+'</small><b style="text-align:right;max-width:68%;overflow-wrap:anywhere">'+esc(v||'—')+'</b></div>').join('')+'</div><div class="fact wide"><small>'+esc(L.desc)+'</small><b>'+esc(R.desc||'—')+'</b></div>'+(R.act?'<div class="fact wide"><small>'+esc(L.act)+'</small><b>'+esc(R.act)+'</b></div>':'');
}
function thumbs(){return R.photos.map((f,i)=>'<div class="thumb"><img alt="Selected photo '+(i+1)+'" src="'+f.data+'"><button type="button" data-rm="'+i+'" aria-label="Remove photo">'+MG.icon('x')+'</button></div>').join('')}
function capture(host){
  const v=id=>host.querySelector(id),g=(id,k,f)=>{const e=v(id);if(e)R[k]=f?f(e.value):e.value};
  g('#fType','type');g('#fDate','date');g('#fTime','time');g('#fMine','mine_id');g('#fDisc','discipline');g('#fZone','zone');g('#fInj','injured',x=>Math.max(0,Math.min(999,Number(x)||0)));g('#fDesc','desc');g('#fAct','act');g('#fWit','wit');g('#fSup','sup');
  const a=v('#tPPE .active');if(a)R.ppe=a.dataset.v;const b=v('#tSOP .active');if(b)R.sop=b.dataset.v;
}
function validate(s){
  const L=t();
  if(s===0){if(!R.category)return 'Select a report category';if(!R.type)return 'Select the incident type';if(!R.severity)return 'Select the severity level'}
  if(s===1){if(!R.date||!R.time)return 'Enter the date and time of the incident';if(!R.location)return 'Select the incident location'}
  if(s===2){if(!R.desc.trim())return 'Describe what happened'}
  return '';
}
function wire(host,draw){
  const $=s=>host.querySelector(s);
  host.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{capture(host);lang=b.dataset.l;draw()});
  host.querySelectorAll('.wz-step').forEach(b=>b.onclick=()=>{capture(host);const to=Number(b.dataset.s);if(to>R.step){for(let i=R.step;i<to;i++){const e=validate(i);if(e){MG.toast(e,'err');return}}}R.step=to;draw()});
  host.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{capture(host);R.category=b.dataset.cat;if(!R.severity||['nearMiss','minor'].includes(R.severity))R.severity=R.category==='Near Miss'?'nearMiss':'minor';draw()});
  host.querySelectorAll('[data-sev]').forEach(b=>b.onclick=()=>{capture(host);R.severity=b.dataset.sev;draw()});
  host.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{capture(host);R.location=b.dataset.loc;draw()});
  host.querySelectorAll('.toggle3').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))}));
  if($('#bk'))$('#bk').onclick=()=>{capture(host);R.step--;draw()};
  if($('#nx'))$('#nx').onclick=()=>{capture(host);const e=validate(R.step);if(e){MG.toast(e,'err');return}R.step++;draw();window.scrollTo({top:0,behavior:'smooth'})};
  $('#dc').onclick=()=>{if(confirm('Discard this report?')){R=null;V.report.render(host)}};
  const add=async files=>{const list=[...files].filter(f=>f.type.startsWith('image/'));if(!list.length)return;const out=[];for(const f of list)out.push(await packPhoto(f));R.photos.push(...out);$('#thumbs').innerHTML=thumbs();bindRm()};
  const bindRm=()=>host.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{R.photos.splice(Number(b.dataset.rm),1);$('#thumbs').innerHTML=thumbs();bindRm()});
  if($('#fileG')){$('#pg').onclick=()=>$('#fileG').click();$('#pc').onclick=()=>$('#fileC').click();$('#fileG').onchange=e=>{add(e.target.files);e.target.value=''};$('#fileC').onchange=e=>{add(e.target.files);e.target.value=''};bindRm();
    const d=$('#drop');['dragenter','dragover'].forEach(n=>d.addEventListener(n,e=>{e.preventDefault();d.classList.add('over')}));['dragleave','drop'].forEach(n=>d.addEventListener(n,e=>{e.preventDefault();d.classList.remove('over')}));d.addEventListener('drop',e=>add(e.dataTransfer.files))}
  $('#wzForm').onsubmit=e=>{e.preventDefault();for(let i=0;i<3;i++){const er=validate(i);if(er){R.step=i;draw();MG.toast(er,'err');return}}
    MG.busy($('#sb'),async()=>{
      const photos=R.photos.length?JSON.stringify(R.photos):null;if(photos&&photos.length>6800000)throw Error('Photos are too large to upload. Remove some and try again.');
      const payload={category:R.category,discipline:(S.user.role==='MINE_SO_MINING'?'Mining':'Electrical & Mechanical'),incident_type:R.type,date_of_incident:R.date,time_of_incident:R.time,location_zone:R.location,location_detail:R.zone,severity:R.severity,persons_injured:Number(R.injured)||0,description:R.desc,immediate_actions:R.act,ppe_worn:R.ppe,sop_followed:R.sop,witnesses:R.wit,supervisor_on_duty:R.sup,photos};
      const saved=await MG.api('/api/safety/incidents',{method:'POST',body:JSON.stringify(payload)});
      R=null;S.loadedKey=null;MG.toast(saved.routed_to?'Incident reported and forwarded to '+(saved.routed_to.name||'the Mine Manager')+' (Mine Manager) for review':saved.routed_to===null?'Incident reported. No active Mine Manager is configured for this mine yet — it is visible to the mine team.':'Incident report submitted');const id=saved.incident?.id;
      MG.go(id?'/my-reports/'+id:'/my-reports');
    });};
}

/* ---------- My Reports ---------- */
V.myreports={
  async render(host){
    host.innerHTML='<div class="feed">'+MG.skeleton(4,190)+'</div>';
    try{
      const d=await MG.api('/api/safety/incidents/mine?'+D.params());
      const rows=(d.incidents||[]).map(r=>({...r,mine_name:D.mineName(r.mine_id)||S.mines[0]?.name||'',_t:new Date(r.created_at).getTime(),_cat:MG.catKey(r.category)}));
      host.innerHTML='<div class="banner info">'+MG.icon('info')+'<span>This view shows your submitted reports and their status. Investigation, resolution and closure are handled by the assigned Mine Manager.</span></div><div id="mr"></div>';
      MG.ui.feed(host.querySelector('#mr'),rows,{extra:rows,empty:'No incidents have been reported by your account in this period.',onOpen:id=>MG.go('/my-reports/'+id)});
    }catch(e){host.innerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span><button class="btn btn-secondary btn-sm" id="retry">Retry</button></div>';host.querySelector('#retry').onclick=()=>V.myreports.render(host)}
  }
};

/* ---------- SOP library (NCPH roles) ---------- */
const driveHref=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname)?u.href:null}catch{return null}};
V.sops={
  async render(host){
    host.innerHTML='<div class="card" style="margin-bottom:16px"><div class="card-h" style="margin:0"><div><h3>NCPH Mine · SOP Library</h3><p class="sub">Standard Operating Procedures and safety updates for North Chirimiri Ponri Hill Mine</p></div><a class="btn btn-secondary" href="https://shorturl.at/V0HNE" target="_blank" rel="noopener noreferrer">Open SOP Library '+MG.icon('ext')+'</a></div></div><div id="docs" class="doc-grid">'+MG.skeleton(3,120)+'</div>';
    try{
      const all=(await MG.api('/api/sops')).sops||[],stat=all.filter(x=>String(x.category||'').startsWith('[STAT]')),sop=all.filter(x=>!String(x.category||'').startsWith('[STAT]'));
      const cardOf=x=>{const link=driveHref(x.drive_url);return '<article class="card doc lift"><span class="small muted">'+esc(String(x.category||'').replace('[STAT] ',''))+(x.rev?' · '+esc(x.rev):'')+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description||'')+'</p>'+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer" class="strong small">Open document '+MG.icon('ext')+'</a>':'<span class="small faint">Drive link not configured</span>')+'</article>'};
      host.querySelector('#docs').outerHTML=(sop.length?'<div class="doc-grid">'+sop.map(cardOf).join('')+'</div>':'<p class="muted">No additional SOP documents have been uploaded to the portal.</p>')+(stat.length?'<div class="section-title"><h2>Statutory documents</h2></div><div class="doc-grid">'+stat.map(cardOf).join('')+'</div>':'');
    }catch(e){host.querySelector('#docs').outerHTML='<div class="banner error">'+MG.icon('alert')+'<span>'+esc(e.message)+'</span></div>'}
  }
};
})();
