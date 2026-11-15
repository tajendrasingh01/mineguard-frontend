/* MineGuard charts: dependency-free SVG/DOM charts with tooltips, click-to-drill and enter animations. */
(function(){
const MG=window.MG,esc=MG.esc,C=MG.charts={};
const NS='http://www.w3.org/2000/svg';
const niceMax=m=>{if(m<=4)return 4;const raw=m/4,mag=Math.pow(10,Math.floor(Math.log10(raw)));const step=[1,2,2.5,5,10].map(s=>s*mag).find(s=>s>=raw);return step*4};
const slotLabels=(n,w)=>{const per=Math.max(1,Math.ceil(n*46/Math.max(w,1)));return i=>i%per===0||i===n-1&&per===1};
let gid=0;
/* Re-render on width change, without feedback loops. */
function watch(el,render){
  el._render=render;
  if(!el._ro&&'ResizeObserver' in window){let last=el.clientWidth;el._ro=new ResizeObserver(()=>{const w=el.clientWidth;if(Math.abs(w-last)>12&&el.isConnected){last=w;clearTimeout(el._rt);el._rt=setTimeout(()=>el._render&&el._render(),120)}});el._ro.observe(el)}
}
function bindSelect(el){
  if(el._selBound)return;el._selBound=true;
  el.addEventListener('click',e=>{const g=e.target.closest('[data-i]');if(g&&el.contains(g)&&el._onSelect)el._onSelect(Number(g.dataset.i),g.dataset.k||(e.target.dataset&&e.target.dataset.k)||null,g)});
  el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[data-i]')){e.preventDefault();e.target.click()}});
}
function empty(el,msg){el.innerHTML='<div class="empty" style="padding:26px 10px">'+MG.icon('info')+'<span>'+esc(msg||'No data for this selection')+'</span></div>'}

/* ---------- columns (stacked or grouped) + optional overlay line ---------- */
C.columns=function(el,o){
  el._onSelect=o.onSelect;bindSelect(el);MG.bindTips(el);
  const draw=()=>{
    const labels=o.labels||[],series=o.series||[];
    if(!labels.length||!series.length||MG.sum(series.flatMap(s=>s.values))+(o.line?MG.sum(o.line.values):0)===0){empty(el,o.empty);return}
    const W=Math.max(260,el.clientWidth||600),H=o.height||240,l=34,r=8,t=14,b=28,iw=W-l-r,ih=H-t-b,n=labels.length,stacked=o.stacked!==false;
    const totals=labels.map((_,i)=>stacked?MG.sum(series.map(s=>s.values[i]||0)):Math.max(...series.map(s=>s.values[i]||0)));
    const max=niceMax(Math.max(1,...totals,...(o.line?o.line.values:[0]))),y=v=>t+ih-(v/max)*ih,slot=iw/n,gw=Math.min(stacked?46:62,slot*.66),show=slotLabels(n,W);
    let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.title||'Chart')+'">';
    for(let k=0;k<=4;k++){const v=max/4*k,yy=y(v);s+='<line class="grid-l" x1="'+l+'" x2="'+(W-r)+'" y1="'+yy+'" y2="'+yy+'"/><text class="axis" x="'+(l-7)+'" y="'+(yy+3.5)+'" text-anchor="end">'+(Number.isInteger(v)?v:v.toFixed(1))+'</text>'}
    labels.forEach((lb,i)=>{
      const cx=l+slot*i+slot/2,tipRows=series.map(se=>({k:se.name,v:String(se.values[i]||0),c:se.color})).filter(r=>r.v!=='0');
      if(o.line)tipRows.push({k:o.line.name,v:String(o.line.values[i]||0),c:o.line.color});
      const total=stacked?MG.sum(series.map(se=>se.values[i]||0)):null;
      s+='<g data-i="'+i+'" tabindex="0" role="button" aria-label="'+esc(lb+': '+(total??''))+'" data-tip="'+esc(MG.tip.html(lb+(total!==null?' · '+total+' total':''),tipRows))+'"><rect x="'+(l+slot*i)+'" y="'+t+'" width="'+slot+'" height="'+ih+'" fill="transparent"/>';
      if(stacked){let acc=0;series.forEach(se=>{const v=se.values[i]||0;if(!v)return;const h=v/max*ih,yy=y(acc+v);acc+=v;s+='<rect class="bar-rect" data-k="'+esc(se.key)+'" style="animation-delay:'+(i*14)+'ms" x="'+(cx-gw/2)+'" y="'+yy+'" width="'+gw+'" height="'+Math.max(1,h)+'" rx="'+(h>6?3:1)+'" fill="'+se.color+'"/>'});}
      else{const bw=gw/series.length;series.forEach((se,j)=>{const v=se.values[i]||0;if(!v)return;const h=v/max*ih;s+='<rect class="bar-rect" data-k="'+esc(se.key)+'" style="animation-delay:'+(i*14+j*30)+'ms" x="'+(cx-gw/2+j*bw+1)+'" y="'+y(v)+'" width="'+Math.max(2,bw-2)+'" height="'+Math.max(1,h)+'" rx="3" fill="'+se.color+'"/>'})}
      s+='</g>';
      if(show(i))s+='<text class="axis" x="'+cx+'" y="'+(H-9)+'" text-anchor="middle">'+esc(lb)+'</text>';
    });
    if(o.line){const pts=o.line.values.map((v,i)=>[l+slot*i+slot/2,y(v||0)]);s+='<path class="line-path" pathLength="1" d="'+pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('')+'" fill="none" stroke="'+o.line.color+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>'+pts.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3" fill="#fff" stroke="'+o.line.color+'" stroke-width="2" pointer-events="none"/>').join('')}
    el.innerHTML=s+'</svg>'+legend(series,o.line);
  };
  draw();watch(el,draw);
};
function legend(series,line){const all=series.map(s=>({n:s.name,c:s.color})).concat(line?[{n:line.name,c:line.color,line:true}]:[]);return '<div class="chips" style="margin-top:10px;gap:14px">'+all.map(s=>'<span class="small muted" style="display:inline-flex;align-items:center;gap:6px">'+(s.line?'<i style="width:14px;height:3px;border-radius:2px;background:'+s.c+'"></i>':'<i style="width:9px;height:9px;border-radius:3px;background:'+s.c+'"></i>')+esc(s.n)+'</span>').join('')+'</div>'}

/* ---------- lines with hover crosshair ---------- */
C.lines=function(el,o){
  el._onSelect=o.onSelect;MG.bindTips(el);
  const draw=()=>{
    const labels=o.labels||[],series=o.series||[];
    if(!labels.length||!series.length||MG.sum(series.flatMap(s=>s.values))===0){empty(el,o.empty);return}
    const W=Math.max(260,el.clientWidth||600),H=o.height||240,l=34,r=14,t=14,b=28,iw=W-l-r,ih=H-t-b,n=labels.length,max=niceMax(Math.max(1,...series.flatMap(s=>s.values)));
    const x=i=>l+(n===1?iw/2:i*iw/(n-1)),y=v=>t+ih-(v/max)*ih,show=slotLabels(n,W),id='lg'+(++gid);
    let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.title||'Trend')+'"><defs>'+series.map((se,k)=>'<linearGradient id="'+id+k+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+se.color+'" stop-opacity=".22"/><stop offset="1" stop-color="'+se.color+'" stop-opacity="0"/></linearGradient>').join('')+'</defs>';
    for(let k=0;k<=4;k++){const v=max/4*k,yy=y(v);s+='<line class="grid-l" x1="'+l+'" x2="'+(W-r)+'" y1="'+yy+'" y2="'+yy+'"/><text class="axis" x="'+(l-7)+'" y="'+(yy+3.5)+'" text-anchor="end">'+(Number.isInteger(v)?v:v.toFixed(1))+'</text>'}
    labels.forEach((lb,i)=>{if(show(i))s+='<text class="axis" x="'+x(i)+'" y="'+(H-9)+'" text-anchor="middle">'+esc(lb)+'</text>'});
    series.forEach((se,k)=>{const pts=se.values.map((v,i)=>[x(i),y(v||0)]),d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('');
      if(o.area!==false&&k===0)s+='<path class="area-fill" d="'+d+'L'+x(n-1)+','+y(0)+'L'+x(0)+','+y(0)+'Z" fill="url(#'+id+k+')"/>';
      s+='<path class="line-path" pathLength="1" d="'+d+'" fill="none" stroke="'+se.color+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
      if(n<=40)s+=pts.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3" fill="#fff" stroke="'+se.color+'" stroke-width="2"/>').join('')});
    s+='<line id="'+id+'g" x1="0" x2="0" y1="'+t+'" y2="'+(t+ih)+'" stroke="#94a3b8" stroke-dasharray="3 4" opacity="0"/><rect id="'+id+'h" x="'+l+'" y="'+t+'" width="'+iw+'" height="'+ih+'" fill="transparent" style="cursor:crosshair"/></svg>'+legend(series);
    el.innerHTML=s;
    const hit=el.querySelector('#'+id+'h'),guide=el.querySelector('#'+id+'g'),svg=el.querySelector('svg');
    const idx=e=>{const p=svg.getBoundingClientRect(),px=(e.clientX-p.left)*(W/p.width);return Math.max(0,Math.min(n-1,Math.round(n===1?0:(px-l)/iw*(n-1))))};
    hit.addEventListener('mousemove',e=>{const i=idx(e);guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('opacity','1');MG.tip.show(MG.tip.html(labels[i],series.map(se=>({k:se.name,v:String(se.values[i]||0),c:se.color}))),e.clientX,e.clientY)});
    hit.addEventListener('mouseleave',()=>{guide.setAttribute('opacity','0');MG.tip.hide()});
    if(o.onSelect)hit.addEventListener('click',e=>o.onSelect(idx(e)));
  };
  draw();watch(el,draw);
};

/* ---------- horizontal bars (optionally segmented) ---------- */
C.hbars=function(el,o){
  el._onSelect=o.onSelect;bindSelect(el);MG.bindTips(el);
  const items=o.items||[];
  if(!items.length||!MG.sum(items.map(i=>i.total))){empty(el,o.empty);return}
  const max=Math.max(1,o.max||Math.max(...items.map(i=>i.total))),fmt=o.fmt||(v=>MG.num(v));
  el.innerHTML='<div class="hbars">'+items.map((it,i)=>{
    const segs=it.segments||[{value:it.total,color:it.color||'#2563eb',name:it.label}];
    const tip=MG.tip.html(it.label,(it.tipRows||segs.filter(s=>s.value).map(s=>({k:s.name,v:fmt(s.value),c:s.color}))).concat(it.segments&&it.segments.length>1?[{k:'Total',v:fmt(it.total)}]:[]));
    return '<div class="hbar'+(o.onSelect?'':' static')+'" '+(o.onSelect?'data-i="'+i+'" tabindex="0" role="button"':'')+' data-tip="'+esc(tip)+'"><span class="nm" title="'+esc(it.label)+'">'+esc(it.label)+'</span><div class="hbar-track">'+segs.map((s,j)=>s.value?'<i class="hbar-seg" style="width:'+(s.value/max*100)+'%;background:'+s.color+';animation-delay:'+(i*35+j*20)+'ms"></i>':'').join('')+'</div><b>'+esc(it.display??fmt(it.total))+'</b></div>';
  }).join('')+'</div>';
};

/* ---------- donut ---------- */
C.donut=function(el,o){
  el._onSelect=o.onSelect;bindSelect(el);MG.bindTips(el);
  const items=(o.items||[]).filter(i=>i.value>0),total=MG.sum(items.map(i=>i.value));
  if(!total){empty(el,o.empty);return}
  const R=64,r=43;let a0=0;
  const arc=(s,e)=>{const p=(ang,rad)=>[Math.cos(ang)*rad,Math.sin(ang)*rad],big=e-s>Math.PI?1:0,[x1,y1]=p(s,R),[x2,y2]=p(e,R),[x3,y3]=p(e,r),[x4,y4]=p(s,r);return 'M'+x1+','+y1+'A'+R+','+R+' 0 '+big+' 1 '+x2+','+y2+'L'+x3+','+y3+'A'+r+','+r+' 0 '+big+' 0 '+x4+','+y4+'Z'};
  const paths=items.map((it,i)=>{const frac=it.value/total,a1=a0+frac*Math.PI*2,tip=MG.tip.html(it.label,[{k:'Incidents',v:MG.num(it.value),c:it.color},{k:'Share',v:(frac*100).toFixed(1)+'%'}]);
    const d=frac>=.9999?'M0,'+(-R)+'A'+R+','+R+' 0 1 1 0,'+R+'A'+R+','+R+' 0 1 1 0,'+(-R)+'ZM0,'+(-r)+'A'+r+','+r+' 0 1 0 0,'+r+'A'+r+','+r+' 0 1 0 0,'+(-r)+'Z':arc(a0,a1-(items.length>1?.012:0));a0=a1;
    return '<path d="'+d+'" fill="'+it.color+'" fill-rule="evenodd" data-i="'+i+'" tabindex="0" role="button" aria-label="'+esc(it.label+': '+it.value)+'" data-tip="'+esc(tip)+'" style="animation-delay:'+(i*60)+'ms"/>'}).join('');
  el.innerHTML='<div class="donut-wrap"><div class="donut"><svg viewBox="-70 -70 140 140" role="img" aria-label="'+esc(o.title||'Distribution')+'">'+paths+'</svg><div class="donut-c"><b>'+esc(o.center?.value??MG.num(total))+'</b><small>'+esc(o.center?.label||'incidents')+'</small></div></div><div class="legend">'+items.map((it,i)=>'<button type="button" data-i="'+i+'"><i style="background:'+it.color+'"></i><span>'+esc(it.label)+'</span><em>'+MG.num(it.value)+' · '+Math.round(it.value/total*100)+'%</em></button>').join('')+'</div></div>';
};

/* ---------- heatmap ---------- */
C.heat=function(el,o){
  el._onSelect=o.onSelect;bindSelect(el);MG.bindTips(el);
  const rows=o.rows||[],cols=o.cols||[];let max=0;const vals=rows.map((_,r)=>cols.map((_,c)=>{const v=o.cell(r,c)||{value:0};max=Math.max(max,v.value||0);return v}));
  if(!rows.length||!cols.length||max===0){empty(el,o.empty);return}
  const base=o.color||'#2563eb',lw=o.labelWidth||96;
  let h='<div class="heat-scroll"><div class="heat" style="grid-template-columns:'+lw+'px repeat('+cols.length+',minmax('+(o.minCell||22)+'px,1fr));min-width:'+(lw+cols.length*(o.minCell||22)+cols.length*3)+'px"><span></span>'+cols.map((c,i)=>'<span class="heat-h">'+((o.colEvery||1)>1&&i%o.colEvery?'':esc(c))+'</span>').join('');
  rows.forEach((rn,r)=>{h+='<span class="heat-h row" title="'+esc(rn)+'">'+esc(rn)+'</span>';cols.forEach((cn,c)=>{const v=vals[r][c],t=v.value?v.value/max:0,bg=v.value?MG.tint(base,.14+.86*t):'#eef2f8',tipHtml=MG.tip.html(v.title||rn+' · '+cn,v.rows||[{k:o.unit||'Incidents',v:String(v.value)}]);
    h+='<'+(o.onSelect&&v.value?'button type="button" data-i="'+r*cols.length+c+'" data-k="'+r+':'+c+'"':'div')+' class="heat-cell" style="background:'+bg+';color:'+(t>.55?'#fff':'rgba(15,23,42,.8)')+'" data-tip="'+esc(tipHtml)+'" aria-label="'+esc((v.title||rn+' · '+cn)+': '+v.value)+'">'+(o.showValues&&v.value?v.value:'')+'</'+(o.onSelect&&v.value?'button':'div')+'>'});});
  el.innerHTML=h+'</div></div><div class="heat-legend" style="--hc:'+base+'"><span>0</span><i></i><span>'+max+'</span><span style="margin-left:auto">'+esc(o.legend||'')+'</span></div>';
};

/* ---------- inline pieces ---------- */
C.spark=(values,color='#2563eb')=>{
  const v=values.length>1?values:[0,0,...values],max=Math.max(1,...v),w=78,h=28,pts=v.map((x,i)=>[i*(w-4)/(v.length-1)+2,h-3-(x/max)*(h-8)]);
  return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><path d="'+pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('')+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pts[pts.length-1][0].toFixed(1)+'" cy="'+pts[pts.length-1][1].toFixed(1)+'" r="2.6" fill="'+color+'"/></svg>';
};
C.ring=(value,max,color,big,small,size=120)=>{
  const R=42,circ=2*Math.PI*R,f=max?Math.min(1,value/max):0;
  return '<div class="ring" style="--s:'+size+'px"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="'+R+'"/><circle class="fg" cx="50" cy="50" r="'+R+'" stroke="'+color+'" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+(circ*(1-f)).toFixed(1)+'"/></svg><div class="ring-c"><b>'+esc(big)+'</b><small>'+esc(small||'')+'</small></div></div>';
};
C.stack=(items)=>{const t=Math.max(1,MG.sum(items.map(i=>i.value)));return '<div class="stack-bar">'+items.filter(i=>i.value).map(i=>'<i style="flex:'+i.value/t+';background:'+i.color+'" data-tip="'+esc(MG.tip.html(i.label,[{k:'Incidents',v:String(i.value),c:i.color}]))+'"></i>').join('')+'</div>'};
C.pipeline=function(el,o){
  el._onSelect=o.onSelect;bindSelect(el);MG.bindTips(el);const total=Math.max(1,o.total||MG.sum(o.steps.map(s=>s.value)));
  el.innerHTML='<div class="pipeline">'+o.steps.map((s,i)=>'<button type="button" class="pipe-step" data-i="'+i+'" data-k="'+esc(s.key)+'" style="--c:'+s.color+';--w:'+(s.value/total).toFixed(3)+'" data-tip="'+esc(MG.tip.html(s.label,[{k:'Incidents',v:MG.num(s.value),c:s.color},{k:'Share',v:MG.pct(s.value,total)+'%'}]))+'"><span class="pct">'+MG.pct(s.value,total)+'%</span><b>'+MG.num(s.value)+'</b><small>'+esc(s.label)+'</small></button>').join('')+'</div>';
};
})();
