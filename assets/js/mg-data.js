/* MineGuard data layer. Everything shown in the UI is derived from live API responses.
   Role scoping is applied by the backend; the client only narrows what it already received. */
(function(){
const MG=window.MG,S=MG.state,D=MG.data={};
const DAY=86400000;
const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const endOfDay=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x};

/* ---------- period ---------- */
D.PRESETS=[['7d','7D',7],['30d','30D',30],['90d','90D',90],['12m','12M',365],['all','All',null]];
D.bounds=()=>{
  const r=S.range,now=new Date();let from,to=endOfDay(now);
  if(r.preset==='custom'&&r.from&&r.to){from=startOfDay(r.from+'T00:00:00');to=endOfDay(r.to+'T00:00:00')}
  else if(r.preset==='all')from=new Date('2000-01-01T00:00:00');
  else{const p=D.PRESETS.find(x=>x[0]===r.preset)||D.PRESETS[3];from=startOfDay(now.getTime()-(p[2]-1)*DAY)}
  return {from,to};
};
D.params=(extra)=>{const b=D.bounds(),q=new URLSearchParams();q.set('from',b.from.toISOString());q.set('to',b.to.toISOString());Object.entries(extra||{}).forEach(([k,v])=>v!=null&&v!==''&&q.set(k,v));return q};
D.rangeLabel=()=>{const r=S.range;if(r.preset==='all')return 'All time';const b=D.bounds();return MG.date(b.from)+' – '+MG.date(b.to)};
D.setRange=(preset,from,to)=>{S.range={preset,from:from||'',to:to||''};S.loadedKey=null};

/* ---------- org ---------- */
D.loadOrg=async()=>{
  const [a,m]=await Promise.all([MG.api('/api/org/areas').catch(()=>({areas:[]})),MG.api('/api/org/mines').catch(()=>({mines:[]}))]);
  S.areas=a.areas||[];S.mines=m.mines||[];S.areaMap=new Map(S.areas.map(x=>[x.id,x]));S.mineMap=new Map(S.mines.map(x=>[x.id,x]));
};
D.areaName=id=>S.areaMap.get(id)?.name||'';
D.mineName=id=>S.mineMap.get(id)?.name||'';

/* ---------- incidents ---------- */
const enrich=r=>{const m=S.mineMap.get(r.mine_id),a=S.areaMap.get(r.area_id)||S.areaMap.get(m?.area_id);return {...r,mine_name:m?.name||r.mine_name||'',area_name:a?.name||r.area_name||'',_t:new Date(r.created_at).getTime(),_cat:MG.catKey(r.category)}};
D.load=async(force=false)=>{
  const key=D.params().toString();
  if(!force&&S.loadedKey===key)return S.rows;
  const q=D.params();q.set('limit','100');q.set('offset','0');
  const first=await MG.api('/api/safety/incidents?'+q);let rows=first.incidents||[];const total=first.total||0;
  const offsets=[];for(let o=100;o<total&&o<10000;o+=100)offsets.push(o);
  for(let i=0;i<offsets.length;i+=5){
    const parts=await Promise.all(offsets.slice(i,i+5).map(o=>{const p=new URLSearchParams(q);p.set('offset',String(o));return MG.api('/api/safety/incidents?'+p)}));
    parts.forEach(p=>rows=rows.concat(p.incidents||[]));
  }
  S.rows=rows.map(enrich);S.total=total;S.truncated=total>S.rows.length;S.loadedKey=key;return S.rows;
};
D.scoped=(rows=S.rows,scope=S.scope)=>rows.filter(r=>(!scope.areaId||r.area_id===scope.areaId)&&(!scope.mineId||r.mine_id===scope.mineId));
D.detail=async(id,{force=false,mine=false}={})=>{
  if(!force&&S.detail.has(id))return S.detail.get(id);
  const d=await MG.api((mine?'/api/safety/incidents/mine/':'/api/safety/incidents/')+encodeURIComponent(id));
  S.detail.set(id,d);return d;
};
D.invalidate=id=>{S.detail.delete(id);S.loadedKey=null};

/* ---------- responsible authority ---------- */
D.lastHistory=(history,actions)=>[...(history||[])].reverse().find(h=>!actions||actions.includes(h.action));
D.responsible=(inc,history)=>{
  const s=inc.status;
  if(s==='closed')return {role:'—',text:'Closed'};
  if(s==='escalated')return {role:'AREA_SAFETY_OFFICER',text:MG.role('AREA_SAFETY_OFFICER')};
  if(s==='action_assigned'){const h=D.lastHistory(history,['ASSIGN','REASSIGN','FORWARD']);return h?{role:h.to_role,text:MG.role(h.to_role)}:{role:null,text:'Assigned officer'}}
  return {role:'MINE_MANAGER',text:MG.role('MINE_MANAGER')};
};
D.pendingLabel=inc=>{
  if(inc.status==='closed')return {text:'Completed',cls:'done'};
  const o=MG.isOverdue(inc);return {text:(o?'Overdue · ':'')+(MG.STATUS[inc.status]?.pending||'Pending'),cls:o?'overdue':''};
};

/* ---------- aggregation ---------- */
D.summarize=rows=>{
  const by=Object.fromEntries(MG.STATUS_KEYS.map(k=>[k,0]));rows.forEach(r=>{if(r.status in by)by[r.status]++});
  const res=rows.map(MG.resolutionHours).filter(h=>h!==null),active=rows.filter(r=>MG.isActive(r.status)),done=rows.length-active.length;
  return {total:rows.length,by,active:active.length,overdue:active.filter(MG.isOverdue).length,done,
    rate:rows.length?Math.round(done/rows.length*100):null,avgRes:MG.avg(res),medRes:MG.median(res),resN:res.length,
    sev:Object.fromEntries(MG.SEV_KEYS.map(k=>[k,rows.filter(r=>r.severity===k).length])),
    cat:Object.fromEntries(MG.CAT_KEYS.map(k=>[k,rows.filter(r=>r._cat===k).length]))};
};
D.groupBy=(rows,keyFn,nameFn)=>{const m=new Map();rows.forEach(r=>{const k=keyFn(r)||'_';let g=m.get(k);if(!g){g={key:k,name:nameFn(r)||'Not mapped',rows:[]};m.set(k,g)}g.rows.push(r)});return [...m.values()]};

/* ---------- time buckets ---------- */
D.granularity=(from,to)=>{const days=(to-from)/DAY;return days<=31?'day':days<=210?'week':'month'};
const monday=d=>{const x=startOfDay(d),k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
D.buckets=(from,to,gran)=>{
  const out=[];let cur=gran==='month'?new Date(from.getFullYear(),from.getMonth(),1):gran==='week'?monday(from):startOfDay(from);
  while(cur<=to&&out.length<400){
    const next=new Date(cur);if(gran==='month')next.setMonth(next.getMonth()+1);else next.setDate(next.getDate()+(gran==='week'?7:1));
    out.push({start:new Date(cur),end:next,label:gran==='month'?MON[cur.getMonth()]+" '"+String(cur.getFullYear()).slice(2):cur.getDate()+' '+MON[cur.getMonth()],full:gran==='month'?MON[cur.getMonth()]+' '+cur.getFullYear():gran==='week'?'Week of '+MG.date(cur):MG.date(cur)});
    cur=next;
  }
  return out;
};
D.bucketIndex=(buckets,ts)=>{if(!buckets.length||!Number.isFinite(ts))return -1;if(ts<buckets[0].start||ts>=buckets[buckets.length-1].end)return -1;let lo=0,hi=buckets.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(buckets[mid].start.getTime()<=ts)lo=mid;else hi=mid-1}return lo};
/* effective chart range: for "All time" start at first incident */
D.chartRange=(rows)=>{const b=D.bounds();let from=b.from;if(S.range.preset==='all'){const ts=rows.map(r=>r._t).filter(Number.isFinite);from=ts.length?new Date(Math.min(...ts)):startOfDay(Date.now()-30*DAY)}return {from,to:b.to}};
D.series=(rows,buckets,keyFn,keys)=>{
  const out=Object.fromEntries(keys.map(k=>[k,buckets.map(()=>0)]));
  rows.forEach(r=>{const i=D.bucketIndex(buckets,r._t),k=keyFn(r);if(i>=0&&k in out)out[k][i]++});return out;
};
D.eventSeries=(rows,buckets,field)=>{const v=buckets.map(()=>0);rows.forEach(r=>{if(!r[field])return;const i=D.bucketIndex(buckets,new Date(r[field]).getTime());if(i>=0)v[i]++});return v};

/* ---------- previous period (cheap count-only requests) ---------- */
D.previousCounts=async(extra={})=>{
  const b=D.bounds();if(S.range.preset==='all')return null;
  const span=b.to-b.from,pTo=new Date(b.from.getTime()-1),pFrom=new Date(pTo.getTime()-span);
  const count=async(status)=>{const q=new URLSearchParams({from:pFrom.toISOString(),to:pTo.toISOString(),limit:'1'});Object.entries(extra).forEach(([k,v])=>v&&q.set(k,v));if(status)q.set('status',status);return (await MG.api('/api/safety/incidents?'+q)).total||0};
  const [total,resolved,closed]=await Promise.all([count(),count('resolved'),count('closed')]);
  return {total,done:resolved+closed,rate:total?Math.round((resolved+closed)/total*100):null,from:pFrom,to:pTo};
};
})();
