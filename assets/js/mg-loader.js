/* Loading scene: an excavator digs coal at an opencast pit face, swings and loads a dumper; when full, the dumper drives off
   and an empty one arrives. Pure SVG + CSS transforms (GPU-friendly, no JS timers). */
(function(){
const MG=window.MG=window.MG||{};MG.esc=MG.esc||(s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const wheel=(x)=>'<g transform="translate('+x+',-17)"><g class="ld-wheel"><circle r="17" fill="#1f2328"/><circle r="9" fill="#9aa3ad"/><circle r="3.5" fill="#4b5563"/><path d="M0 -9V9M-9 0H9" stroke="#4b5563" stroke-width="2"/><path d="M0 -17V-13M0 13V17M-17 0H-13M13 0H17" stroke="#3a424b" stroke-width="3"/></g></g>';
MG.loaderScene=()=>
'<svg class="ld-scene" viewBox="0 0 480 270" role="img" aria-label="Excavator loading coal onto a dumper in an opencast mine">'
+'<defs><linearGradient id="ldSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ff"/><stop offset="1" stop-color="#f6f9ff"/></linearGradient>'
+'<linearGradient id="ldWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9b79f"/><stop offset="1" stop-color="#a99079"/></linearGradient></defs>'
+'<rect width="480" height="270" fill="url(#ldSky)"/>'
+'<g class="ld-cloud ld-c1"><ellipse cx="0" cy="34" rx="30" ry="9" fill="#fff" opacity=".85"/><ellipse cx="16" cy="28" rx="20" ry="9" fill="#fff" opacity=".85"/></g>'
+'<g class="ld-cloud ld-c2"><ellipse cx="0" cy="62" rx="24" ry="7" fill="#fff" opacity=".7"/><ellipse cx="-12" cy="57" rx="15" ry="7" fill="#fff" opacity=".7"/></g>'
+'<path d="M0 150 L70 118 L130 140 L200 104 L270 138 L340 110 L420 140 L480 120 V230 H0Z" fill="#d6e0f0"/>'
/* pit walls: benches with coal seams */
+'<path d="M0 222V132H96V154H150V222Z" fill="url(#ldWall)"/><path d="M0 132H96V140H0Z M96 154H150V162H96Z" fill="#2a303a"/>'
+'<path d="M318 222V148H392V120H480V222Z" fill="url(#ldWall)"/><path d="M392 120H480V130H392Z M318 148H392V156H318Z" fill="#2a303a"/>'
+'<rect y="222" width="480" height="48" fill="#6f6359"/><rect y="222" width="480" height="3" fill="#85796d"/>'
/* excavator platform */
+'<path d="M146 222L170 172H318V222Z" fill="#8a7a69"/><path d="M170 172H318V176H170Z" fill="#9b8b79"/>'
/* coal pile */
+'<path d="M322 222Q344 204 368 192Q392 182 410 198Q426 212 446 222Z" fill="#161c26"/><path d="M356 200Q372 190 388 192Q400 196 408 204Q392 198 378 199Q366 199 356 206Z" fill="#2b3544"/>'
+'<g class="ld-dust"><circle cx="372" cy="204" r="9" fill="#c9bfb2"/></g><g class="ld-dust ld-d2"><circle cx="352" cy="208" r="7" fill="#c9bfb2"/></g>'
/* tracks */
+'<g transform="translate(244,172)"><rect x="-46" y="-17" width="92" height="17" rx="8" fill="#2b3138"/><circle cx="-33" cy="-8.5" r="5" fill="#4b5563"/><circle cx="0" cy="-8.5" r="5" fill="#4b5563"/><circle cx="33" cy="-8.5" r="5" fill="#4b5563"/><rect x="-30" y="-21" width="60" height="5" rx="2" fill="#3a424b"/></g>'
/* upper structure */
+'<g transform="translate(244,152)"><g class="ld-swing">'
+'<rect x="-46" y="-26" width="12" height="24" rx="3" fill="#d99a00"/><rect x="-38" y="-34" width="60" height="32" rx="5" fill="#f5b301"/><rect x="-30" y="-44" width="4" height="10" fill="#333a42"/>'
+'<path d="M2 -34V-52H26L31 -34Z" fill="#f5b301"/><path d="M6 -48H24L27 -37H6Z" fill="#bfe3ff"/><rect x="-34" y="-12" width="52" height="4" fill="#d99a00"/>'
+'<g transform="translate(22,-24)"><g class="ld-boom"><path d="M-8-7L30-16L84-6V6L30 0L-8 8Z" fill="#f5b301" stroke="#b98200" stroke-width="1" stroke-linejoin="round"/>'
+'<g transform="translate(84,0)"><g class="ld-stick"><path d="M-6-5L58-4V4L-6 5Z" fill="#e0a100" stroke="#b98200" stroke-width="1" stroke-linejoin="round"/>'
+'<g transform="translate(58,0)"><g class="ld-bucket"><g class="ld-load"><path d="M2 -2C10 -12 26 -10 30 0C24 6 10 6 2 4Z" fill="#10151d"/></g>'
+'<path d="M-4-7C10-12 30-6 36 8L30 10C24 0 10-1-4 3Z" fill="#3a424b"/><path d="M34 6L40 12M30 9L35 15M26 11L30 17" stroke="#9aa3ad" stroke-width="2" stroke-linecap="round"/><circle r="4" fill="#9aa3ad"/></g></g>'
+'<circle r="4.5" fill="#3a424b"/></g></g><circle r="5.5" fill="#3a424b"/></g></g></g></g>'
/* falling coal */
+'<g class="ld-fall"><rect class="ld-p ld-p1" x="94" y="112" width="6" height="6" rx="1.5"/><rect class="ld-p ld-p2" x="102" y="108" width="5" height="5" rx="1.5"/><rect class="ld-p ld-p3" x="88" y="110" width="5" height="5" rx="1.5"/><rect class="ld-p ld-p4" x="108" y="114" width="6" height="6" rx="1.5"/><rect class="ld-p ld-p5" x="97" y="106" width="4" height="4" rx="1"/></g>'
/* dumper */
+'<g transform="translate(70,222)"><g class="ld-truck">'
+'<path d="M-62-24H-28V-52H-46L-62-40Z" fill="#f5b301"/><path d="M-58-44L-46-48H-34V-38H-58Z" fill="#bfe3ff"/><rect x="-30" y="-34" width="100" height="10" rx="3" fill="#2b3138"/>'
+'<path d="M-24-60L62-66L58-26H-20Z" fill="#e8890c" stroke="#b8650a" stroke-width="1.2" stroke-linejoin="round"/>'
+'<g class="ld-fill"><path d="M-19-27V-58Q20-76 56-63L54-27Z" fill="#10151d"/></g>'
+'<path d="M-20-30H58L57-26H-20Z" fill="#b8650a"/><rect x="-24" y="-64" width="9" height="40" rx="2" fill="#d97706"/>'
+wheel(-38)+wheel(38)+'</g></g>'
+'</svg>';
MG.loaderHtml=(msg)=>'<div class="gate"><div class="gate-card ld-card"><div class="logo-plate gate-logo"><img src="assets/img/secl-logo-wide.jpg" alt="Coal India · SECL"></div>'
+MG.loaderScene()+'<p class="ld-msg">'+MG.esc(msg||'Loading your safety workspace')+'<span class="ld-dots"><i></i><i></i><i></i></span></p><div class="ld-bar"><i></i></div></div></div>';
})();
