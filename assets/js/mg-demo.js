/* Demo mode: a complete, self-contained demonstration environment.
   – Fictional data only (no real people, mines or incidents), generated once and kept in this browser (localStorage).
   – Nothing is ever sent to the live API: while demo mode is on, every /api/ request is answered locally.
   – The workflow rules below mirror the live backend (safety-policy.js: decideWorkflow), so actions are fully interactive. */
(function(){
'use strict';
const KEY='mg_demo',DBK='mg_demo_db_v3',PASS='Demo@2026',DAY=864e5,HR=36e5;
const PERSONAS={
  so:{login:'demo.so',userId:'u-so',label:'Safety Officer · Mining',blurb:'Reports incidents, acts on Mine Manager remarks'},
  soem:{login:'demo.soem',userId:'u-soem',label:'Safety Officer · E&M',blurb:'Electrical & Mechanical reporting and action'},
  mm:{login:'demo.mm',userId:'u-mm',label:'Mine Manager',blurb:'Reviews, escalates and is the only role that can close'},
  aso:{login:'demo.aso',userId:'u-aso',label:'Area Safety Officer',blurb:'Gives recommendations on escalated incidents'},
  hq:{login:'demo.hq',userId:'u-hq',label:'HQ Safety Head',blurb:'Corporate view of all areas; recommends on escalations'}
};
const PRIMARY_MINE_ID='7bb6efc1-77b7-4a5e-9dc5-dc9596dc7c3e';/* same id the portal uses for the SOP Library mine, so the SOP module is populated */

/* ----------------------------- workflow rules (mirror of backend safety-policy.js) ----------------------------- */
const SO=['MINE_SO_MINING','MINE_SO_EM'];
const WF={
  REVIEW:{roles:['MINE_MANAGER'],from:['open','under_review','resolved'],status:'action_assigned',to:'MINE_SO',action:'ASSIGN',kind:'review_to_so',stage:'with_so',required:['remarks','recommendations']},
  ACTION_TAKEN:{roles:SO,from:['action_assigned'],assignee:true,status:'resolved',to:'MINE_MANAGER',action:'FORWARD',kind:'action_taken',stage:'awaiting_closure',required:['actions']},
  REQUEST_ESCALATION:{roles:SO,from:['action_assigned'],assignee:true,status:'under_review',to:'MINE_MANAGER',action:'FORWARD',kind:'escalation_request',stage:'escalation_requested',required:['justification'],level:true},
  ESCALATE:{roles:['MINE_MANAGER'],from:['open','under_review'],status:'escalated',to:'LEVEL',action:'ESCALATE',kind:'escalation',stage:'LEVEL',required:['remarks'],level:true},
  RECOMMEND:{roles:['AREA_SAFETY_OFFICER','HQ_SAFETY_HEAD'],from:['escalated'],assignee:true,status:'under_review',to:'MINE_MANAGER',action:'FORWARD',kind:'recommendation',stage:'recommended',required:['recommendations']},
  CLOSE:{roles:['MINE_MANAGER'],from:['resolved'],status:'closed',to:'SELF',action:'FORWARD',kind:'closure',stage:'closed',required:['remarks']}
};
const LEVELS={ASO:{role:'AREA_SAFETY_OFFICER',stage:'with_aso'},HQ:{role:'HQ_SAFETY_HEAD',stage:'with_hq'}};
function decide({role,status,step,level,isAssignee,fields}){
  const w=WF[step];if(!w)return {ok:false,code:400,error:'Unknown workflow step'};
  if(!w.roles.includes(role))return {ok:false,code:403,error:'Your role is not permitted to perform this step'};
  if(!w.from.includes(status))return {ok:false,code:409,error:"This step is not available at the incident's current stage"};
  if(w.assignee&&!isAssignee)return {ok:false,code:403,error:'This incident is not currently assigned to you'};
  let to=w.to,stage=w.stage;
  if(w.level){const l=LEVELS[level];if(!l)return {ok:false,code:400,error:'Choose the escalation level: Area Safety Officer (ASO) or HQ'};if(to==='LEVEL'){to=l.role;stage=l.stage}}
  for(const f of w.required){const v=String((fields&&fields[f])||'').trim();if(!v)return {ok:false,code:400,error:'Required: '+f};if(v.length>4000)return {ok:false,code:400,error:f+' is too long'}}
  return {ok:true,status:w.status,to,action:w.action,kind:w.kind,stage,level:w.level?level:null};
}

/* ----------------------------- seeded data ----------------------------- */
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const AREAS=[{id:'d-a1',name:'Sundarpur Area'},{id:'d-a2',name:'Rajnagar Area'},{id:'d-a3',name:'Bhilori Area'}];
const MINES=[
  {id:PRIMARY_MINE_ID,area_id:'d-a1',name:'Sundarpur UG Colliery',code:'SUND',w:70},{id:'d-m2',area_id:'d-a1',name:'Sundarpur OC Project',code:'SOCP',w:24},{id:'d-m3',area_id:'d-a1',name:'Kharsia Hill UG Mine',code:'KHUG',w:20},
  {id:'d-m4',area_id:'d-a2',name:'Rajnagar OC Project',code:'RJOC',w:26},{id:'d-m5',area_id:'d-a2',name:'Devgarh UG Mine',code:'DVUG',w:20},{id:'d-m6',area_id:'d-a2',name:'Madhuban Colliery',code:'MADH',w:18},
  {id:'d-m7',area_id:'d-a3',name:'Bhilori OC-I',code:'BHO1',w:24},{id:'d-m8',area_id:'d-a3',name:'Bhilori OC-II',code:'BHO2',w:20},{id:'d-m9',area_id:'d-a3',name:'Tamnar UG Mine',code:'TMUG',w:18},{id:'d-m10',area_id:'d-a3',name:'Lohardi Colliery',code:'LOHA',w:16}
];
const FIRST=['Aarav','Vivaan','Imran','Sunita','Deepak','Pooja','Karan','Meera','Sanjay','Neha','Arjun','Farhan','Lata','Vikram','Ishaan','Rekha','Naveen','Tara','Harish','Divya'];
const LAST=['Singh','Khan','Mishra','Patel','Das','Iyer','Bose','Menon','Chauhan','Tiwari','Pillai','Dubey','Reddy','Sharma','Gupta','Mehta','Yadav','Pandey'];
const TYPES=['Rock Fall / Ground Failure','Blasting Accident','Equipment / Machinery Accident','Electrical Incident','Fire / Explosion','Gas / Fume Exposure','Fall from Height','Slip, Trip or Fall','Flooding / Inrush','Entrapment / Entanglement','Chemical Exposure / Spill','Vehicle Collision','Lifting / Manual Handling Injury','Near Miss','Other'];
const TYPE_W=[14,3,12,9,4,5,6,14,3,6,3,8,8,10,3],SLOW={'Fire / Explosion':2.3,'Flooding / Inrush':2.1,'Rock Fall / Ground Failure':1.7,'Blasting Accident':1.6,'Electrical Incident':1.35,'Gas / Fume Exposure':1.4,'Near Miss':.6,'Slip, Trip or Fall':.8};
const LOCS=['Surface – General','Surface – Workshop','UG – Stope','UG – Development','UG – Haulage','UG – Ventilation','Conveyor Belt','Incline','Dispatch'],LOC_W=[8,10,18,12,14,6,14,8,6];
const DETAILS=['Level 2, Panel 4','Gallery 3 junction','Near loading point','Shaft-side bench','Section B, Pillar 12','Workshop bay 2','Belt drive head','Incline 1 in 5, mid-section','Weighbridge approach','Return airway','Sump area'];
const DESC={
  'Rock Fall / Ground Failure':['Loose roof slab dislodged near the face during support installation. Area barricaded; no one was under the fall.','Side fall of friable coal observed along the gallery rib; two roof bolts found loosened.'],
  'Blasting Accident':['Misfire detected after a round; area kept cordoned until the competent person cleared it.','Flyrock crossed the danger zone boundary; persons had already been withdrawn.'],
  'Equipment / Machinery Accident':['Continuous miner hydraulic hose burst during operation, sprayed fluid near the operator.','Shuttle car brake response delayed while loaded on the incline.'],
  'Electrical Incident':['Trailing cable insulation found damaged with exposed conductor near the feeder breaker.','Flameproof gland found missing on a junction box in the section.'],
  'Fire / Explosion':['Heating observed at the belt drive due to a seized idler; fire party responded and extinguished it.','Spontaneous heating indications (CO rise) noticed in a goaf-side stopping.'],
  'Gas / Fume Exposure':['Methane reading touched 0.9% at the return side during routine check; ventilation adjusted.','Fumes lingered after blasting due to a partially closed regulator.'],
  'Fall from Height':['Worker slipped while climbing the crusher platform ladder; harness was not anchored.','Scaffold plank displaced during maintenance at the silo top.'],
  'Slip, Trip or Fall':['Worker slipped on a wet, uneven haulage floor carrying tools.','Tripped over loose cable laid across the walkway.'],
  'Flooding / Inrush':['Water ingress increased in the dip workings after heavy rain; pumps started.','Sump level exceeded the alarm mark; standby pump commissioned.'],
  'Entrapment / Entanglement':['Glove caught in a rotating idler during belt cleaning; belt was stopped promptly.','Hand pinched between a chock and the support leg.'],
  'Chemical Exposure / Spill':['Hydraulic oil spill of about 20 L near the workshop drain; absorbent applied.','Small spill during lubricant transfer; containment tray was absent.'],
  'Vehicle Collision':['Dumper reversed into a service vehicle at the dispatch yard; no injury.','Two light vehicles brushed at a blind turn near the weighbridge.'],
  'Lifting / Manual Handling Injury':['Back strain while lifting a roof bolt bundle without mechanical aid.','Finger injury while handling a heavy chain pulley block.'],
  'Near Miss':['Suspended load swung close to a worker standing within the lifting radius.','Roof bolter nearly struck by a rolling stone; no injury.'],
  'Other':['Unauthorised entry observed near a restricted electrical room.','Poor housekeeping observed around the emergency exit route.']
};
const ACT_TXT=['Area barricaded and work stopped','First aid given and supervisor informed','Equipment isolated and tagged out','Ventilation checked; area cleared by the competent person','Spill contained with absorbent','Persons withdrawn from the danger zone'];
const REMARKS=['Reviewed the report. The cause appears to be inadequate supervision during a routine task; needs a corrective plan with dates.','Observation is valid and recurring in this section. Requires a permanent fix, not just a temporary arrangement.','Seen on site. Barricading is in place, but the root cause is not yet addressed.','Severity assessed as higher than reported given the exposure of nearby workers. Treat as priority.','Contributing factor is equipment condition. Maintenance records need to be attached to the action report.'];
const RECS=['Inspect all similar locations in the section within 7 days and record findings.','Conduct a toolbox talk for the shift and record attendance.','Repair or replace the faulty item and submit a photo as evidence.','Update the risk assessment for this task and brief all operators.','Install a permanent guard/barrier and verify at the next safety committee.'];
const ACTIONS=['Faulty component replaced, area re-inspected and cleared. Toolbox talk held for 24 workers.','Barrier and signage installed; supervisor briefed all three shifts. Photographs attached to the file.','Roof support re-installed as per the support plan and re-examined by the competent person.','Cable replaced and tested by the electrical supervisor; megger readings recorded.','Housekeeping drive completed; SOP refreshed with the crew and acknowledged by signatures.'];
const JUST=['The fix needs engineering design input beyond the mine\'s resources.','Similar failures were seen at two other locations; an area-level review is needed.','Needs budget sanction and procurement not within the mine\'s delegation.','Repeated recurrence despite corrective action; senior oversight requested.'];
const ESC_REM=['Agree with the Safety Officer. Needs area-level review of the support design.','Recurring pattern; seeking recommendation on the permanent engineering solution.','Beyond the mine\'s delegation of powers; requesting senior guidance.'];
const ASO_REC=['Carry out a joint inspection with the area ground-control cell and revise the support plan for this panel.','Adopt the area standard for guarding and schedule a refresher for operators; report compliance in 15 days.','Procure the recommended replacement parts through the area store; interim barricading to stay in place.'];
const HQ_REC=['HQ observation: treat as a lessons-learnt case; circulate a safety alert to all mines.','Include in the quarterly review. Approve the engineering modification and track completion monthly.','Recommend a time-bound corrective plan and a verification audit by the area team.'];
const CLOSE_REM=['Verified on site. Corrective action is adequate and sustained; closing.','Action report and evidence reviewed. No recurrence in the follow-up period; closed.','Satisfied with the corrective and preventive measures. Closed with learning shared at the safety meeting.'];
const COMMENTS={MINE_MANAGER:['Following up on site tomorrow morning.','Please attach the maintenance record to this file.','Discussed in the pit-head safety meeting.'],AREA_SAFETY_OFFICER:['Area observation: similar issue noted at a neighbouring mine; sharing the checklist.','Please confirm the timeline for the permanent fix.'],HQ_SAFETY_HEAD:['HQ observation: good reporting practice. Please maintain this level of detail.','HQ observation: add this to the monthly review pack.']};

function build(){
  const R=rng(20261116),NOW=Date.now();
  const pick=a=>a[Math.floor(R()*a.length)],wpick=(a,w)=>{const t=w.reduce((x,y)=>x+y,0);let r=R()*t;for(let i=0;i<a.length;i++){r-=w[i];if(r<=0)return a[i]}return a[a.length-1]};
  const rr=(a,b)=>a+R()*(b-a),name=()=>pick(FIRST)+' '+pick(LAST);
  const db={v:3,rev:5,seededAt:NOW,areas:AREAS.map(a=>({...a,normalized_name:a.name.toLowerCase()})),mines:MINES.map(m=>({id:m.id,area_id:m.area_id,name:m.name,code:m.code})),users:[],incidents:[],history:{},comments:{},seq:{},sops:sops()};
  const U=(u)=>{db.users.push({is_active:true,worker_id:'DEMO-'+String(1000+db.users.length),department:'Demo',...u});return u};
  U({id:'u-hq',name:'Manoj Kulkarni (Demo)',role:'HQ_SAFETY_HEAD'});
  AREAS.forEach((a,i)=>U({id:i===0?'u-aso':'u-aso-'+a.id,name:i===0?'Kavita Rao (Demo)':name(),role:'AREA_SAFETY_OFFICER',assigned_area_id:a.id}));
  MINES.forEach((m,i)=>{const p=i===0;
    U({id:p?'u-mm':'u-mm-'+m.id,name:p?'Suresh Nair (Demo)':name(),role:'MINE_MANAGER',assigned_mine_id:m.id});
    U({id:p?'u-so':'u-so-'+m.id,name:p?'Rohit Verma (Demo)':name(),role:'MINE_SO_MINING',assigned_mine_id:m.id});
    U({id:p?'u-soem':'u-soem-'+m.id,name:p?'Anita Joshi (Demo)':name(),role:'MINE_SO_EM',assigned_mine_id:m.id});
  });
  const user=id=>db.users.find(u=>u.id===id);
  const mmOf=m=>db.users.find(u=>u.role==='MINE_MANAGER'&&u.assigned_mine_id===m);
  const soOf=(m,d)=>db.users.find(u=>u.role===(d==='Electrical & Mechanical'?'MINE_SO_EM':'MINE_SO_MINING')&&u.assigned_mine_id===m);
  const asoOf=a=>db.users.find(u=>u.role==='AREA_SAFETY_OFFICER'&&u.assigned_area_id===a),hq=user('u-hq');
  const ctx={db,user,mmOf,soOf,asoOf,hq};

  const PATHS={
    reported:[],with_so:['REVIEW'],esc_req:['REVIEW','REQUEST_ESCALATION'],await_close:['REVIEW','ACTION_TAKEN'],
    with_aso:['REVIEW','REQUEST_ESCALATION','ESCALATE:ASO'],with_aso_direct:['ESCALATE:ASO'],with_hq:['REVIEW','REQUEST_ESCALATION','ESCALATE:HQ'],with_hq_direct:['ESCALATE:HQ'],
    recommended_aso:['REVIEW','REQUEST_ESCALATION','ESCALATE:ASO','RECOMMEND'],recommended_hq:['ESCALATE:HQ','RECOMMEND'],
    closed:['REVIEW','ACTION_TAKEN','CLOSE'],closed_rework:['REVIEW','ACTION_TAKEN','REVIEW','ACTION_TAKEN','CLOSE'],
    closed_esc_aso:['REVIEW','REQUEST_ESCALATION','ESCALATE:ASO','RECOMMEND','REVIEW','ACTION_TAKEN','CLOSE'],closed_esc_hq:['ESCALATE:HQ','RECOMMEND','REVIEW','ACTION_TAKEN','CLOSE']
  };
  const FAST={REVIEW:[2,30],ACTION_TAKEN:[36,180],REQUEST_ESCALATION:[24,96],ESCALATE:[4,48],RECOMMEND:[24,120],CLOSE:[6,72]};
  const WEIGHTS=[['closed',34],['closed_rework',8],['closed_esc_aso',5],['closed_esc_hq',3],['reported',7],['with_so',9],['esc_req',4],['await_close',7],['with_aso',3],['with_aso_direct',2],['with_hq',2],['with_hq_direct',1],['recommended_aso',3],['recommended_hq',2]];
  const QUOTA=['reported','reported','reported','reported','with_so','with_so','with_so','with_so','with_so','esc_req','esc_req','esc_req','await_close','await_close','await_close','await_close','with_aso','with_aso','with_aso_direct','with_hq','with_hq','with_hq_direct','recommended_aso','recommended_aso','recommended_hq','recommended_hq'];

  const mkIncident=(mine,pathKey,i)=>{
    const type=wpick(TYPES,TYPE_W);let category=type==='Near Miss'?'Near Miss':wpick(['Unsafe Act','Unsafe Condition','Near Miss','Incident Reporting'],[24,30,16,30]);
    if(type!=='Near Miss'&&category==='Near Miss'&&R()>.4)category='Unsafe Condition';
    const sev=category==='Near Miss'?wpick(['none','nearMiss','minor'],[40,50,10]):category==='Incident Reporting'?wpick(['minor','serious','critical','fatality'],[45,36,17,2]):wpick(['none','nearMiss','minor','serious','critical'],[22,24,32,16,6]);
    const disc=['Electrical Incident','Equipment / Machinery Accident','Fire / Explosion'].includes(type)&&R()>.35?'Electrical & Mechanical':R()>.78?'Electrical & Mechanical':'Mining';
    const reporter=soOf(mine.id,disc),steps=PATHS[pathKey],f=SLOW[type]||1;
    const durs=steps.map(s=>{const k=s.split(':')[0],[a,b]=FAST[k];let h=rr(a,b);if(k==='ACTION_TAKEN')h*=f;return h*HR});
    const total=durs.reduce((x,y)=>x+y,0),terminal=pathKey.startsWith('closed');
    let created;
    if(terminal){const room=Math.max(2*DAY,330*DAY-total);created=NOW-total-12*HR-R()*room-rr(.2,1)*HR}
    else{const lastAge=R()<.3?rr(8,26)*DAY:rr(.2,6.5)*DAY;created=NOW-lastAge-total-rr(.1,.6)*HR}
    created=Math.min(created,NOW-HR);
    const t=new Date(created),z=mine.id;db.seq[z]=(db.seq[z]||0)+1;
    const occ=new Date(created-rr(.1,20)*HR),loc=wpick(LOCS,LOC_W);
    const injured=sev==='none'||sev==='nearMiss'?0:sev==='minor'?1:sev==='serious'?Math.ceil(R()*2):sev==='critical'?2+Math.floor(R()*3):1+Math.floor(R()*2);
    const inc={id:'d-i'+(i+1),incident_ref:'INC-'+mine.code+'-'+t.getFullYear()+'-'+String(db.seq[z]).padStart(6,'0'),mine_id:mine.id,area_id:mine.area_id,category,incident_type:type,discipline:disc,
      date_of_incident:occ.toISOString().slice(0,10),time_of_incident:String(occ.getHours()).padStart(2,'0')+':'+String(Math.floor(R()*12)*5).padStart(2,'0')+':00',location_zone:loc,location_detail:pick(DETAILS),severity:sev,persons_injured:injured,
      description:pick(DESC[type]||DESC.Other),immediate_actions:pick(ACT_TXT),ppe_worn:R()>.15?'yes':'no',sop_followed:wpick(['yes','no','unknown'],[55,30,15]),witnesses:R()>.5?name()+', '+name():'',supervisor_on_duty:name(),
      photos:R()<.18?JSON.stringify([{name:'sample-evidence.svg',data:photo(type,loc)}]):null,
      reporter_id:reporter.id,reporter_name:reporter.name,status:'open',assignee_id:null,created_at:new Date(created).toISOString(),updated_at:new Date(created).toISOString(),resolved_at:null,closed_at:null,version:1,audit_metadata:{stage:'reported'}};
    db.incidents.push(inc);
    const mm=mmOf(mine.id);inc.assignee_id=mm.id;
    db.history[inc.id]=[{id:inc.id+'-h0',incident_id:inc.id,action:'FORWARD',from_role:reporter.role,to_role:'MINE_MANAGER',from_user_id:reporter.id,to_user_id:mm.id,actor_id:reporter.id,comments:'Submitted for Mine Manager review',context:{kind:'report_submitted',stage:'reported',actor_name:reporter.name,to_name:mm.name},created_at:inc.created_at}];
    let ts=created;steps.forEach((s,k)=>{ts+=durs[k];const [step,lv]=s.split(':'),actor=actorFor(ctx,inc,step);const r=apply(ctx,inc,actor,step,fieldsFor(step,lv),lv,ts);if(!r.ok)throw new Error('seed '+inc.id+' '+s+' '+r.error)});
    /* a few remarks by other authorities */
    if(R()<.3){const roles=['MINE_MANAGER'].concat(steps.some(s=>s.startsWith('ESCALATE:ASO'))?['AREA_SAFETY_OFFICER']:[],steps.some(s=>s.startsWith('ESCALATE:HQ'))||R()<.1?['HQ_SAFETY_HEAD']:[]);
      const role=pick(roles),au=role==='MINE_MANAGER'?mm:role==='AREA_SAFETY_OFFICER'?asoOf(mine.area_id):hq;
      db.comments[inc.id]=[{id:inc.id+'-c0',incident_id:inc.id,author_id:au.id,comment_text:pick(COMMENTS[role]),context:{role},created_at:new Date(created+rr(.3,.9)*(Math.max(ts-created,3*HR))).toISOString()}]}
    return inc;
  };
  let n=0;
  MINES.forEach((m,mi)=>{const count=Math.round(m.w*(.9+R()*.25));
    const keys=[];if(mi===0)keys.push(...QUOTA);else if(mi<=3)keys.push(...QUOTA.slice(0,10).filter(()=>R()<.5));
    while(keys.length<count)keys.push(wpick(WEIGHTS.map(x=>x[0]),WEIGHTS.map(x=>x[1])));
    keys.forEach(k=>mkIncident(m,k,n++));
  });
  db.incidents.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  seedCirc(db);
  return db;
}
function photo(type,loc){const s='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4452"/><stop offset="1" stop-color="#1b212b"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><path d="M0 330 L120 270 L250 310 L380 250 L520 300 L640 260 V420 H0Z" fill="#11161d"/><circle cx="500" cy="110" r="46" fill="#f5b301" opacity=".85"/><text x="320" y="190" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#e5e7eb">SAMPLE EVIDENCE PHOTO</text><text x="320" y="226" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#9ca3af">'+esc(type)+' · '+esc(loc)+'</text><text x="320" y="392" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">Demo data - fictional</text></svg>';return 'data:image/svg+xml;utf8,'+encodeURIComponent(s)}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function sops(){const base=[['Ground Control','Roof Support & Ground Control','Support plan, bolting pattern, examination and reporting of roof and sides.'],['Electrical Safety','Electrical Isolation & Lock-out','Isolation, tagging, testing and permit steps for electrical work in the section.'],['Blasting','Shot-firing & Misfire Handling','Charging, stemming, danger zone withdrawal and misfire clearance.'],['Fire Prevention','Belt Conveyor Fire Prevention','Idler checks, heating detection and first-response actions.'],['Transport','Dumper & LMV Movement Rules','Speed limits, right-of-way, reversing and parking in the yard and haul roads.'],['Ventilation','Gas Monitoring & Ventilation','Methane/CO checks, action levels and ventilation changes.'],['Emergency Response','Emergency Evacuation Plan','Assembly points, roll call, rescue team call-out and communication.'],['Working at Height','Working at Height & Platforms','Harness, anchorage, ladders and platform inspections.']];
  const d='https://drive.google.com/drive/my-drive';return base.map((b,i)=>({id:'d-s'+i,category:b[0],title:'Sample SOP – '+b[1],description:b[2]+' (Demo document)',rev:'Rev '+(1+i%4),drive_url:d})).concat([['[STAT] Inspection Checklists','Sample Statutory Inspection Checklist','Weekly and monthly inspection record formats (Demo document).'],['[STAT] Safety Committee','Sample Safety Committee Minutes Format','Template for pit safety committee meetings (Demo document).'],['[STAT] Returns','Sample Monthly Safety Return Summary','Summary format for accident and dangerous occurrence returns (Demo document).']].map((b,i)=>({id:'d-t'+i,category:b[0],title:b[1],description:b[2],rev:'Rev 2',drive_url:d})))}

/* ----------------------------- circulars (demo): same scope rules as the backend circular-policy.js ----------------------------- */
const CPRI=['normal','important','urgent','critical'],CCATS=['Circular','Guideline','Instruction','Advisory','Safety Alert','Notification'];
const mineArea=(db,id)=>{const m=db.mines.find(x=>x.id===id);return m?m.area_id:null};
const isRecip=(db,u,c)=>{if(!u||u.is_active===false||u.id===c.issuer_id)return false;if(c.scope_type==='ALL')return true;
  if(c.scope_type==='AREA')return (!!u.assigned_area_id&&u.assigned_area_id===c.area_id)||(!!u.assigned_mine_id&&mineArea(db,u.assigned_mine_id)===c.area_id);
  return !!u.assigned_mine_id&&u.assigned_mine_id===c.mine_id};
const cRead=(db,u,c)=>u.role==='HQ_SAFETY_HEAD'||c.issuer_id===u.id||(u.role==='AREA_SAFETY_OFFICER'&&c.scope_type!=='ALL'&&c.area_id===u.assigned_area_id)||isRecip(db,u,c);
const tinyPdf=t=>{const s='%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 18 Tf 60 780 Td ('+t.replace(/[()\\]/g,'')+') Tj 0 -28 Td /F1 12 Tf (Sample document - fictional demo content) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';return btoa(s)};
const demoPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const circUsers=db=>db.users.filter(u=>u.is_active);
function addCirc(db,spec){
  const u=db.users.find(x=>x.id===spec.by),mine=u.assigned_mine_id?db.mines.find(m=>m.id===u.assigned_mine_id):null;
  const scope=u.role==='HQ_SAFETY_HEAD'?{scope_type:'ALL',area_id:null,mine_id:null}:u.role==='AREA_SAFETY_OFFICER'?{scope_type:'AREA',area_id:u.assigned_area_id,mine_id:null}:{scope_type:'MINE',area_id:mine.area_id,mine_id:mine.id};
  const at=new Date(Date.now()-spec.ago*DAY).toISOString(),id='d-c'+(db.circ.items.length+1);
  const c={id,ref_no:spec.ref,...scope,issuer_id:u.id,issuer_role:u.role,issuer_name:u.name,category:spec.cat,priority:spec.pri,title:spec.title,subject:spec.sub,body_html:spec.body,issue_date:at.slice(0,10),effective_date:spec.eff!==undefined?(spec.eff===null?null:new Date(Date.now()-spec.eff*DAY).toISOString().slice(0,10)):at.slice(0,10),requires_ack:spec.ack!==false,status:spec.arch?'archived':'published',version:spec.amend?2:1,created_at:at,updated_at:spec.amend?new Date(Date.now()-(spec.ago-1.5)*DAY).toISOString():at,archived_at:spec.arch?new Date(Date.now()-(spec.ago-20)*DAY).toISOString():null};
  db.circ.items.push(c);
  db.circ.att[id]=(spec.att||[]).map((a,i)=>({id:id+'-a'+i,file_name:a[0],mime_type:a[1],size_bytes:Math.round(atob(a[2]).length),data_base64:a[2],added_in_version:1,created_at:at}));
  db.circ.versions[id]=spec.amend?[{version:1,title:spec.title,subject:spec.sub,body_html:spec.body,priority:spec.pri==='critical'?'urgent':spec.pri,effective_date:c.effective_date,amendment_note:spec.amend[0],created_at:c.updated_at,edited_by:u.id}]:[];
  if(spec.amend){c.body_html=spec.amend[1];c.title=spec.title}
  db.circ.audit[id]=[{id:id+'-e0',actor_id:u.id,actor_role:u.role,event:'published',detail:{ref_no:c.ref_no,scope_type:c.scope_type,attachments:(spec.att||[]).length},created_at:at}];
  /* delivery rows for every recipient; engagement is simulated so tracking screens have meaningful numbers */
  const R=rng(id.length*977+db.circ.items.length*31);const pv=spec.engage==null?.7:spec.engage;
  db.circ.recips[id]=circUsers(db).filter(x=>isRecip(db,x,c)).map(x=>{const age=Math.max(.2,spec.ago),t=Date.now()-age*DAY*R(),
    forced=spec.state&&spec.state[x.id],seen=forced?forced!=='unread':R()<pv,ack=forced?forced==='ack':seen&&R()<pv*.9&&c.requires_ack;
    return {user_id:x.id,delivered_at:at,viewed_at:seen?new Date(t).toISOString():null,viewed_version:seen?c.version:null,acknowledged_at:ack?new Date(t+HR).toISOString():null,ack_version:ack?c.version:null}});
  if(!spec.arch)db.circ.items[db.circ.items.length-1].status='published';
  const ev=db.circ.audit[id];if(spec.amend)ev.push({id:id+'-e1',actor_id:u.id,actor_role:u.role,event:'amended',detail:{from_version:1,to_version:2,note:spec.amend[0]},created_at:c.updated_at});
  db.circ.recips[id].filter(r=>r.viewed_at).slice(0,6).forEach((r,i)=>ev.push({id:id+'-v'+i,actor_id:r.user_id,actor_role:(db.users.find(x=>x.id===r.user_id)||{}).role,event:'viewed',detail:{version:c.version},created_at:r.viewed_at}));
  db.circ.recips[id].filter(r=>r.acknowledged_at).slice(0,6).forEach((r,i)=>ev.push({id:id+'-k'+i,actor_id:r.user_id,actor_role:(db.users.find(x=>x.id===r.user_id)||{}).role,event:'acknowledged',detail:{version:c.version},created_at:r.acknowledged_at}));
  if(spec.arch)ev.push({id:id+'-x',actor_id:u.id,actor_role:u.role,event:'archived',detail:{},created_at:c.archived_at});
  ev.sort((a,b)=>b.created_at<a.created_at?-1:1);
}
function seedCirc(db){
  db.circ={items:[],att:{},versions:{},audit:{},recips:{}};
  const P1=['Supervisors must brief all crews at the start of every shift.','Records of compliance must be kept at the Manager\'s office.','Non-compliance will be treated as a statutory violation.'];
  const li=a=>'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  const hq=[
   {by:'u-hq',ref:'HQ/2026/001',cat:'Safety Alert',pri:'critical',ago:1.2,title:'Critical alert: roof fall fatalities in underground mines',sub:'Immediate review of roof support in all underground workings',body:'<p><b>All mines are directed to act immediately.</b> Two roof-fall fatalities were reported in the last fortnight in the subsidiary.</p>'+li(['Re-examine the support system in every working district within 48 hours.','Stop work where support is found deficient until rectified.','Confirm completion to your Area Safety Officer.']),att:[['Roof-fall-alert.pdf','application/pdf',tinyPdf('Critical alert - roof fall')],['Support-checklist.png','image/png',demoPng]],engage:.45,state:{'u-so':'unread','u-mm':'unread'}},
   {by:'u-hq',ref:'HQ/2026/002',cat:'Circular',pri:'urgent',ago:4,title:'Mandatory refresher on SOP for belt conveyor safety',sub:'All mines to complete the refresher by month end',body:'<p>A refresher on the <b>Belt Conveyor Safety SOP</b> shall be conducted for all conveyor operators and maintenance staff.</p>'+li(P1),att:[['Conveyor-SOP-refresher.pdf','application/pdf',tinyPdf('Belt conveyor SOP refresher')]],engage:.65,state:{'u-so':'view','u-soem':'unread'}},
   {by:'u-hq',ref:'HQ/2026/003',cat:'Guideline',pri:'important',ago:9,title:'Revised guidelines for incident reporting and closure',sub:'Reporting by Safety Officers; closure only by the Mine Manager',body:'<p>With immediate effect only the <b>Safety Officer (Mining / E&amp;M)</b> shall report incidents, which are reviewed and finally closed by the Mine Manager.</p><p>Escalation to the Area Safety Officer and HQ will be routed by the Mine Manager.</p>',engage:.85,state:{'u-so':'ack','u-soem':'ack','u-mm':'ack','u-aso':'ack'}},
   {by:'u-hq',ref:'HQ/2026/004',cat:'Advisory',pri:'important',ago:14,title:'Advisory: monsoon preparedness for open cast projects',sub:'Dewatering, haul road and slope stability checks',body:'<p>All OC projects shall verify <b>pump capacity, drainage and haul-road gradients</b> before the monsoon, and keep an emergency contact roster current.</p>',engage:.8,state:{'u-so':'ack','u-mm':'view'}},
   {by:'u-hq',ref:'HQ/2026/005',cat:'Instruction',pri:'normal',ago:22,title:'Updated format for monthly safety returns',sub:'New template effective from the next reporting cycle',body:'<p>Please use the revised template attached for the monthly safety return. Earlier formats will not be accepted.</p>',att:[['Monthly-return-template.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','UEsDBBQAAAAIAAAAIQAAAAAAAAAAAAAAAAAIAAAAdGVzdC50eHQ=']],engage:.9,state:{'u-so':'ack','u-mm':'ack'}},
   {by:'u-hq',ref:'HQ/2026/006',cat:'Notification',pri:'normal',ago:40,title:'Safety week observance schedule',sub:'Programme for the annual Safety Week',body:'<p>The annual <b>Safety Week</b> will be observed from the first Monday of next month. Areas may add local programmes.</p>',ack:false,engage:.75},
   {by:'u-hq',ref:'HQ/2025/019',cat:'Circular',pri:'normal',ago:150,title:'Archived: previous PPE issue policy',sub:'Superseded by the 2026 PPE guidelines',body:'<p>This circular is retained for reference only.</p>',arch:true,engage:.95}
  ];
  const aso=[
   ['u-aso','SUND','Sundarpur Area'],['u-aso-d-a2','RAJN','Rajnagar Area'],['u-aso-d-a3','BHIL','Bhilori Area']
  ].flatMap(([id,pre,nm],i)=>[
   {by:id,ref:'ASO/'+pre+'/2026/001',cat:'Instruction',pri:i===0?'urgent':'important',ago:2.5+i,title:nm+': inspection of travelling roads and inclines',sub:'Special inspection drive within the Area',body:'<p>A <b>special inspection drive</b> of travelling roads, inclines and haulage tracks will be carried out across mines of the '+nm+'.</p>'+li(['Mine Managers to nominate a competent team.','Findings to be reported within seven days.']),att:i===0?[['Inspection-format.pdf','application/pdf',tinyPdf('Special inspection format')]]:[],engage:.55,state:i===0?{'u-so':'unread','u-mm':'view','u-soem':'unread'}:null},
   {by:id,ref:'ASO/'+pre+'/2026/002',cat:'Guideline',pri:'important',ago:11+i,title:nm+': guideline on shot-firing supervision',sub:'Strengthened supervision during blasting operations',body:'<p>Shot-firing must be supervised by the <b>competent person</b> and the danger zone cleared and confirmed before every blast.</p>',engage:.75,state:i===0?{'u-so':'ack','u-mm':'ack'}:null},
   {by:id,ref:'ASO/'+pre+'/2026/003',cat:'Advisory',pri:'normal',ago:27+i,title:nm+': area safety committee meeting schedule',sub:'Quarterly meeting dates and agenda',body:'<p>The quarterly Area safety committee meeting will be held at the Area office. Mine Managers to submit pending action points beforehand.</p>',ack:false,engage:.8}
  ]);
  const mine=[
   {by:'u-mm',ref:'SUND-MGR/2026/004',cat:'Instruction',pri:'urgent',ago:.8,title:'Mine instruction: restricted entry to panel 4 until re-support',sub:'Entry barred after roof deterioration',body:'<p>Entry to <b>Level 2, Panel 4</b> is barred with immediate effect until re-supported and certified by the competent person.</p>',engage:.5,state:{'u-so':'unread','u-soem':'unread'}},
   {by:'u-mm',ref:'SUND-MGR/2026/003',cat:'Guideline',pri:'important',ago:7,title:'Mine guideline: toolbox talks at every shift start',sub:'10-minute talk, recorded by the supervisor',body:'<p>All supervisors shall hold a <b>10-minute toolbox talk</b> at the start of every shift and record attendance.</p>',engage:.85,state:{'u-so':'ack','u-soem':'view'}},
   {by:'u-mm',ref:'SUND-MGR/2026/002',cat:'Circular',pri:'normal',ago:30,title:'Mine circular: housekeeping standards in workshop',sub:'Weekly housekeeping audit introduced',body:'<p>A weekly housekeeping audit will be conducted in the workshop and surface installations.</p>',engage:.9,amend:['Corrected audit day to Thursday','<p>A weekly housekeeping audit will be conducted <b>every Thursday</b> in the workshop and surface installations.</p>'],state:{'u-so':'unread'}},
   {by:'u-so',ref:'SUND-SO/2026/001',cat:'Notification',pri:'important',ago:3,title:'Safety Officer note: PPE compliance drive this week',sub:'Helmet, boots and self-rescuer checks at the pit-head',body:'<p>PPE compliance checks (<b>helmet, safety boots, self-rescuer</b>) will be carried out at the pit-head each shift this week.</p>',engage:.7,state:{'u-mm':'view','u-soem':'ack'}},
   {by:'u-soem',ref:'SUND-EM/2026/001',cat:'Advisory',pri:'normal',ago:5,title:'E&M advisory: tagging of electrical isolation points',sub:'Lock-out tag-out reminder for electricians',body:'<p>All isolation points must be locked and tagged before maintenance. Report missing tags to the E&amp;M Safety Officer.</p>',engage:.6,state:{'u-so':'unread'}}
  ];
  hq.concat(aso,mine).forEach(s=>addCirc(db,s));
  const other=[
   {by:'u-mm-d-m4',ref:'RJOC-MGR/2026/001',cat:'Instruction',pri:'important',ago:6,title:'Rajnagar OC: haul road speed limits revised',sub:'Reduced speeds on ramps',body:'<p>Speed limits on haul roads and ramps are revised as per the attached notice.</p>',engage:.7},
   {by:'u-mm-d-m7',ref:'BHO1-MGR/2026/001',cat:'Guideline',pri:'normal',ago:13,title:'Bhilori OC-I: dump yard spotter requirement',sub:'Spotters mandatory at tipping points',body:'<p>A trained spotter is mandatory at all dump-yard tipping points.</p>',engage:.7}
  ];other.forEach(s=>addCirc(db,s));
}
const cDecor=(db,u,c)=>{const r=(db.circ.recips[c.id]||[]).find(x=>x.user_id===u.id),rec=isRecip(db,u,c),unread=rec&&c.status==='published'&&!(r&&r.viewed_version!=null&&r.viewed_version>=c.version),pend=rec&&!!c.requires_ack&&c.status==='published'&&!(r&&r.ack_version!=null&&r.ack_version>=c.version);
  return {...c,body_html:undefined,is_issuer:c.issuer_id===u.id,is_recipient:rec,unread,pending_ack:pend,viewed_at:r&&r.viewed_at||null,acknowledged_at:r&&r.ack_version>=c.version?r.acknowledged_at:null}};
const cAudit=(db,u,c,ev,detail)=>{const a=db.circ.audit[c.id]=db.circ.audit[c.id]||[];a.unshift({id:c.id+'-'+Date.now()+Math.random().toString(36).slice(2,5),actor_id:u.id,actor_role:u.role,event:ev,detail:detail||{},created_at:new Date().toISOString()})};
const canTrack=(u,c)=>c.issuer_id===u.id||u.role==='HQ_SAFETY_HEAD'||(u.role==='AREA_SAFETY_OFFICER'&&(c.scope_type==='ALL'||c.area_id===u.assigned_area_id));
const trackStats=(c,rows)=>{const t=rows.length,v=rows.filter(r=>r.viewed_version!=null&&r.viewed_version>=c.version).length,a=rows.filter(r=>r.ack_version!=null&&r.ack_version>=c.version).length;return {total_recipients:t,delivered:t,viewed:v,acknowledged:a,pending_ack:c.requires_ack?t-a:0,not_viewed:t-v}};
const cleanHtml=h=>String(h||'').replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi,'').replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,(m,t)=>['p','br','b','strong','i','em','u','ul','ol','li','h3','h4','blockquote','a','span','hr'].includes(t.toLowerCase())?(m[1]==='/'?'</'+t.toLowerCase()+'>':t.toLowerCase()==='a'?'<a href="'+((/href\s*=\s*["'](https?:\/\/[^"']*)["']/i.exec(m)||[])[1]||'#')+'" target="_blank" rel="noopener noreferrer">':'<'+t.toLowerCase()+'>'):'');
const cText=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function circApi(db,user,p,q,method,body){
  let m;
  const cv=id=>db.circ.items.find(c=>c.id===id&&cRead(db,user,c));
  if(p==='/api/safety/circulars/summary'&&method==='GET'){
    const items=db.circ.items.filter(c=>c.status==='published'&&cRead(db,user,c)).sort((a,b)=>b.created_at<a.created_at?-1:1).map(c=>cDecor(db,user,c)),rank={critical:0,urgent:1,important:2,normal:3},week=Date.now()-7*DAY,urg=items.filter(i=>['urgent','critical'].includes(i.priority)&&(i.unread||i.pending_ack));
    return json(200,{counts:{unread:items.filter(i=>i.unread).length,pending_ack:items.filter(i=>i.pending_ack).length,urgent_open:urg.length,published:items.length},latest:items.slice(0,5),urgent:urg.sort((a,b)=>rank[a.priority]-rank[b.priority]).slice(0,5),unread:items.filter(i=>i.unread).slice(0,5),pending:items.filter(i=>i.pending_ack).slice(0,5),recent:items.filter(i=>Date.parse(i.created_at)>=week).slice(0,5)});
  }
  if(p==='/api/safety/circulars'&&method==='GET'){
    const v=q.get('view')||'inbox',limit=Math.max(1,Math.min(100,parseInt(q.get('limit'),10)||25)),offset=Math.max(0,parseInt(q.get('offset'),10)||0),qs=(q.get('q')||'').toLowerCase();
    let rows=db.circ.items.filter(c=>cRead(db,user,c));
    rows=v==='archive'?rows.filter(c=>c.status==='archived'):v==='issued'?rows.filter(c=>c.issuer_id===user.id):rows.filter(c=>c.status==='published');
    if(qs)rows=rows.filter(c=>[c.title,c.subject,c.ref_no,c.issuer_name].some(x=>x.toLowerCase().includes(qs)));
    if(CPRI.includes(q.get('priority')))rows=rows.filter(c=>c.priority===q.get('priority'));
    if(CCATS.includes(q.get('category')))rows=rows.filter(c=>c.category===q.get('category'));
    if(q.get('issuer_role'))rows=rows.filter(c=>c.issuer_role===q.get('issuer_role')||(q.get('issuer_role')==='MINE_SO_MINING'&&c.issuer_role==='MINE_SO_EM'));
    if(q.get('ref'))rows=rows.filter(c=>c.ref_no.toLowerCase().includes(q.get('ref').toLowerCase()));
    if(q.get('from'))rows=rows.filter(c=>c.issue_date>=q.get('from'));if(q.get('to'))rows=rows.filter(c=>c.issue_date<=q.get('to'));
    rows=rows.sort((a,b)=>b.created_at<a.created_at?-1:1).map(c=>cDecor(db,user,c));
    const fl=q.get('flag');if(fl)rows=rows.filter(i=>fl==='unread'?i.unread:fl==='pending'?i.pending_ack:true);
    return json(200,{items:rows.slice(offset,offset+limit),total:rows.length,limit,offset});
  }
  if(p==='/api/safety/circulars'&&method==='POST'){
    const mine=user.assigned_mine_id?db.mines.find(x=>x.id===user.assigned_mine_id):null;
    const sc=user.role==='HQ_SAFETY_HEAD'?{scope_type:'ALL',area_id:null,mine_id:null}:user.role==='AREA_SAFETY_OFFICER'?{scope_type:'AREA',area_id:user.assigned_area_id,mine_id:null}:mine&&SO.concat(['MINE_MANAGER']).includes(user.role)?{scope_type:'MINE',area_id:mine.area_id,mine_id:mine.id}:null;
    if(!sc)return json(403,{error:'Your role is not permitted to publish communications'});
    const b=body,t=s=>String(s==null?'':s).trim(),title=t(b.title),sub=t(b.subject),cat=t(b.category)||'Circular',pri=t(b.priority)||'normal',html=cleanHtml(b.body_html);
    if(title.length<3||title.length>200)return json(400,{error:'Title must be 3–200 characters'});if(sub.length<3||sub.length>300)return json(400,{error:'Subject must be 3–300 characters'});
    if(!CCATS.includes(cat))return json(400,{error:'Invalid category'});if(!CPRI.includes(pri))return json(400,{error:'Invalid priority'});
    if(SO.includes(user.role)&&CPRI.indexOf(pri)>1)return json(403,{error:'Your role may issue communications only up to "Important" priority'});
    if(cText(html).length<3)return json(400,{error:'Description is required'});
    const atts=Array.isArray(b.attachments)?b.attachments:[];if(atts.length>5)return json(400,{error:'At most 5 attachments are allowed'});
    const OKM=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp'];
    for(const a of atts)if(!OKM.includes(a.type)||!/^data:/.test(a.data||''))return json(400,{error:'Only PDF, DOCX, PNG, JPEG and WEBP files are allowed'});
    const yr=new Date().getFullYear(),pre=sc.scope_type==='ALL'?'HQ':sc.scope_type==='AREA'?'ASO/'+(db.areas.find(a=>a.id===sc.area_id)||{name:'AREA'}).name.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase():mine.code;
    let ref=t(b.ref_no);if(!ref)ref=pre+'/'+yr+'/D'+String(db.circ.items.length+1).padStart(3,'0');
    if(db.circ.items.some(c=>c.ref_no.toLowerCase()===ref.toLowerCase()))return json(409,{error:'A communication with this reference number already exists'});
    const now=new Date(),id='d-cn'+now.getTime().toString(36),iso=now.toISOString();
    const c={id,ref_no:ref,...sc,issuer_id:user.id,issuer_role:user.role,issuer_name:user.name,category:cat,priority:pri,title,subject:sub,body_html:html,issue_date:t(b.issue_date)||iso.slice(0,10),effective_date:t(b.effective_date)||null,requires_ack:b.requires_ack!==false,status:'published',version:1,created_at:iso,updated_at:iso,archived_at:null};
    db.circ.items.unshift(c);db.circ.att[id]=atts.map((a,i)=>{const d=String(a.data).split(',')[1]||'';return {id:id+'-a'+i,file_name:String(a.name).slice(0,200),mime_type:a.type,size_bytes:Math.floor(d.length*3/4),data_base64:d,added_in_version:1,created_at:iso}});
    db.circ.versions[id]=[];db.circ.recips[id]=circUsers(db).filter(x=>isRecip(db,x,c)).map(x=>({user_id:x.id,delivered_at:iso,viewed_at:null,viewed_version:null,acknowledged_at:null,ack_version:null}));
    db.circ.audit[id]=[];cAudit(db,user,c,'published',{ref_no:ref,scope_type:c.scope_type,recipients:db.circ.recips[id].length,attachments:atts.length});
    save();return json(201,{circular:{id,ref_no:ref,scope_type:c.scope_type,priority:pri,version:1},recipients:db.circ.recips[id].length});
  }
  if((m=p.match(/^\/api\/safety\/circulars\/([\w-]+)\/attachments\/([\w-]+)$/))&&method==='GET'){
    const c=cv(m[1]),a=c&&(db.circ.att[c.id]||[]).find(x=>x.id===m[2]);if(!a)return json(404,{error:'Attachment not found'});return json(200,a);
  }
  if((m=p.match(/^\/api\/safety\/circulars\/([\w-]+)\/(acknowledge|amend|archive|tracking|audit)$/))){
    const c=cv(m[1]);if(!c)return json(404,{error:'Communication not found'});const act=m[2];
    if(act==='acknowledge'&&method==='POST'){
      if(!isRecip(db,user,c))return json(403,{error:'This communication was not addressed to you'});if(c.status!=='published')return json(409,{error:'This communication has been archived'});
      const r=db.circ.recips[c.id].find(x=>x.user_id===user.id),now=new Date().toISOString();Object.assign(r,{viewed_at:r.viewed_at||now,viewed_version:c.version,acknowledged_at:now,ack_version:c.version});cAudit(db,user,c,'acknowledged',{version:c.version});save();return json(200,{ok:true,acknowledged_at:now,version:c.version});
    }
    if(act==='archive'&&method==='POST'){
      if(!(c.issuer_id===user.id||user.role==='HQ_SAFETY_HEAD'))return json(403,{error:'Only the issuing authority or HQ can archive a communication'});
      if(c.status!=='archived'){c.status='archived';c.archived_at=new Date().toISOString();cAudit(db,user,c,'archived',{});save()}return json(200,{ok:true});
    }
    if(act==='amend'&&method==='POST'){
      if(c.issuer_id!==user.id)return json(403,{error:'Only the issuing authority can amend this communication'});if(c.status!=='published')return json(409,{error:'Archived communications cannot be amended'});
      const note=String(body.amendment_note||'').trim();if(note.length<3||note.length>1000)return json(400,{error:'Describe what was amended (3–1000 characters)'});
      const title=String(body.title||'').trim(),sub=String(body.subject||'').trim(),html=cleanHtml(body.body_html),pri=String(body.priority||'normal');
      if(title.length<3||sub.length<3||cText(html).length<3)return json(400,{error:'Title, subject and description are required'});if(!CPRI.includes(pri))return json(400,{error:'Invalid priority'});
      if(SO.includes(user.role)&&CPRI.indexOf(pri)>1)return json(403,{error:'Your role may issue communications only up to "Important" priority'});
      db.circ.versions[c.id].unshift({version:c.version,title:c.title,subject:c.subject,body_html:c.body_html,priority:c.priority,effective_date:c.effective_date,amendment_note:note,created_at:new Date().toISOString(),edited_by:user.id});
      const from=c.version;Object.assign(c,{title,subject:sub,body_html:html,priority:pri,effective_date:String(body.effective_date||'')||null,requires_ack:body.requires_ack!==false,version:c.version+1,updated_at:new Date().toISOString()});
      cAudit(db,user,c,'amended',{from_version:from,to_version:c.version,note});save();return json(200,{ok:true,version:c.version});
    }
    if(act==='tracking'&&method==='GET'){
      if(!canTrack(user,c))return json(404,{error:'Communication not found'});
      let rows=db.circ.recips[c.id]||[];const uOf=id=>db.users.find(x=>x.id===id)||{},restrict=user.role==='AREA_SAFETY_OFFICER'&&c.issuer_id!==user.id&&c.scope_type==='ALL';
      const areaOf=u=>u.assigned_area_id||mineArea(db,u.assigned_mine_id);if(restrict)rows=rows.filter(r=>areaOf(uOf(r.user_id))===user.assigned_area_id);
      const by=new Map();rows.forEach(r=>{const u=uOf(r.user_id),mn=db.mines.find(x=>x.id===u.assigned_mine_id),key=u.assigned_mine_id||(u.assigned_area_id?'area:'+u.assigned_area_id:'hq'),g=by.get(key)||{mine_id:u.assigned_mine_id||null,name:mn?mn.name:u.assigned_area_id?'Area office':'HQ',total:0,viewed:0,acknowledged:0};g.total++;if(r.viewed_version>=c.version)g.viewed++;if(r.ack_version>=c.version)g.acknowledged++;by.set(key,g)});
      const pending=rows.filter(r=>c.requires_ack?!(r.ack_version>=c.version):!(r.viewed_version>=c.version)).slice(0,300).map(r=>{const u=uOf(r.user_id),mn=db.mines.find(x=>x.id===u.assigned_mine_id);return {user_id:r.user_id,name:u.name||'—',role:u.role||null,mine:mn?mn.name:null,viewed:r.viewed_version>=c.version}});
      return json(200,{stats:trackStats(c,rows),by_mine:[...by.values()].sort((a,b)=>a.name.localeCompare(b.name)),pending,area_restricted:restrict});
    }
    if(act==='audit'&&method==='GET'){
      if(!(c.issuer_id===user.id||user.role==='HQ_SAFETY_HEAD'))return json(404,{error:'Communication not found'});
      return json(200,{events:(db.circ.audit[c.id]||[]).slice(0,300).map(e=>({...e,actor_name:(db.users.find(x=>x.id===e.actor_id)||{}).name||'—'}))});
    }
  }
  if((m=p.match(/^\/api\/safety\/circulars\/([\w-]+)$/))&&method==='GET'){
    const c=cv(m[1]);if(!c)return json(404,{error:'Communication not found'});
    const r=(db.circ.recips[c.id]||[]).find(x=>x.user_id===user.id);
    if(r&&(r.viewed_version==null||r.viewed_version<c.version)){r.viewed_at=new Date().toISOString();r.viewed_version=c.version;cAudit(db,user,c,'viewed',{version:c.version});save()}
    const area=db.areas.find(a=>a.id===c.area_id),mine=db.mines.find(x=>x.id===c.mine_id);
    return json(200,{circular:{...cDecor(db,user,c),body_html:c.body_html,area_name:area?area.name:null,mine_name:mine?mine.name:null},attachments:(db.circ.att[c.id]||[]).map(({data_base64,...a})=>a),versions:db.circ.versions[c.id]||[],can_amend:c.issuer_id===user.id&&c.status==='published',can_archive:c.status==='published'&&(c.issuer_id===user.id||user.role==='HQ_SAFETY_HEAD'),can_track:canTrack(user,c)});
  }
  return null;
}

/* ----------------------------- workflow application (shared by seed and live actions) ----------------------------- */
function actorFor(ctx,inc,step){
  if(['REVIEW','ESCALATE','CLOSE'].includes(step))return ctx.mmOf(inc.mine_id);
  return ctx.user(inc.assignee_id);
}
function fieldsFor(step,lv){
  const R=Math.random,pick=a=>a[Math.floor(R()*a.length)];
  if(step==='REVIEW')return {remarks:pick(REMARKS),recommendations:pick(RECS)};
  if(step==='ACTION_TAKEN')return {actions:pick(ACTIONS)};
  if(step==='REQUEST_ESCALATION')return {justification:pick(JUST)};
  if(step==='ESCALATE')return {remarks:pick(ESC_REM)};
  if(step==='RECOMMEND')return {recommendations:lv==='HQ'?pick(HQ_REC):pick(ASO_REC)};
  if(step==='CLOSE')return {remarks:pick(CLOSE_REM)};
  return {};
}
function apply(ctx,inc,actor,step,fields,level,ts){
  const {db}=ctx;
  /* RECOMMEND uses the level of the holder, REQUEST_ESCALATION chooses a level at random when seeding */
  if(step==='REQUEST_ESCALATION'&&!level)level=Math.random()<.7?'ASO':'HQ';
  if(step==='RECOMMEND'){level=actor&&actor.role==='HQ_SAFETY_HEAD'?'HQ':'ASO';if(!fields.recommendations)fields=fieldsFor(step,level)}
  const d=decide({role:actor.role,status:inc.status,step,level,isAssignee:inc.assignee_id===actor.id,fields});
  if(!d.ok)return d;
  let dest;
  if(d.to==='SELF')dest=actor;
  else if(d.to==='MINE_MANAGER')dest=ctx.mmOf(inc.mine_id);
  else if(d.to==='AREA_SAFETY_OFFICER')dest=ctx.asoOf(inc.area_id);
  else if(d.to==='HQ_SAFETY_HEAD')dest=ctx.hq;
  else if(d.to==='MINE_SO')dest=db.users.find(u=>u.id===inc.reporter_id&&u.is_active)||ctx.soOf(inc.mine_id,inc.discipline);
  if(!dest)return {ok:false,code:409,error:'No active destination user is configured for this step'};
  const iso=new Date(ts).toISOString();
  if(step==='REVIEW'&&inc.status==='resolved')inc.resolved_at=null;
  inc.status=d.status;inc.assignee_id=dest.id;inc.updated_at=iso;inc.version=(inc.version||1)+1;
  inc.audit_metadata={...(inc.audit_metadata||{}),stage:d.stage,level:d.level||null,last_step:step,last_actor_role:actor.role,last_actor_id:actor.id};
  if(step==='ACTION_TAKEN')inc.resolved_at=iso;
  if(step==='CLOSE'){inc.closed_at=iso;if(!inc.resolved_at)inc.resolved_at=iso}
  const note=fields.remarks||fields.recommendations||fields.actions||fields.justification||null;
  const ev={id:inc.id+'-h'+(db.history[inc.id].length),incident_id:inc.id,action:d.action,from_role:actor.role,to_role:dest.role,from_user_id:actor.id,to_user_id:dest.id,actor_id:actor.id,comments:note,
    context:{kind:d.kind,stage:d.stage,level:d.level||null,remarks:fields.remarks||null,recommendations:fields.recommendations||null,actions:fields.actions||null,justification:fields.justification||null,mine_id:inc.mine_id,area_id:inc.area_id,actor_name:actor.name,to_name:dest.name},created_at:iso};
  db.history[inc.id].push(ev);
  return {ok:true,event:ev,dest};
}

/* ----------------------------- storage ----------------------------- */
let DB=null;
function load(){
  if(DB)return DB;
  try{const s=localStorage.getItem(DBK);if(s){DB=JSON.parse(s);if(DB&&DB.v===3&&DB.rev===5)return DB}}catch{}
  DB=build();save();return DB;
}
function save(){try{localStorage.setItem(DBK,JSON.stringify(DB))}catch(e){console.warn('Demo data could not be saved in this browser',e)}}

/* ----------------------------- local API ----------------------------- */
const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json'}});
const canRead=(u,i)=>u.role==='HQ_SAFETY_HEAD'||(u.role==='AREA_SAFETY_OFFICER'&&u.assigned_area_id===i.area_id)||(u.assigned_mine_id&&u.assigned_mine_id===i.mine_id);
const scopeOf=(db,u)=>db.incidents.filter(i=>canRead(u,i));
const holder=(db,i)=>{const a=db.users.find(x=>x.id===i.assignee_id);const {photos,...rest}=i;return {...rest,assignee_role:a?a.role:null,assignee_name:a?a.name:null}};
const me=()=>{const k=localStorage.getItem(KEY),P=PERSONAS[k];return P?load().users.find(u=>u.id===P.userId):null};
const periodFilter=(q,rows)=>{const f=q.get('from'),t=q.get('to');return rows.filter(r=>(!f||r.created_at>=f)&&(!t||r.created_at<=t))};
function page(q,rows){const limit=Math.max(1,Math.min(100,parseInt(q.get('limit'),10)||50)),offset=Math.max(0,parseInt(q.get('offset'),10)||0);return {incidents:rows.slice(offset,offset+limit),total:rows.length,limit,offset}}
function filt(q,rows){
  let r=periodFilter(q,rows);
  if(q.get('status'))r=r.filter(i=>i.status===q.get('status'));
  const c=q.get('category');if(c)r=r.filter(i=>c==='Unsafe Act'?['Unsafe Act','Unsafe Acts','Unsafe Practice'].includes(i.category):i.category===c);
  if(q.get('mine_id'))r=r.filter(i=>i.mine_id===q.get('mine_id'));
  if(q.get('area_id'))r=r.filter(i=>i.area_id===q.get('area_id'));
  return r.sort((a,b)=>b.created_at<a.created_at?-1:1);
}
async function handle(url,opts){
  const db=load(),u=new URL(url,location.href),p=u.pathname,q=u.searchParams,method=(opts&&opts.method||'GET').toUpperCase();
  await new Promise(r=>setTimeout(r,40+Math.random()*70));
  const body=()=>{try{return JSON.parse(opts&&opts.body||'{}')}catch{return {}}};
  if(p==='/api/version')return json(200,{service:'suraksha-demo',api_version:'secl-safety-v1'});
  const user=me();if(!user)return json(401,{error:'Authentication required'});
  if(p==='/api/auth/me')return json(200,{user});
  if(p==='/api/org/areas'){if(!['HQ_SAFETY_HEAD','AREA_SAFETY_OFFICER'].includes(user.role))return json(403,{error:'Not permitted'});return json(200,{areas:user.role==='HQ_SAFETY_HEAD'?db.areas:db.areas.filter(a=>a.id===user.assigned_area_id)})}
  if(p==='/api/org/mines'){const ms=user.role==='HQ_SAFETY_HEAD'?db.mines:user.role==='AREA_SAFETY_OFFICER'?db.mines.filter(m=>m.area_id===user.assigned_area_id):db.mines.filter(m=>m.id===user.assigned_mine_id);return json(200,{mines:ms})}
  if(p==='/api/sops'){if(!['MINE_SO_MINING','MINE_SO_EM','MINE_MANAGER'].includes(user.role))return json(403,{error:'SOP library is available only to Mine Safety Officers and the Mine Manager'});return json(200,{sops:db.sops})}
  if(p==='/api/safety/notifications'){
    const rows=[];scopeOf(db,user).filter(i=>i.status!=='closed').forEach(i=>{if(i.assignee_id===user.id||(user.role==='MINE_MANAGER'&&!i.assignee_id&&i.status==='open'))rows.push({...i,requires_action:true})});
    if(SO.includes(user.role)){const since=Date.now()-14*DAY;db.incidents.filter(i=>i.reporter_id===user.id&&i.assignee_id!==user.id&&i.version>1&&Date.parse(i.updated_at)>=since).slice(0,20).forEach(i=>{if(!rows.find(x=>x.id===i.id))rows.push({...i,requires_action:false})})}
    const items=rows.sort((a,b)=>b.updated_at<a.updated_at?-1:1).slice(0,50).map(r=>{const h=db.history[r.id].slice(-1)[0],c=h.context||{};return {incident_id:r.id,incident_ref:r.incident_ref,incident_type:r.incident_type||r.category,severity:r.severity,status:r.status,stage:r.audit_metadata&&r.audit_metadata.stage,requires_action:r.requires_action,version:r.version,at:h.created_at,kind:c.kind||'report_submitted',from_role:h.from_role,note:h.comments,level:c.level||null}});
    return json(200,{items,action_required:items.filter(i=>i.requires_action).length});
  }
  if(p==='/api/safety/analytics/mine'){
    const mid=user.assigned_mine_id,mine=db.mines.find(m=>m.id===mid);if(!mine)return json(403,{error:'No Mine/Project assignment'});
    const rows=db.incidents.filter(i=>i.mine_id===mid),inc=rows.filter(i=>i.category==='Incident Reporting').sort((a,b)=>b.date_of_incident<a.date_of_incident?-1:1)[0];
    const last=inc?inc.date_of_incident:null,safe=last?Math.max(0,Math.floor((Date.now()-Date.parse(last+'T00:00:00'))/DAY)):null;
    return json(200,{mine,safe_days:safe,last_incident_date:last,safe_days_definition:'Calendar days since the most recent report categorized as Incident Reporting.',open_incidents:rows.filter(i=>i.status!=='closed').length,total_reports:rows.length});
  }
  if(p==='/api/safety/incidents/mine'&&method==='GET'){
    if(!SO.includes(user.role))return json(403,{error:'Not permitted'});
    return json(200,page(q,filt(q,db.incidents.filter(i=>i.reporter_id===user.id)).map(i=>holder(db,i))));
  }
  if(p==='/api/safety/incidents'&&method==='GET'){const rows=filt(q,scopeOf(db,user)).map(i=>holder(db,i));return json(200,page(q,rows))}
  if(p==='/api/safety/incidents'&&method==='POST'){
    if(!SO.includes(user.role))return json(403,{error:'Only Mine Safety Officers (Mining or Electrical & Mechanical) can report incidents'});
    const b=body();if(!b.category||!b.incident_type||!b.severity||!b.description)return json(400,{error:'Category, type, severity and description are required'});
    const mine=db.mines.find(m=>m.id===user.assigned_mine_id),mm=db.users.find(x=>x.role==='MINE_MANAGER'&&x.assigned_mine_id===mine.id),now=new Date();
    db.seq[mine.id]=(db.seq[mine.id]||0)+1;
    const disc=user.role==='MINE_SO_MINING'?'Mining':'Electrical & Mechanical';
    const inc={id:'d-n'+Date.now().toString(36),incident_ref:'INC-'+mine.code+'-'+now.getFullYear()+'-'+String(db.seq[mine.id]).padStart(6,'0'),mine_id:mine.id,area_id:mine.area_id,category:b.category,incident_type:b.incident_type,discipline:disc,date_of_incident:b.date_of_incident||now.toISOString().slice(0,10),time_of_incident:(b.time_of_incident||'00:00')+(String(b.time_of_incident||'').length===5?':00':''),location_zone:b.location_zone||null,location_detail:b.location_detail||null,severity:b.severity,persons_injured:Number(b.persons_injured)||0,description:b.description,immediate_actions:b.immediate_actions||null,ppe_worn:b.ppe_worn||null,sop_followed:b.sop_followed||null,witnesses:b.witnesses||null,supervisor_on_duty:b.supervisor_on_duty||null,photos:b.photos||null,reporter_id:user.id,reporter_name:user.name,status:'open',assignee_id:mm.id,created_at:now.toISOString(),updated_at:now.toISOString(),resolved_at:null,closed_at:null,version:2,audit_metadata:{stage:'reported'}};
    db.incidents.unshift(inc);db.history[inc.id]=[{id:inc.id+'-h0',incident_id:inc.id,action:'FORWARD',from_role:user.role,to_role:'MINE_MANAGER',from_user_id:user.id,to_user_id:mm.id,actor_id:user.id,comments:'Submitted for Mine Manager review',context:{kind:'report_submitted',stage:'reported',actor_name:user.name,to_name:mm.name},created_at:inc.created_at}];
    save();return json(201,{incident:{id:inc.id,incident_ref:inc.incident_ref,area_id:inc.area_id,mine_id:inc.mine_id,category:inc.category,discipline:disc,status:'open',created_at:inc.created_at},routed_to:{id:mm.id,name:mm.name,role:mm.role}});
  }
  if(p.startsWith('/api/safety/circulars')){const rc=circApi(db,user,p,q,method,body());if(rc)return rc}
  let m;
  if((m=p.match(/^\/api\/safety\/incidents\/(?:mine\/)?([\w-]+)\/workflow$/))&&method==='POST'){
    const i=db.incidents.find(x=>x.id===m[1]);if(!i||!canRead(user,i))return json(404,{error:'Incident not found'});
    const b=body(),f={remarks:String(b.remarks||'').trim(),recommendations:String(b.recommendations||'').trim(),actions:String(b.actions||'').trim(),justification:String(b.justification||'').trim()};
    const r=apply({db,user:id=>db.users.find(x=>x.id===id),mmOf:mid=>db.users.find(x=>x.role==='MINE_MANAGER'&&x.assigned_mine_id===mid),soOf:(mid,d)=>db.users.find(x=>x.role===(d==='Electrical & Mechanical'?'MINE_SO_EM':'MINE_SO_MINING')&&x.assigned_mine_id===mid),asoOf:a=>db.users.find(x=>x.role==='AREA_SAFETY_OFFICER'&&x.assigned_area_id===a),hq:db.users.find(x=>x.role==='HQ_SAFETY_HEAD')},i,user,String(b.step||''),f,b.level,Date.now());
    if(!r.ok)return json(r.code,{error:r.error});
    save();return json(200,{incident:{id:i.id,incident_ref:i.incident_ref,status:i.status,assignee_id:i.assignee_id,version:i.version,audit_metadata:i.audit_metadata},event:r.event,routed_to:{id:r.dest.id,name:r.dest.name,role:r.dest.role}});
  }
  if((m=p.match(/^\/api\/safety\/incidents\/(?:mine\/)?([\w-]+)\/comments$/))&&method==='POST'){
    const i=db.incidents.find(x=>x.id===m[1]);if(!i||!canRead(user,i))return json(404,{error:'Incident not found'});
    const t=String(body().comment_text||'').trim();if(!t)return json(400,{error:'Comment is required'});
    const c={id:i.id+'-c'+Date.now().toString(36),incident_id:i.id,author_id:user.id,comment_text:t.slice(0,4000),context:{role:user.role},created_at:new Date().toISOString()};
    (db.comments[i.id]=db.comments[i.id]||[]).push(c);save();return json(201,{comment:c});
  }
  if((m=p.match(/^\/api\/safety\/incidents\/(?:mine\/)?([\w-]+)$/))&&method==='GET'){
    const i=db.incidents.find(x=>x.id===m[1]);if(!i||!canRead(user,i))return json(404,{error:'Incident not found'});
    const a=db.users.find(x=>x.id===i.assignee_id);
    return json(200,{incident:{...i,assignee_role:a?a.role:null,assignee_name:a?a.name:null},comments:db.comments[i.id]||[],forwarding_history:db.history[i.id]||[]});
  }
  if(['PATCH','POST'].includes(method)&&/\/(status|forward)$/.test(p))return json(410,{error:'This endpoint was replaced by POST /api/safety/incidents/:id/workflow'});
  return json(404,{error:'Route not found'});
}

/* ----------------------------- public surface ----------------------------- */
const fakeToken=()=>'demo.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+86400,demo:true}))+'.demo';
const active=()=>!!PERSONAS[localStorage.getItem(KEY)];
const enter=k=>{if(!PERSONAS[k])return false;localStorage.setItem(KEY,k);localStorage.setItem('mg_token',fakeToken());load();return true};
const exit=()=>{localStorage.removeItem(KEY);localStorage.removeItem('mg_token');location.href='index.html'};
const reset=()=>{try{localStorage.removeItem(DBK)}catch{}DB=null;location.reload()};
const match=(id,pw)=>{id=String(id||'').trim().toLowerCase();const k=Object.keys(PERSONAS).find(x=>PERSONAS[x].login===id);return k&&pw===PASS?k:null};

if(active()){
  try{const t=localStorage.getItem('mg_token');const c=t&&JSON.parse(atob(t.split('.')[1]));if(!c||!c.demo||c.exp*1000<Date.now())localStorage.setItem('mg_token',fakeToken())}catch{localStorage.setItem('mg_token',fakeToken())}
  const real=window.fetch.bind(window);
  window.fetch=(url,opts)=>{const s=String(url&&url.url||url);return s.includes('/api/')&&active()?handle(s,opts):real(url,opts)};
}

function mount(host){
  if(!host||!active())return;
  const cur=localStorage.getItem(KEY);
  host.insertAdjacentHTML('afterbegin','<div class="banner demo-banner" role="note"><b>DEMO MODE</b><span>Fictional sample data in this browser only — nothing here touches live records. Actions (report, review, escalate, close) really work.</span>'
    +'<label class="demo-sw">Switch role <select id="demoRole">'+Object.keys(PERSONAS).map(k=>'<option value="'+k+'"'+(k===cur?' selected':'')+'>'+PERSONAS[k].label+'</option>').join('')+'</select></label>'
    +'<button class="btn btn-secondary btn-sm" id="demoReset" title="Discard your changes and restore the original sample data">Reset data</button><button class="btn btn-ghost btn-sm" id="demoExit">Exit demo</button></div>');
  host.querySelector('#demoRole').onchange=e=>{localStorage.setItem(KEY,e.target.value);localStorage.setItem('mg_token',fakeToken());location.hash='#/dashboard';location.reload()};
  host.querySelector('#demoReset').onclick=()=>{if(confirm('Reset all demo data to its original state? Your demo changes will be lost.'))reset()};
  host.querySelector('#demoExit').onclick=exit;
}
window.MGDemo={PERSONAS,PASS,active,enter,exit,reset,match,mount,decide};
})();
