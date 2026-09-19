(function(){
"use strict";
/* ---------- service worker: install + safe update flow ---------- */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js').then(function(reg){
    function showUpdateBanner(){
      if(document.getElementById('updatebar')) return;
      var b=document.createElement('div'); b.id='updatebar';
      b.innerHTML='<span>An update is available.</span><button id="updatebtn" type="button">Refresh</button>';
      document.body.appendChild(b);
      document.getElementById('updatebtn').addEventListener('click',function(){
        if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      });
    }
    if(reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
    reg.addEventListener('updatefound',function(){
      var nw=reg.installing; if(!nw) return;
      nw.addEventListener('statechange',function(){
        if(nw.state==='installed' && navigator.serviceWorker.controller) showUpdateBanner();
      });
    });
  }).catch(function(){});
  var swRefreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(swRefreshing) return; swRefreshing=true; location.reload();
  });
}

fetch('data/pages.json').then(function(r){return r.json()}).then(function(DATA){
var PAGES=DATA.pages, ALIAS=DATA.aliases||{};
var BY={}; PAGES.forEach(function(p){BY[p.id]=p});
var CATS={
  conditions:{label:'Conditions',one:'Condition',desc:'Injuries and illnesses'},
  skills:{label:'Skills',one:'Skill',desc:'Step-by-step procedures'},
  medicines:{label:'Medicines',one:'Medicine',desc:'Indications, doses and cautions'},
  reference:{label:'Reference',one:'Reference',desc:'Vital signs and paediatric considerations'}
};
var ORDER=['conditions','skills','medicines','reference'];
var LIST={};
ORDER.forEach(function(c){LIST[c]=PAGES.filter(function(p){return p.cat===c}).sort(function(a,b){return a.title.localeCompare(b.title,'en',{sensitivity:'base'})})});

/* ---------- storage (never fails, even when the browser blocks it) ---------- */
var mem={};
function sGet(k,d){try{var v=localStorage.getItem(k);return v==null?(k in mem?mem[k]:d):JSON.parse(v)}catch(e){return k in mem?mem[k]:d}}
function sSet(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

/* ---------- helpers ---------- */
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fold(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ae/g,'e').replace(/oe/g,'e')}
var I={
 back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
 search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
 info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
 chev:'<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>'
};
var app=document.getElementById('app');
var SIZES=[15,17,19,21,24];

function applySize(){var i=sGet('bec.size',1);if(i<0||i>=SIZES.length)i=1;document.documentElement.style.setProperty('--fs',SIZES[i]+'px')}

/* ---------- chrome ---------- */
function shell(opts){
  var left = opts.back
    ? '<button class="ib" id="back" aria-label="Back">'+I.back+'</button>'
    : '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M26 10h12v16h16v12H38v16H26V38H10V26h16z"/></svg>';
  var right = (opts.noSearch?'':'<a class="ib" href="#/search" aria-label="Search">'+I.search+'</a>')
            + (opts.noAbout?'':'<a class="ib" href="#/about" aria-label="About and credits">'+I.info+'</a>');
  return '<header class="bar"><div class="bar-in">'+left+'<h1>'+esc(opts.title)+'</h1>'+right+'</div></header>';
}

/* ---------- views ---------- */
function home(){
  var recent=(sGet('bec.recent',[])||[]).filter(function(id){return BY[id]}).slice(0,6);
  var saved=(sGet('bec.saved',[])||[]).filter(function(id){return BY[id]});
  var letters=[['A','Airway','airway'],['B','Breathing','breathing'],['C','Circulation','circulation'],['D','Disability','disability'],['E','Exposure','exposure']];
  var h=shell({title:'Basic Emergency Care',noSearch:true});
  h+='<main>';
  h+='<a class="searchbtn" href="#/search">'+I.search+'<span>Search conditions, skills, medicines</span></a>';
  h+='<h2 class="sec">ABCDE assessment</h2><div class="abcde">';
  letters.forEach(function(l){h+='<a href="#/p/s-ABCDE/'+l[2]+'" aria-label="'+l[1]+'"><b>'+l[0]+'</b><span>'+l[1]+'</span></a>'});
  h+='</div><a class="abcde-more" href="#/p/s-ABCDE">Read the full ABCDE approach</a>';
  h+='<h2 class="sec">Browse</h2><div class="cats">';
  ORDER.forEach(function(c){
    h+='<a class="catcard cat-'+c+'" href="#/list/'+c+'"><div><div class="t">'+CATS[c].label+'</div><div class="d">'+CATS[c].desc+'</div></div><span class="n">'+LIST[c].length+'</span>'+I.chev+'</a>';
  });
  h+='</div>';
  if(saved.length) h+='<h2 class="sec">Saved</h2>'+rows(saved);
  if(recent.length) h+='<h2 class="sec">Recently viewed</h2>'+rows(recent);
  h+='<div class="foot"><p>Unofficial offline copy of the content from the UCSF/WHO “BEC” app, which is based on the WHO/ICRC Basic Emergency Care course. <a href="#/about">About, credits and disclaimer</a></p></div>';
  h+='</main>';
  return h;
}
function rows(ids){
  return '<div class="rows">'+ids.map(function(id){var p=BY[id];
    return '<a class="row cat-'+p.cat+'" href="#/p/'+p.id+'"><span class="dot"></span><span class="tt">'+esc(p.title)+'<span class="sub">'+CATS[p.cat].one+'</span></span>'+I.chev+'</a>'}).join('')+'</div>';
}
function list(cat){
  var c=CATS[cat]; if(!c) return notFound();
  var h='<div class="cat-'+cat+'">'+shell({title:c.label,back:true})+'<div class="band"></div><main>';
  h+='<div class="listhead"><h2>'+c.label+'</h2><p>'+LIST[cat].length+' pages. '+c.desc+'.</p></div>';
  if(LIST[cat].length>8) h+='<input class="filter" id="filter" type="search" placeholder="Filter '+c.label.toLowerCase()+'" aria-label="Filter '+c.label.toLowerCase()+'" autocomplete="off">';
  h+='<div class="rows" id="rows">'+LIST[cat].map(function(p){return '<a class="row" href="#/p/'+p.id+'" data-t="'+esc(fold(p.title))+'"><span class="dot"></span><span class="tt">'+esc(p.title)+'</span>'+I.chev+'</a>'}).join('')+'</div>';
  h+='<div class="empty" id="none" hidden>No match. Try fewer letters.</div></main></div>';
  return h;
}
function page(id,anchor){
  var p=BY[id]; if(!p) return notFound();
  var saved=(sGet('bec.saved',[])||[]).indexOf(id)>-1;
  var h='<div class="cat-'+p.cat+'">'+shell({title:p.title,back:true})+'<main>';
  h+='<div class="ph"><span class="chip">'+CATS[p.cat].one+'</span><h2>'+esc(p.title)+'</h2>';
  h+='<div class="tools"><button class="tb" id="save" aria-pressed="'+saved+'">'+I.star+'<span>'+(saved?'Saved':'Save')+'</span></button>';
  h+='<button class="tb" id="smaller" aria-label="Smaller text">A−</button><button class="tb" id="larger" aria-label="Larger text">A+</button></div></div>';
  if(id==='s-ABCDE'){
    h+='<nav class="jump" aria-label="Jump to section">'+[['A','airway','Airway'],['B','breathing','Breathing'],['C','circulation','Circulation'],['D','disability','Disability'],['E','exposure','Exposure']].map(function(l){return '<a href="#/p/'+id+'/'+l[1]+'" aria-label="'+l[2]+'">'+l[0]+'</a>'}).join('')+'</nav>';
  }
  h+='<article class="doc">'+p.html+'</article>';
  h+='<div class="foot"><p>Unofficial offline copy of content from the UCSF/WHO “BEC” app (based on the WHO/ICRC Basic Emergency Care course). Not affiliated with or endorsed by WHO, ICRC or UCSF. A guide for trained providers; it does not replace clinical judgement. <a href="#/about">About and disclaimer</a></p></div>';
  h+='</main></div>';
  return h;
}
function about(){
  var S=DATA.strings||{};
  var h=shell({title:'About and credits',back:true,noAbout:true,noSearch:true})+'<main><div class="about">';
  h+='<h2>What this is</h2><p>An offline copy of the pages that were inside version 1.2.2 of the BEC app. That app was developed by the UCSF WHO Collaborating Centre for Emergency and Trauma Care and is based on the WHO/ICRC Basic Emergency Care course.</p>';
  h+='<p>The clinical wording has not been changed. The pages were rebuilt into a new viewer because the original app no longer runs. The content has not been reviewed or updated since it was bundled into the original app, and this copy is not affiliated with or endorsed by WHO, ICRC, UCSF or the original developers. Check anything you rely on against the current course materials and your local protocols.</p>';
  h+='<h2>How to use the ABCDE assessment</h2><p>'+esc(S.slide2_desc||'')+'</p>';
  h+='<h2>Credits, as shown in the original app</h2>';
  (S.acks_paras||[]).forEach(function(t){h+='<p>'+esc(t)+'</p>'});
  h+='<h2>Disclaimer, as shown in the original app</h2><p class="plain">'+esc(S.slide3_desc||'')+'</p>';
  h+='</div></main>';
  return h;
}
function search(q){
  var h=shell({title:'Search',back:true,noSearch:true})+'<main><div class="sbox"><input id="q" type="search" placeholder="Search conditions, skills, medicines" aria-label="Search" autocomplete="off" autocapitalize="off" spellcheck="false" value="'+esc(q||'')+'"></div><div class="res" id="res"></div></main>';
  return h;
}
function notFound(){return shell({title:'Not found',back:true})+'<main><p class="empty">That page is not in this copy.</p><p><a href="#/">Go to the home screen</a></p></main>'}

/* ---------- search engine ---------- */
var INDEX=PAGES.map(function(p){return {p:p,t:fold(p.title),x:fold(p.text)}});
function runSearch(q){
  var terms=fold(q).split(/[^a-z0-9]+/).filter(Boolean);
  var out=$('res'); if(!out) return;
  if(!terms.length){out.innerHTML='<p class="empty">Type a condition, skill or medicine. For example: tourniquet, burns, naloxone.</p>';return}
  var hits=[];
  INDEX.forEach(function(e){
    var s=0,ok=true;
    for(var i=0;i<terms.length;i++){
      var w=terms[i], inT=e.t.indexOf(w), inX=e.x.indexOf(w);
      if(inT<0&&inX<0){ok=false;break}
      if(inT>=0){s+=10; if(inT===0||e.t.charAt(inT-1)===' ')s+=5}
      if(inX>=0){var c=0,pos=inX;while(pos>=0&&c<6){c++;pos=e.x.indexOf(w,pos+1)}s+=2+c*.5}
    }
    if(ok) hits.push({e:e,s:s});
  });
  hits.sort(function(a,b){return b.s-a.s});
  if(!hits.length){out.innerHTML='<p class="empty">No pages match “'+esc(q)+'”. Check the spelling or try a shorter word.</p>';return}
  var res=terms.map(termRe);
  var html='<div class="rows">'+hits.slice(0,40).map(function(h){
    var p=h.e.p, raw=p.text, sn='', first=-1;
    for(var i=0;i<res.length;i++){res[i].lastIndex=0;var m=res[i].exec(raw);if(m&&(first<0||m.index<first))first=m.index}
    if(first>=0){
      var start=Math.max(0,first-55), seg=raw.substr(start,150);
      sn=(start>0?'… ':'')+highlight(seg,res)+(start+150<raw.length?' …':'');
    }
    return '<a class="row cat-'+p.cat+'" href="#/p/'+p.id+'"><span class="dot"></span><span class="tt">'+esc(p.title)+'<span class="chip">'+CATS[p.cat].one+'</span>'+(sn?'<span class="sn">'+sn+'</span>':'')+'</span></a>';
  }).join('')+'</div>';
  if(hits.length>40) html+='<p class="empty">Showing the best 40 of '+hits.length+' matches. Add another word to narrow it down.</p>';
  out.innerHTML=html;
}
function termRe(w){return new RegExp(w.replace(/e/g,'(?:ae|oe|e)'),'ig')}
function highlight(seg,res){
  var spans=[];
  res.forEach(function(re){re.lastIndex=0;var m;while((m=re.exec(seg))){spans.push([m.index,m.index+m[0].length]);if(m[0].length===0)re.lastIndex++}});
  spans.sort(function(a,b){return a[0]-b[0]});
  var out='',pos=0;
  spans.forEach(function(sp){if(sp[0]<pos)return;out+=esc(seg.slice(pos,sp[0]))+'<mark>'+esc(seg.slice(sp[0],sp[1]))+'</mark>';pos=sp[1]});
  return out+esc(seg.slice(pos));
}
function $(id){return document.getElementById(id)}

/* ---------- router ---------- */
var stack=[], scrolls={}, current='';
function parse(){
  var h=location.hash.replace(/^#/,'')||'/'; var a=h.split('/').filter(Boolean);
  return {raw:h,a:a};
}
function render(){
  var r=parse(); var a=r.a;
  // history stack for the in-app back button
  if(stack.length>1 && stack[stack.length-2]===r.raw){ scrolls[stack[stack.length-1]]=window.scrollY; stack.pop(); }
  else if(stack[stack.length-1]!==r.raw){ if(current) scrolls[current]=window.scrollY; stack.push(r.raw); }
  current=r.raw;
  var view='home', html='', after=null;
  if(!a.length){ html=home(); }
  else if(a[0]==='list'){ view='list'; html=list(a[1]); after=wireList; }
  else if(a[0]==='p'){
    view='page'; var id=ALIAS[a[1]]||a[1]; html=page(id,a[2]); after=function(){wirePage(id,a[2])};
    if(BY[id]){var rec=(sGet('bec.recent',[])||[]).filter(function(x){return x!==id}); rec.unshift(id); sSet('bec.recent',rec.slice(0,8))}
  }
  else if(a[0]==='search'){ view='search'; html=search(''); after=wireSearch; }
  else if(a[0]==='about'){ view='about'; html=about(); }
  else { html=notFound(); }
  document.body.className='view-'+view;
  app.innerHTML=html;
  var b=$('back'); if(b) b.addEventListener('click',goBack);
  if(after) after();
  var y=scrolls[r.raw];
  if(view==='page' && a[2]){ var el=document.getElementById(a[2]); if(el){ el.scrollIntoView(); return } }
  window.scrollTo(0,y||0);
}
function goBack(){ if(stack.length>1) history.back(); else location.hash='#/'; }
window.addEventListener('hashchange',render);

/* ---------- wiring ---------- */
function wireList(){
  var f=$('filter'); if(!f) return;
  f.addEventListener('input',function(){
    var q=fold(f.value.trim()), n=0;
    Array.prototype.forEach.call(document.querySelectorAll('#rows .row'),function(r){
      var show=!q||r.getAttribute('data-t').indexOf(q)>-1; r.style.display=show?'':'none'; if(show)n++;
    });
    $('none').hidden=n>0;
  });
}
function wireSearch(){
  var q=$('q'); q.focus(); var t;
  q.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){runSearch(q.value)},120)});
  runSearch('');
}
function wirePage(id,anchor){
  // images
  Array.prototype.forEach.call(document.querySelectorAll('.doc img.fig'),function(im){
    im.addEventListener('click',function(){zoom(im.src)});
  });
  Array.prototype.forEach.call(document.querySelectorAll('.jump a'),function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();var t=document.getElementById(a.getAttribute('href').split('/').pop());
      if(t)t.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  });
  var s=$('save'); s.addEventListener('click',function(){
    var list=(sGet('bec.saved',[])||[]).slice(); var i=list.indexOf(id);
    if(i>-1) list.splice(i,1); else list.unshift(id);
    sSet('bec.saved',list); var on=list.indexOf(id)>-1;
    s.setAttribute('aria-pressed',on); s.querySelector('span').textContent=on?'Saved':'Save';
  });
  $('smaller').addEventListener('click',function(){var i=Math.max(0,sGet('bec.size',1)-1);sSet('bec.size',i);applySize()});
  $('larger').addEventListener('click',function(){var i=Math.min(SIZES.length-1,sGet('bec.size',1)+1);sSet('bec.size',i);applySize()});
}
function zoom(src){$('zimg').src=src;$('zoom').classList.add('on')}
$('zclose').addEventListener('click',function(){$('zoom').classList.remove('on')});
document.addEventListener('keydown',function(e){if(e.key==='Escape')$('zoom').classList.remove('on')});

applySize();
render();
});
})();
