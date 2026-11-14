(function(){
  const KEY = "dgr-theme";
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const lightCss = `
html[data-theme="light"]{
  --bg0:#eff5ff;
  --bg1:#dce7f7;
  --text:#13253b;
  --muted:rgba(19,37,59,.72);
  --stroke:rgba(19,37,59,.14);
  --shadow:0 14px 34px rgba(88,116,150,.18);
  --accent:#2b7fff;
  --accent2:#00a6d6;
}
html[data-theme="light"] body{
  background: radial-gradient(920px 520px at 88% 0%, rgba(79,172,254,.18), transparent 55%), linear-gradient(180deg, var(--bg0), var(--bg1));
}
html[data-theme="light"] .heroCard,
html[data-theme="light"] main > .card,
html[data-theme="light"] .sbox,
html[data-theme="light"] .panel,
html[data-theme="light"] .brand,
html[data-theme="light"] .timer,
html[data-theme="light"] .sideStat,
html[data-theme="light"] .charPanel,
html[data-theme="light"] .qImgWrap,
html[data-theme="light"] .pill,
html[data-theme="light"] .btn,
html[data-theme="light"] .iconBtn,
html[data-theme="light"] .infoBtn,
html[data-theme="light"] .mTop,
html[data-theme="light"] .mBottom,
html[data-theme="light"] .mBtn,
html[data-theme="light"] .mIcon,
html[data-theme="light"] .mStat,
html[data-theme="light"] .game-item,
html[data-theme="light"] .cardModal,
html[data-theme="light"] .xbtn,
html[data-theme="light"] .act,
html[data-theme="light"] .linkCard,
html[data-theme="light"] .sideAd{
  background:linear-gradient(180deg, rgba(255,255,255,.86), rgba(244,248,255,.78)) !important;
  color:var(--text);
  border-color:rgba(19,37,59,.12) !important;
  box-shadow:var(--shadow);
}
html[data-theme="light"] .heroHead,
html[data-theme="light"] .topbar{
  background:linear-gradient(180deg, rgba(255,255,255,.82), rgba(240,246,255,.72)) !important;
  border-bottom-color:rgba(19,37,59,.08) !important;
}
html[data-theme="light"] .optBtn{
  background:linear-gradient(180deg, rgba(255,255,255,.96), rgba(245,249,255,.88)) !important;
  border-color:rgba(19,37,59,.14) !important;
}
html[data-theme="light"] .note,
html[data-theme="light"] .small,
html[data-theme="light"] .muted,
html[data-theme="light"] .appname,
html[data-theme="light"] .heroBrandKicker,
html[data-theme="light"] .status,
html[data-theme="light"] .lbl,
html[data-theme="light"] .mLbl{
  color:rgba(19,37,59,.68) !important;
}
html[data-theme="light"] .record-line{
  color:#7a4d00 !important;
}
html[data-theme="light"] .record-line strong{
  color:#4a2b00 !important;
}
html[data-theme="light"] .record-line.empty,
html[data-theme="light"] .record-line.loading{
  color:rgba(19,37,59,.62) !important;
}
html[data-theme="light"] .heroTop .h{
  -webkit-text-fill-color:initial;
}
html[data-theme="light"] .heroBrandMark,
html[data-theme="light"] .gamesBtn,
html[data-theme="light"] [data-theme-toggle]{
  box-shadow:0 4px 12px rgba(79,172,254,.14);
  color:var(--text) !important;
}
html[data-theme="light"] .heroBrandTitle,
html[data-theme="light"] .name,
html[data-theme="light"] .sectionTitle,
html[data-theme="light"] .title,
html[data-theme="light"] .title2{
  color:#13253b !important;
}
html[data-theme="light"] .badge{
  background:rgba(43,127,255,.14) !important;
  border-color:rgba(43,127,255,.35) !important;
  color:#0b3d7a !important;
}
html[data-theme="light"] .badge.muted{
  background:rgba(19,37,59,.06) !important;
  border-color:rgba(19,37,59,.14) !important;
  color:#334e6b !important;
}
html[data-theme="light"] .game-item .status,
html[data-theme="light"] .game-item.available .status,
html[data-theme="light"] .sectionHint{
  color:#3d5570 !important;
}
html[data-theme="light"] .game-item .game-cta{
  background:linear-gradient(135deg, #2b7fff, #1a9fc7) !important;
  border-color:rgba(19,37,59,.12) !important;
  color:#ffffff !important;
  box-shadow:0 6px 14px rgba(43,127,255,.22);
}
html[data-theme="light"] .game-item.soon .game-cta{
  background:rgba(19,37,59,.08) !important;
  border-color:rgba(19,37,59,.16) !important;
  color:#334e6b !important;
  box-shadow:none;
}
html[data-theme="light"] .game-item .game-icon{
  background:rgba(43,127,255,.08) !important;
  border-color:rgba(43,127,255,.2) !important;
}
html[data-theme="light"] .pill,
html[data-theme="light"] .kv b,
html[data-theme="light"] .timeNum,
html[data-theme="light"] .val,
html[data-theme="light"] .mVal{
  color:#13253b !important;
}
html[data-theme="light"] .btn.primary{
  background:linear-gradient(135deg, rgba(43,127,255,.22), rgba(0,166,214,.16)) !important;
  color:#0b3d7a !important;
}

/* ألعاب المطابقة (pairs / airlogo / similarity) */
html[data-theme="light"] .grid .card .face{
  border-color:rgba(19,37,59,.14) !important;
  box-shadow:0 8px 18px rgba(88,116,150,.16) !important;
}
html[data-theme="light"] .grid .card .front{
  background:
    radial-gradient(280px 180px at 30% 25%, rgba(79,172,254,.12), transparent 55%),
    radial-gradient(240px 160px at 80% 80%, rgba(0,166,214,.10), transparent 55%),
    var(--card-back) center/44% no-repeat,
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(236,244,255,.88)) !important;
}
html[data-theme="light"] .grid .card .back{
  background:
    radial-gradient(320px 200px at 25% 30%, rgba(79,172,254,.10), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,.94), rgba(228,238,252,.90)) !important;
}
html[data-theme="light"] .grid .card .imgBox{
  background:rgba(255,255,255,.96) !important;
  border:1px solid rgba(19,37,59,.12) !important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.8);
}
html[data-theme="light"] .grid .card.matched .face{
  border-color:rgba(43,127,255,.45) !important;
}
html[data-theme="light"] .grid .card.matched::before{
  opacity:.85;
}
html[data-theme="light"] .stage,
html[data-theme="light"] .playArea,
html[data-theme="light"] .cargo,
html[data-theme="light"] .stat,
html[data-theme="light"] .top,
html[data-theme="light"] .lvl,
html[data-theme="light"] .chart{
  background:linear-gradient(180deg, rgba(255,255,255,.86), rgba(244,248,255,.78)) !important;
  color:var(--text);
  border-color:rgba(19,37,59,.12) !important;
}
`;

  const style = document.createElement('style');
  style.id = 'dgr-theme-style';
  style.textContent = lightCss;
  document.head.appendChild(style);

  function getTheme(){
    try{return localStorage.getItem(KEY) || root.getAttribute('data-theme') || 'dark';}catch(e){return root.getAttribute('data-theme') || 'dark';}
  }
  function setTheme(theme){
    root.setAttribute('data-theme', theme);
    try{localStorage.setItem(KEY, theme);}catch(e){}
    if(metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#eff5ff' : '#070B14');
    document.querySelectorAll('[data-theme-toggle]').forEach((btn)=>{
      btn.textContent = theme === 'light' ? '\u2600' : '\u263E';
      btn.classList.toggle('themeBtnActive', theme === 'light');
      btn.setAttribute('title', theme === 'light' ? 'الثيم النهاري' : 'الثيم الليلي');
      btn.setAttribute('aria-label', theme === 'light' ? 'الثيم النهاري' : 'الثيم الليلي');
    });
  }
  function toggleTheme(){
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  }
  function bind(){
    document.querySelectorAll('[data-theme-toggle]').forEach((btn)=>{
      btn.addEventListener('click', toggleTheme);
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ setTheme(getTheme()); bind(); });
  } else {
    setTheme(getTheme()); bind();
  }
})();

