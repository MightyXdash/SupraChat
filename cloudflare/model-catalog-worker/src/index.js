const CATALOG_KEY = "catalog"
const ICON_UPLOAD_LIMIT = 1024 * 1024
const THUMBNAIL_UPLOAD_LIMIT = 5 * 1024 * 1024
const CATALOG_PAYLOAD_LIMIT = 20 * 1024 * 1024
const SESSION_COOKIE = "supra_catalog_session"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12

const DEFAULT_CATALOG = {
  version: 1,
  updatedAt: "2026-06-22T00:00:00.000Z",
  categories: [
    { id: "chat", label: "Chat", description: "Instruction and general conversation models", sortOrder: 10, isVisible: true },
    { id: "reasoning", label: "Reasoning", description: "Structured reasoning and problem solving", sortOrder: 20, isVisible: true },
    { id: "utility", label: "Utility", description: "Titles, summaries, and support tasks", sortOrder: 30, isVisible: true },
    { id: "story", label: "Story", description: "Narrative and creative-writing models", sortOrder: 40, isVisible: true },
    { id: "research", label: "Research", description: "Experimental and compact research models", sortOrder: 50, isVisible: true },
  ],
  featured: [],
  models: [],
}

const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>SupraLabs Catalog Console</title>
<style>
:root{
  color-scheme:light;
  --bg:#f4f3f0;
  --panel:#fff;
  --panel-soft:#faf9f6;
  --ink:#25323a;
  --ink-2:#4f5d66;
  --muted:#7d746c;
  --line:#e3ddd5;
  --line-2:#d4cabf;
  --accent:#b9864f;
  --accent-soft:#f4e8da;
  --ok:#667f69;
  --warn:#b9864f;
  --bad:#b75f4e;
  --shadow:0 16px 42px rgba(38,33,30,.075);
}
*{box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.35 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button,input,textarea,select{font:inherit}
button{align-items:center;background:#fff;border:1px solid var(--line-2);border-radius:10px;color:var(--ink);cursor:pointer;display:inline-flex;font-weight:760;gap:7px;justify-content:center;min-height:32px;padding:0 10px}
button:hover{border-color:var(--accent);color:#8e6235}
button.primary{background:var(--ink);border-color:var(--ink);color:#fff}
button.soft{background:var(--accent-soft);border-color:#e8d3bd;color:#8e6235}
button.danger{border-color:#ecd6d0;color:var(--bad)}
button.icon{min-width:32px;padding:0}
button:disabled{cursor:not-allowed;opacity:.52}
input,textarea,select{background:#fff!important;border:1px solid var(--line)!important;border-radius:10px;color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important;color-scheme:light;outline:none;padding:8px 10px;width:100%}
textarea{min-height:58px;resize:vertical}
input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;box-shadow:0 0 0 3px rgba(185,134,79,.16)}
input::placeholder,textarea::placeholder{color:#a49a90!important;-webkit-text-fill-color:#a49a90!important}
input:-webkit-autofill,textarea:-webkit-autofill,select:-webkit-autofill{box-shadow:0 0 0 1000px #fff inset!important;-webkit-text-fill-color:var(--ink)!important}
.hidden{display:none!important}
.login{display:grid;height:100%;place-items:center;padding:24px}
.login-card{background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);width:min(420px,100%);padding:26px}
.login-card h1{font-size:27px;line-height:1;margin:0 0 8px}
.login-card p{color:var(--muted);margin:0 0 18px}
.app{display:grid;gap:12px;grid-template-rows:auto minmax(0,1fr);height:100%;padding:14px}
.topbar{align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);display:grid;gap:12px;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr) auto;padding:12px 14px}
.brand h1{font-size:21px;line-height:1;margin:0}
.brand p{color:var(--muted);font-size:11px;font-weight:760;letter-spacing:.06em;margin:4px 0 0;text-transform:uppercase}
.stats{display:grid;gap:8px;grid-template-columns:repeat(4,minmax(0,1fr))}
.stat{background:var(--panel-soft);border:1px solid var(--line);border-radius:13px;padding:8px 10px}
.stat span{color:var(--muted);display:block;font-size:10px;font-weight:820;text-transform:uppercase}
.stat strong{display:block;font-size:20px;line-height:1;margin-top:4px}
.top-actions{display:flex;gap:8px;justify-content:flex-end}
.workspace{display:grid;gap:12px;grid-template-columns:360px minmax(520px,1fr) 330px;min-height:0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.panel-head{align-items:center;border-bottom:1px solid var(--line);display:flex;gap:10px;justify-content:space-between;min-height:47px;padding:10px 12px}
.panel-head h2{font-size:15px;margin:0}
.panel-head p{color:var(--muted);font-size:11px;margin:2px 0 0}
.panel-body{min-height:0;overflow:auto;padding:12px}
.models-tools{display:grid;gap:8px;padding:12px}
.filter-row{display:grid;gap:7px;grid-template-columns:1fr 1fr}
.segment{background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;display:grid;gap:3px;grid-template-columns:repeat(4,1fr);padding:3px}
.segment button{background:transparent;border:0;border-radius:9px;color:var(--muted);font-size:11px;min-height:28px;padding:0}
.segment button.active{background:#fff;box-shadow:0 1px 5px rgba(38,33,30,.08);color:var(--ink)}
.model-list{border-top:1px solid var(--line);min-height:0;overflow:auto;padding:8px}
.model-row{align-items:center;background:#fff;border:1px solid transparent;border-radius:12px;color:var(--ink);display:grid;gap:8px;grid-template-columns:minmax(0,1fr) auto;min-height:50px;padding:8px 9px;text-align:left;width:100%}
.model-row:hover{background:var(--panel-soft);border-color:var(--line)}
.model-row.active{background:var(--ink);border-color:var(--ink);color:#fff}
.model-row strong{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.model-row small{color:var(--muted);display:block;font-size:11px;font-weight:720;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.model-row.active small{color:#eff3f4}
.badges{display:flex;gap:4px;justify-content:flex-end}
.badge{background:#f0ede8;border:1px solid #e4ded6;border-radius:999px;color:var(--muted);font-size:10px;font-weight:820;padding:3px 6px;text-transform:uppercase}
.model-row.active .badge{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.18);color:#fff}
.editor-form{display:grid;gap:10px;grid-template-columns:repeat(12,minmax(0,1fr))}
.field{display:grid;gap:5px;grid-column:span 6}
.field.third{grid-column:span 4}
.field.quarter{grid-column:span 3}
.field.full{grid-column:1/-1}
.field label{color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.035em;text-transform:uppercase}
.field.inline{align-items:center;background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;display:flex;gap:8px;min-height:38px;padding:0 10px}
.field.inline input{height:auto;width:auto}
.editor-tabs{background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;display:flex;gap:4px;padding:3px}
.editor-tabs button{background:transparent;border:0;border-radius:9px;color:var(--muted);min-height:30px}
.editor-tabs button.active{background:#fff;color:var(--ink);box-shadow:0 1px 5px rgba(38,33,30,.08)}
.asset-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}
.asset-card{background:var(--panel-soft);border:1px solid var(--line);border-radius:14px;padding:10px}
.preview{align-items:center;background:#fff;border:1px dashed var(--line-2);border-radius:12px;color:var(--muted);display:flex;font-size:11px;font-weight:820;justify-content:center;overflow:hidden}
.preview.icon{height:74px;margin:0 auto 8px;width:74px}
.preview.thumb{aspect-ratio:16/9;margin-bottom:8px}
.preview img{height:100%;object-fit:cover;width:100%}
.tools-stack{display:grid;gap:10px}
.mini-list{display:grid;gap:6px}
.mini-row{align-items:center;background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;display:grid;gap:7px;grid-template-columns:minmax(0,1fr) 58px auto;padding:7px}
.mini-row input{min-height:30px;padding:6px 8px}
.empty{color:var(--muted);font-size:12px;margin:0;padding:8px}
.json-area{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;min-height:140px}
.toast{background:var(--ink);border-radius:999px;bottom:18px;color:#fff;font-weight:760;left:50%;opacity:0;padding:9px 14px;pointer-events:none;position:fixed;transform:translate(-50%,8px);transition:.18s ease;z-index:20}
.toast.show{opacity:1;transform:translate(-50%,0)}
@media(max-width:1180px){.workspace{grid-template-columns:320px minmax(0,1fr)}.right-rail{display:none}.topbar{grid-template-columns:1fr}.top-actions{justify-content:flex-start}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){html,body{overflow:auto}.app{height:auto;overflow:visible}.workspace{grid-template-columns:1fr}.model-list{max-height:320px}.field,.field.third,.field.quarter{grid-column:1/-1}}
</style>
</head>
<body>
<main id="login" class="login">
  <form class="login-card" id="loginForm">
    <h1>Catalog Console</h1>
    <p>Sign in to manage SupraLabs model metadata, featured placement, and artwork.</p>
    <div class="field full"><label for="token">Admin token</label><input id="token" type="password" autocomplete="current-password" required /></div>
    <div style="height:12px"></div>
    <button class="primary" type="submit" style="width:100%">Sign in</button>
    <p id="loginError" class="empty" style="color:var(--bad)"></p>
  </form>
</main>
<main id="app" class="app hidden">
  <header class="topbar">
    <div class="brand">
      <h1>Model Catalog</h1>
      <p>SupraLabs Admin</p>
    </div>
    <div class="stats">
      <div class="stat"><span>Models</span><strong id="statModels">0</strong></div>
      <div class="stat"><span>Featured</span><strong id="statFeatured">0</strong></div>
      <div class="stat"><span>Visible</span><strong id="statVisible">0</strong></div>
      <div class="stat"><span>Missing Art</span><strong id="statMissingArt">0</strong></div>
    </div>
    <div class="top-actions">
      <button id="publicJson" type="button">Public JSON</button>
      <button id="exportJson" type="button">Export</button>
      <button id="importJson" type="button">Import</button>
      <button id="saveCatalog" class="primary" type="button">Save</button>
    </div>
  </header>
  <section class="workspace">
    <aside class="panel">
      <div class="panel-head">
        <div><h2>Models</h2><p id="modelCount">0 models</p></div>
        <button id="addModel" class="soft" type="button">Add</button>
      </div>
      <div class="models-tools">
        <input id="searchInput" placeholder="Search name, repo, description" />
        <div class="filter-row">
          <select id="categoryFilter" aria-label="Category filter"><option value="">All categories</option></select>
          <select id="visibilityFilter" aria-label="Visibility filter">
            <option value="">Any visibility</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        <div class="segment" aria-label="Model status filter">
          <button class="active" data-filter="all" type="button">All</button>
          <button data-filter="featured" type="button">Featured</button>
          <button data-filter="not-featured" type="button">Other</button>
          <button data-filter="missing-art" type="button">No Art</button>
        </div>
        <div class="filter-row">
          <button id="duplicateModel" type="button">Duplicate</button>
          <button id="deleteModel" class="danger" type="button">Remove</button>
        </div>
      </div>
      <div id="modelList" class="model-list"></div>
    </aside>

    <section class="panel">
      <div class="panel-head">
        <div><h2 id="editorTitle">Model details</h2><p id="dirtyState">Saved</p></div>
        <div class="editor-tabs">
          <button class="active" data-tab="details" type="button">Details</button>
          <button data-tab="assets" type="button">Assets</button>
          <button data-tab="json" type="button">JSON</button>
        </div>
      </div>
      <div class="panel-body">
        <section id="tabDetails">
          <div class="editor-form">
            <div class="field full"><label>Repository ID</label><input id="id" placeholder="SupraLabs/model-name" /></div>
            <div class="field"><label>Name</label><input id="name" /></div>
            <div class="field third"><label>Category</label><select id="category"></select></div>
            <div class="field third"><label>Status</label><input id="status" placeholder="Available" /></div>
            <div class="field third"><label>Family</label><input id="family" placeholder="Instruction" /></div>
            <div class="field third"><label>Pipeline</label><input id="pipelineTag" placeholder="text-generation" /></div>
            <div class="field quarter"><label>Downloads</label><input id="downloads" type="number" min="0" /></div>
            <div class="field quarter"><label>Likes</label><input id="likes" type="number" min="0" /></div>
            <div class="field"><label>Last modified</label><input id="lastModified" type="date" /></div>
            <div class="field full"><label>Description</label><textarea id="description"></textarea></div>
            <div class="field full"><label>Model URL</label><input id="url" placeholder="https://huggingface.co/SupraLabs/..." /></div>
            <div class="field full"><label>Tags</label><input id="tags" placeholder="text-generation, gguf, llama" /></div>
            <label class="field inline"><input id="isVisible" type="checkbox" /> Visible in public catalog</label>
            <label class="field inline"><input id="isFeatured" type="checkbox" /> Featured card</label>
            <label class="field inline"><input id="syncFeatured" type="checkbox" checked /> Sync featured metadata</label>
          </div>
        </section>

        <section id="tabAssets" class="hidden">
          <div class="asset-grid">
            <div class="asset-card">
              <div class="preview icon" id="iconPreview">Icon</div>
              <div class="field full"><label>Icon URL</label><input id="iconUrl" placeholder="https://... or uploaded data URL" /></div>
              <div class="field full"><label>Upload icon, 1 MB</label><input id="iconFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></div>
            </div>
            <div class="asset-card">
              <div class="preview thumb" id="thumbPreview">Thumbnail</div>
              <div class="field full"><label>Thumbnail URL</label><input id="thumbnailUrl" placeholder="https://... or uploaded data URL" /></div>
              <div class="field full"><label>Upload thumbnail, 5 MB</label><input id="thumbFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></div>
            </div>
          </div>
        </section>

        <section id="tabJson" class="hidden">
          <div class="field full"><label>Catalog JSON</label><textarea id="jsonText" class="json-area"></textarea></div>
          <div class="filter-row">
            <button id="copyJson" type="button">Copy JSON</button>
            <button id="applyJson" class="soft" type="button">Apply JSON</button>
          </div>
        </section>
      </div>
    </section>

    <aside class="panel right-rail">
      <div class="panel-head">
        <div><h2>Tools</h2><p>Featured and categories</p></div>
        <button id="rebuildFeatured" type="button">Rebuild</button>
      </div>
      <div class="panel-body tools-stack">
        <section>
          <div class="panel-head" style="border:0;min-height:0;padding:0 0 8px"><h2>Featured order</h2></div>
          <div id="featuredEditor" class="mini-list"></div>
        </section>
        <section>
          <div class="panel-head" style="border:0;min-height:0;padding:0 0 8px">
            <h2>Categories</h2>
            <button id="addCategory" type="button">Add</button>
          </div>
          <div id="categoryEditor" class="mini-list"></div>
        </section>
      </div>
    </aside>
  </section>
</main>
<div id="toast" class="toast"></div>
<script>
const ICON_LIMIT=${ICON_UPLOAD_LIMIT};
const THUMB_LIMIT=${THUMBNAIL_UPLOAD_LIMIT};
let catalog=null;
let selectedId=null;
let dirty=false;
let activeFilter="all";
const $=(id)=>document.getElementById(id);
const fields=["id","name","description","category","family","status","pipelineTag","tags","downloads","likes","lastModified","url","iconUrl","thumbnailUrl","isVisible"];
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
function setDirty(value){dirty=value!==false;$("dirtyState").textContent=dirty?"Unsaved changes":"Saved"}
async function api(path,options){const res=await fetch(path,{headers:{"content-type":"application/json"},credentials:"include",...(options||{})});if(!res.ok)throw new Error(await res.text());return res.json()}
async function boot(){try{catalog=await api("/api/admin/catalog");showApp();render()}catch(e){$("app").classList.add("hidden");$("login").classList.remove("hidden")}}
function showApp(){$("login").classList.add("hidden");$("app").classList.remove("hidden")}
function model(){return catalog.models.find((m)=>m.id===selectedId)||catalog.models[0]||null}
function featuredIds(){return new Set((catalog.featured||[]).map((f)=>f.id))}
function normalizeModel(m){m=m||{};return {id:m.id||"SupraLabs/New-Model",name:m.name||"New Model",description:m.description||"",category:m.category||catalog.categories[0]?.id||"chat",family:m.family||"",status:m.status||"Available",pipelineTag:m.pipelineTag||"text-generation",tags:Array.isArray(m.tags)?m.tags:[],downloads:Number(m.downloads||0),likes:Number(m.likes||0),lastModified:m.lastModified||new Date().toISOString().slice(0,10),url:m.url||"",iconUrl:m.iconUrl||"",thumbnailUrl:m.thumbnailUrl||"",isVisible:m.isVisible!==false,sortOrder:Number(m.sortOrder||catalog.models.length*10+10)}}
function normalizeCatalog(next){return {version:1,updatedAt:next.updatedAt||new Date().toISOString(),categories:(next.categories||[]).map((c,i)=>({id:String(c.id||"category-"+i).trim(),label:String(c.label||c.id||"Category").trim(),description:String(c.description||""),sortOrder:Number(c.sortOrder??(i+1)*10),isVisible:c.isVisible!==false})).filter((c)=>c.id),featured:(next.featured||[]).map((m,i)=>({...normalizeModel(m),sortOrder:Number(m.sortOrder??(i+1)*10)})),models:(next.models||[]).map(normalizeModel)}}
function render(){catalog.models=catalog.models||[];catalog.categories=catalog.categories||[];if(!catalog.models.length){selectedId=null}else if(!selectedId||!catalog.models.some((m)=>m.id===selectedId)){selectedId=catalog.models[0]?.id||null}renderStats();renderSelects();renderModelList();renderEditor();renderFeatured();renderCategories()}
function renderStats(){const f=featuredIds();$("statModels").textContent=catalog.models.length;$("statFeatured").textContent=(catalog.featured||[]).length;$("statVisible").textContent=catalog.models.filter((m)=>m.isVisible!==false).length;$("statMissingArt").textContent=catalog.models.filter((m)=>!m.iconUrl||!m.thumbnailUrl).length;$("modelCount").textContent=catalog.models.length+" models / "+f.size+" featured"}
function renderSelects(){const categoryOptions=['<option value="">All categories</option>'].concat(catalog.categories.map((c)=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>')).join("");$("categoryFilter").innerHTML=categoryOptions;$("category").innerHTML=catalog.categories.map((c)=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join("")}
function filteredModels(){const q=$("searchInput").value.toLowerCase();const cat=$("categoryFilter").value;const visibility=$("visibilityFilter").value;const f=featuredIds();return catalog.models.map((m,i)=>({m,i})).filter(({m})=>(!q||((m.name+" "+m.id+" "+m.description+" "+(m.tags||[]).join(" ")).toLowerCase().includes(q)))&&(!cat||m.category===cat)&&(!visibility||(visibility==="visible"?m.isVisible!==false:m.isVisible===false))&&(activeFilter==="all"||(activeFilter==="featured"?f.has(m.id):activeFilter==="not-featured"?!f.has(m.id):(!m.iconUrl||!m.thumbnailUrl))))}
function renderModelList(){const f=featuredIds();const rows=filteredModels().sort((a,b)=>(a.m.sortOrder||0)-(b.m.sortOrder||0)||a.m.name.localeCompare(b.m.name));$("modelList").innerHTML=rows.map(({m})=>'<button class="model-row '+(m.id===selectedId?'active':'')+'" data-id="'+esc(m.id)+'"><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.id)+' / '+esc(m.category||"model")+'</small></span><span class="badges">'+(f.has(m.id)?'<i class="badge">Feat</i>':'')+(m.isVisible===false?'<i class="badge">Hidden</i>':'')+((!m.iconUrl||!m.thumbnailUrl)?'<i class="badge">Art</i>':'')+'</span></button>').join("")||'<p class="empty">No models match these filters.</p>';document.querySelectorAll(".model-row").forEach((btn)=>btn.onclick=()=>{selectedId=btn.dataset.id;render()})}
function renderEditor(){const m=model();$("editorTitle").textContent=m?m.name:"No model selected";["deleteModel","duplicateModel"].forEach((id)=>$(id).disabled=!m);if(!m)return;for(const key of fields){const el=$(key);if(!el)continue;if(key==="tags")el.value=(m.tags||[]).join(", ");else if(el.type==="checkbox")el.checked=m[key]!==false;else el.value=m[key]??""}$("isFeatured").checked=featuredIds().has(m.id);preview("iconPreview",m.iconUrl,"Icon");preview("thumbPreview",m.thumbnailUrl,"Thumbnail")}
function renderFeatured(){const rows=(catalog.featured||[]).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));$("featuredEditor").innerHTML=rows.map((f,i)=>'<div class="mini-row"><input value="'+esc(f.id)+'" data-feature-id="'+esc(f.id)+'" /><input type="number" value="'+Number(f.sortOrder??(i+1)*10)+'" data-feature-order="'+esc(f.id)+'" /><button class="icon danger" data-remove-feature="'+esc(f.id)+'" type="button">x</button></div>').join("")||'<p class="empty">No featured models.</p>';document.querySelectorAll("[data-remove-feature]").forEach((b)=>b.onclick=()=>{catalog.featured=catalog.featured.filter((f)=>f.id!==b.dataset.removeFeature);setDirty(true);render()});document.querySelectorAll("[data-feature-order]").forEach((i)=>i.oninput=()=>{const f=catalog.featured.find((f)=>f.id===i.dataset.featureOrder);if(f)f.sortOrder=Number(i.value||0);setDirty(true)});document.querySelectorAll("[data-feature-id]").forEach((i)=>i.onchange=()=>{const f=catalog.featured.find((f)=>f.id===i.dataset.featureId);if(f){f.id=i.value;setDirty(true);render()}})}
function renderCategories(){$("categoryEditor").innerHTML=catalog.categories.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map((c)=>'<div class="mini-row"><input value="'+esc(c.label)+'" data-cat-label="'+esc(c.id)+'" /><input type="number" value="'+Number(c.sortOrder||0)+'" data-cat-order="'+esc(c.id)+'" /><button class="icon danger" data-remove-cat="'+esc(c.id)+'" type="button">x</button></div>').join("")||'<p class="empty">No categories.</p>';document.querySelectorAll("[data-cat-label]").forEach((i)=>i.onchange=()=>{const c=catalog.categories.find((c)=>c.id===i.dataset.catLabel);if(c)c.label=i.value;setDirty(true);render()});document.querySelectorAll("[data-cat-order]").forEach((i)=>i.oninput=()=>{const c=catalog.categories.find((c)=>c.id===i.dataset.catOrder);if(c)c.sortOrder=Number(i.value||0);setDirty(true)});document.querySelectorAll("[data-remove-cat]").forEach((b)=>b.onclick=()=>{catalog.categories=catalog.categories.filter((c)=>c.id!==b.dataset.removeCat);setDirty(true);render()})}
function preview(id,url,label){const el=$(id);el.innerHTML=url?'<img src="'+esc(url)+'" alt="" />':label}
function updateSelected(){const m=model();if(!m)return;const oldId=m.id;for(const key of fields){const el=$(key);if(!el)continue;if(key==="tags")m.tags=el.value.split(",").map((s)=>s.trim()).filter(Boolean);else if(key==="downloads"||key==="likes")m[key]=Number(el.value||0);else if(el.type==="checkbox")m[key]=el.checked;else m[key]=el.value}if(oldId!==m.id){catalog.featured.forEach((f)=>{if(f.id===oldId)f.id=m.id});selectedId=m.id}if($("isFeatured").checked){const existing=catalog.featured.find((f)=>f.id===m.id);if($("syncFeatured").checked){const copy={...m,sortOrder:existing?.sortOrder??catalog.featured.length*10+10};if(existing)Object.assign(existing,copy);else catalog.featured.push(copy)}else if(!existing){catalog.featured.push({...m,sortOrder:catalog.featured.length*10+10})}}else{catalog.featured=catalog.featured.filter((f)=>f.id!==m.id)}setDirty(true);renderStats();renderModelList();renderFeatured()}
fields.forEach((key)=>{document.addEventListener("input",(e)=>{if(e.target&&e.target.id===key)updateSelected()});document.addEventListener("change",(e)=>{if(e.target&&e.target.id===key)updateSelected()})});
$("searchInput").oninput=renderModelList;$("categoryFilter").onchange=renderModelList;$("visibilityFilter").onchange=renderModelList;
document.querySelectorAll("[data-filter]").forEach((button)=>button.onclick=()=>{activeFilter=button.dataset.filter;document.querySelectorAll("[data-filter]").forEach((b)=>b.classList.toggle("active",b===button));renderModelList()});
document.querySelectorAll("[data-tab]").forEach((button)=>button.onclick=()=>{document.querySelectorAll("[data-tab]").forEach((b)=>b.classList.toggle("active",b===button));["details","assets","json"].forEach((tab)=>$("tab"+tab[0].toUpperCase()+tab.slice(1)).classList.toggle("hidden",tab!==button.dataset.tab));if(button.dataset.tab==="json")$("jsonText").value=JSON.stringify(catalog,null,2)});
$("loginForm").onsubmit=async(e)=>{e.preventDefault();$("loginError").textContent="";try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({token:$("token").value})});$("token").value="";await boot()}catch(err){$("loginError").textContent="Unable to sign in. Check the admin token."}};
$("publicJson").onclick=()=>window.open("/api/catalog","_blank");
$("addModel").onclick=()=>{const m=normalizeModel({id:"SupraLabs/New-Model-"+(catalog.models.length+1),name:"New Model"});catalog.models.push(m);selectedId=m.id;setDirty(true);render()};
$("duplicateModel").onclick=()=>{const m=model();if(!m)return;const copy=normalizeModel({...m,id:m.id+"-copy",name:m.name+" Copy",sortOrder:(m.sortOrder||0)+1});catalog.models.push(copy);selectedId=copy.id;setDirty(true);render()};
$("deleteModel").onclick=()=>{const m=model();if(!m||!confirm("Remove this model from the catalog?"))return;catalog.models=catalog.models.filter((x)=>x.id!==m.id);catalog.featured=catalog.featured.filter((x)=>x.id!==m.id);selectedId=catalog.models[0]?.id||null;setDirty(true);render()};
$("addCategory").onclick=()=>{const id="category-"+(catalog.categories.length+1);catalog.categories.push({id:id,label:"New Category",description:"",sortOrder:catalog.categories.length*10+10,isVisible:true});setDirty(true);render()};
$("rebuildFeatured").onclick=()=>{catalog.featured=catalog.models.filter((m)=>catalog.featured.some((f)=>f.id===m.id)||m.status==="Featured").map((m,i)=>({...m,sortOrder:(i+1)*10}));setDirty(true);render()};
$("exportJson").onclick=()=>{$("jsonText").value=JSON.stringify(catalog,null,2);document.querySelector('[data-tab="json"]').click();toast("Catalog exported to JSON panel")};
$("importJson").onclick=()=>{document.querySelector('[data-tab="json"]').click();$("jsonText").focus()};
$("copyJson").onclick=async()=>{try{await navigator.clipboard.writeText($("jsonText").value||JSON.stringify(catalog,null,2));toast("JSON copied")}catch{toast("Copy unavailable")}};
$("applyJson").onclick=()=>{try{catalog=normalizeCatalog(JSON.parse($("jsonText").value));selectedId=catalog.models[0]?.id||null;setDirty(true);render();toast("JSON applied")}catch(err){toast("Invalid JSON")}};
$("saveCatalog").onclick=async()=>{try{catalog.updatedAt=new Date().toISOString();const saved=await api("/api/admin/catalog",{method:"PUT",body:JSON.stringify(catalog)});catalog=saved;setDirty(false);render();toast("Catalog saved")}catch(err){toast(err.message||"Unable to save catalog")}};
async function upload(file,limit,target){if(!file)return;if(file.size>limit){toast("File is too large for this field.");return}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});$(target).value=data;updateSelected()}
$("iconFile").onchange=(e)=>upload(e.target.files[0],ICON_LIMIT,"iconUrl");
$("thumbFile").onchange=(e)=>upload(e.target.files[0],THUMB_LIMIT,"thumbnailUrl");
function esc(value){return String(value??"").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]))}
boot();
</script>
</body>
</html>`

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() })
  }

  if (url.pathname === "/api/catalog" && request.method === "GET") {
    const catalog = await readCatalog()
    return jsonResponse(publicCatalog(catalog), {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=86400",
      ...corsHeaders(),
    })
  }

  if ((url.pathname === "/" || url.pathname === "/admin") && request.method === "GET") {
    return new Response(ADMIN_HTML, {
      headers: {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "no-store",
      },
    })
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    const body = await readJson(request)
    if (!ADMIN_TOKEN || body.token !== ADMIN_TOKEN) {
      return textResponse("Invalid admin token.", 401)
    }

    return jsonResponse(
      { ok: true },
      {
        "Set-Cookie": `${SESSION_COOKIE}=${await sessionSignature()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
        "Cache-Control": "no-store",
      },
    )
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    return jsonResponse(
      { ok: true },
      {
        "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        "Cache-Control": "no-store",
      },
    )
  }

  if (url.pathname === "/api/admin/catalog" && request.method === "GET") {
    const auth = await requireAdmin(request)
    if (auth) return auth
    return jsonResponse(await readCatalog(), { "Cache-Control": "no-store" })
  }

  if (url.pathname === "/api/admin/catalog" && request.method === "PUT") {
    const auth = await requireAdmin(request)
    if (auth) return auth

    const body = await readJson(request)
    const catalog = normalizeCatalog(body)
    const payload = JSON.stringify(catalog)
    if (new TextEncoder().encode(payload).byteLength > CATALOG_PAYLOAD_LIMIT) {
      return textResponse("Catalog payload is too large. Move model assets to R2/CDN URLs before saving.", 413)
    }

    await CATALOG.put(CATALOG_KEY, payload)
    return jsonResponse(catalog, { "Cache-Control": "no-store" })
  }

  return textResponse("Not found.", 404)
}

async function readCatalog() {
  const raw = await CATALOG.get(CATALOG_KEY)
  if (!raw) return DEFAULT_CATALOG

  try {
    return normalizeCatalog(JSON.parse(raw))
  } catch {
    return DEFAULT_CATALOG
  }
}

function publicCatalog(catalog) {
  return {
    ...catalog,
    categories: catalog.categories.filter((category) => category.isVisible !== false).sort(sortByOrder),
    featured: catalog.featured.filter((model) => model.isVisible !== false).sort(sortByOrder),
    models: catalog.models.filter((model) => model.isVisible !== false).sort(sortByOrder),
  }
}

function normalizeCatalog(input) {
  const categories = Array.isArray(input.categories) ? input.categories : []
  const models = Array.isArray(input.models) ? input.models : []
  const featured = Array.isArray(input.featured) ? input.featured : []

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: categories.map(normalizeCategory).filter((category) => category.id).sort(sortByOrder),
    featured: featured.map(normalizeModel).filter((model) => model.id).sort(sortByOrder),
    models: models.map(normalizeModel).filter((model) => model.id).sort(sortByOrder),
  }
}

function normalizeCategory(category, index = 0) {
  return {
    id: safeString(category.id).slice(0, 80),
    label: safeString(category.label || category.id || "Category").slice(0, 120),
    description: safeString(category.description).slice(0, 240),
    sortOrder: safeNumber(category.sortOrder, (index + 1) * 10),
    isVisible: category.isVisible !== false,
  }
}

function normalizeModel(model, index = 0) {
  return {
    id: safeString(model.id).slice(0, 180),
    name: safeString(model.name || model.id || "Model").slice(0, 160),
    description: safeString(model.description).slice(0, 500),
    category: safeString(model.category).slice(0, 80),
    family: safeString(model.family).slice(0, 120),
    status: safeString(model.status || "Available").slice(0, 80),
    pipelineTag: safeString(model.pipelineTag).slice(0, 120),
    tags: Array.isArray(model.tags) ? model.tags.map((tag) => safeString(tag).slice(0, 80)).filter(Boolean).slice(0, 16) : [],
    downloads: safeNumber(model.downloads, 0),
    likes: safeNumber(model.likes, 0),
    lastModified: safeString(model.lastModified).slice(0, 40),
    url: safeUrl(model.url),
    iconUrl: safeImageUrl(model.iconUrl, ICON_UPLOAD_LIMIT),
    thumbnailUrl: safeImageUrl(model.thumbnailUrl, THUMBNAIL_UPLOAD_LIMIT),
    isVisible: model.isVisible !== false,
    sortOrder: safeNumber(model.sortOrder, (index + 1) * 10),
  }
}

function sortByOrder(a, b) {
  return (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || a.label || a.id).localeCompare(String(b.name || b.label || b.id))
}

function safeString(value) {
  return String(value ?? "").trim()
}

function safeNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function safeUrl(value) {
  const url = safeString(value)
  if (!url) return ""
  return url.startsWith("https://") ? url.slice(0, 500) : ""
}

function safeImageUrl(value, limit) {
  const url = safeString(value)
  if (!url) return ""
  if (url.startsWith("https://")) return url.slice(0, 2000)
  if (!url.startsWith("data:image/")) return ""
  if (new TextEncoder().encode(url).byteLength > limit * 1.4) return ""
  return url
}

async function requireAdmin(request) {
  const cookie = request.headers.get("cookie") || ""
  const expected = await sessionSignature()
  const hasSession = cookie.split(";").some((part) => part.trim() === `${SESSION_COOKIE}=${expected}`)

  if (!hasSession) {
    return textResponse("Unauthorized.", 401, { "Cache-Control": "no-store" })
  }

  return null
}

async function sessionSignature() {
  const data = new TextEncoder().encode(`supra:${ADMIN_TOKEN}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function jsonResponse(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json;charset=utf-8",
      ...headers,
    },
  })
}

function textResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain;charset=utf-8",
      ...headers,
    },
  })
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  }
}
