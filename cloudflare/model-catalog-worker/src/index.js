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
    {
      id: "chat",
      label: "Chat",
      description: "Instruction and general conversation models",
      sortOrder: 10,
      isVisible: true,
    },
    {
      id: "reasoning",
      label: "Reasoning",
      description: "Models tuned for structured reasoning and problem solving",
      sortOrder: 20,
      isVisible: true,
    },
    {
      id: "utility",
      label: "Utility",
      description: "Specialized models for titles, summaries, and support tasks",
      sortOrder: 30,
      isVisible: true,
    },
    {
      id: "story",
      label: "Story",
      description: "Narrative and creative-writing models",
      sortOrder: 40,
      isVisible: true,
    },
    {
      id: "research",
      label: "Research",
      description: "Experimental and compact research models",
      sortOrder: 50,
      isVisible: true,
    },
  ],
  featured: [],
  models: [],
}

const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>SupraLabs Catalog Admin</title>
<style>
:root{
  color-scheme:light;
  --bg:#f7f5f1;
  --panel:#ffffff;
  --panel-soft:#fbfaf7;
  --line:#e7e0d7;
  --line-strong:#d8cec2;
  --text:#26211e;
  --muted:#756b62;
  --faint:#9b9188;
  --accent:#b9864f;
  --accent-strong:#8e6235;
  --accent-soft:#f3e7d8;
  --good:#657f69;
  --bad:#b75f4e;
  --shadow:0 18px 50px rgba(40,32,23,.08);
  --radius:14px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button,input,textarea,select{font:inherit}
button{cursor:pointer}
.login{display:grid;min-height:100vh;place-items:center;padding:24px}
.login-card{background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);max-width:430px;padding:30px;width:100%}
.login-card h1{font-size:28px;line-height:1;margin:0 0 10px}
.login-card p{color:var(--muted);margin:0 0 22px}
.app{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:100vh}
.sidebar{background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;gap:18px;max-height:100vh;padding:24px;position:sticky;top:0}
.brand{display:flex;justify-content:space-between;gap:18px}
.brand h1{font-size:22px;line-height:1.05;margin:0}
.brand p{color:var(--muted);font-size:12px;font-weight:650;letter-spacing:.08em;margin:8px 0 0;text-transform:uppercase}
.status{align-items:center;background:var(--panel-soft);border:1px solid var(--line);border-radius:999px;color:var(--muted);display:inline-flex;font-size:12px;font-weight:700;gap:7px;height:32px;padding:0 11px;white-space:nowrap}
.dot{background:var(--good);border-radius:50%;height:7px;width:7px}
.toolbar{display:grid;gap:10px}
.search{position:relative}
.search input{background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;color:var(--text);height:42px;outline:none;padding:0 12px;width:100%}
.search input:focus,.field input:focus,.field textarea:focus,.field select:focus{border-color:color-mix(in srgb,var(--accent) 72%,var(--line));box-shadow:0 0 0 4px color-mix(in srgb,var(--accent-soft) 70%,transparent)}
.button-row{display:flex;gap:8px;flex-wrap:wrap}
.btn{align-items:center;background:var(--panel);border:1px solid var(--line-strong);border-radius:999px;color:var(--text);display:inline-flex;font-weight:740;gap:8px;height:38px;justify-content:center;padding:0 14px}
.btn:hover{border-color:var(--accent);color:var(--accent-strong)}
.btn.primary{background:var(--text);border-color:var(--text);color:#fff}
.btn.soft{background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 32%,var(--line));color:var(--accent-strong)}
.btn.danger{color:var(--bad)}
.btn:disabled{cursor:not-allowed;opacity:.55}
.model-list{display:grid;gap:6px;min-height:0;overflow:auto;padding-right:4px}
.model-item{background:transparent;border:1px solid transparent;border-radius:12px;color:var(--text);display:grid;gap:2px;padding:10px 12px;text-align:left;width:100%}
.model-item:hover{background:var(--panel-soft);border-color:var(--line)}
.model-item.active{background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
.model-item strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.model-item span{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.main{min-width:0;padding:28px}
.topbar{align-items:flex-start;display:flex;gap:18px;justify-content:space-between;margin:0 auto 22px;max-width:1180px}
.topbar h2{font-size:42px;letter-spacing:0;line-height:.98;margin:0}
.topbar p{color:var(--muted);font-size:15px;margin:10px 0 0;max-width:620px}
.summary{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 auto 22px;max-width:1180px}
.metric{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
.metric span{color:var(--muted);display:block;font-size:12px;font-weight:760;text-transform:uppercase}
.metric strong{display:block;font-size:27px;line-height:1;margin-top:8px}
.workspace{display:grid;gap:18px;grid-template-columns:minmax(0,1.45fr) minmax(330px,.75fr);margin:0 auto;max-width:1180px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 1px 0 rgba(255,255,255,.9);overflow:hidden}
.card-head{align-items:center;border-bottom:1px solid var(--line);display:flex;gap:12px;justify-content:space-between;padding:16px 18px}
.card-head h3{font-size:16px;margin:0}
.card-head p{color:var(--muted);font-size:12px;margin:2px 0 0}
.card-body{padding:18px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr))}
.field{display:grid;gap:7px}
.field.full{grid-column:1/-1}
.field label{color:var(--muted);font-size:12px;font-weight:760;text-transform:uppercase}
.field input,.field textarea,.field select{background:var(--panel-soft);border:1px solid var(--line);border-radius:10px;color:var(--text);outline:none;padding:10px 11px;width:100%}
.field textarea{min-height:90px;resize:vertical}
.check-grid{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}
.check{align-items:center;background:var(--panel-soft);border:1px solid var(--line);border-radius:10px;display:flex;font-weight:700;gap:8px;min-height:42px;padding:0 12px}
.asset-grid{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr))}
.asset{background:var(--panel-soft);border:1px solid var(--line);border-radius:13px;padding:12px}
.preview{align-items:center;aspect-ratio:16/9;background:linear-gradient(135deg,#eee6dc,#f9f6f0);border:1px solid var(--line);border-radius:10px;color:var(--muted);display:flex;font-weight:800;justify-content:center;margin-bottom:10px;overflow:hidden}
.preview.icon{aspect-ratio:1/1;margin:0 auto 10px;max-width:130px}
.preview img{height:100%;object-fit:cover;width:100%}
.upload{display:grid;gap:8px}
.upload input{font-size:12px}
.hint{color:var(--muted);font-size:12px;margin:0}
.side-stack{display:grid;gap:18px}
.category-row,.featured-row{align-items:center;border-bottom:1px solid var(--line);display:grid;gap:8px;grid-template-columns:minmax(0,1fr) 74px auto;padding:10px 0}
.category-row:last-child,.featured-row:last-child{border-bottom:0}
.category-row input,.featured-row input{background:var(--panel-soft);border:1px solid var(--line);border-radius:9px;min-width:0;padding:8px}
.mini{background:transparent;border:0;color:var(--muted);font-weight:800;padding:6px}
.mini:hover{color:var(--accent-strong)}
.json-area{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:220px}
.toast{background:var(--text);border-radius:999px;bottom:22px;color:#fff;font-weight:740;left:50%;opacity:0;padding:11px 16px;pointer-events:none;position:fixed;transform:translate(-50%,10px);transition:.18s ease;z-index:20}
.toast.show{opacity:1;transform:translate(-50%,0)}
.hidden{display:none!important}
@media(max-width:980px){.app{grid-template-columns:1fr}.sidebar{max-height:none;position:relative}.workspace,.summary{grid-template-columns:1fr}.topbar{flex-direction:column}.grid,.asset-grid,.check-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main id="login" class="login">
  <form class="login-card" id="loginForm">
    <h1>Catalog Admin</h1>
    <p>Manage SupraLabs models, featured cards, categories, thumbnails, and icons.</p>
    <div class="field"><label for="token">Admin token</label><input id="token" type="password" autocomplete="current-password" required /></div>
    <div style="height:14px"></div>
    <button class="btn primary" type="submit" style="width:100%">Sign in</button>
    <p class="hint" id="loginError" style="color:var(--bad);margin-top:14px"></p>
  </form>
</main>
<main id="app" class="app hidden">
  <aside class="sidebar">
    <div class="brand"><div><h1>SupraLabs Catalog</h1><p>Admin dashboard</p></div><span class="status"><i class="dot"></i><span id="dirtyState">Saved</span></span></div>
    <div class="toolbar">
      <div class="search"><input id="searchInput" placeholder="Search models" /></div>
      <select id="categoryFilter" class="btn" style="width:100%;appearance:auto"></select>
      <div class="button-row">
        <button class="btn soft" id="addModel" type="button">Add model</button>
        <button class="btn" id="duplicateModel" type="button">Duplicate</button>
      </div>
    </div>
    <div class="model-list" id="modelList"></div>
  </aside>
  <section class="main">
    <div class="topbar">
      <div><h2>Model catalog</h2><p>Use this dashboard as the private source of truth for the public Playground. Public users can read the catalog, but they cannot write to it.</p></div>
      <div class="button-row">
        <button class="btn" id="exportJson" type="button">Export JSON</button>
        <button class="btn" id="importJson" type="button">Import JSON</button>
        <button class="btn primary" id="saveCatalog" type="button">Save changes</button>
      </div>
    </div>
    <div class="summary">
      <div class="metric"><span>Models</span><strong id="modelCount">0</strong></div>
      <div class="metric"><span>Featured</span><strong id="featuredCount">0</strong></div>
      <div class="metric"><span>Categories</span><strong id="categoryCount">0</strong></div>
      <div class="metric"><span>Visible</span><strong id="visibleCount">0</strong></div>
    </div>
    <div class="workspace">
      <section class="card">
        <div class="card-head"><div><h3 id="editorTitle">Model details</h3><p>Edit metadata, artwork, and public display settings.</p></div><button class="btn danger" id="deleteModel" type="button">Remove</button></div>
        <div class="card-body">
          <div class="grid">
            <div class="field full"><label>Repository ID</label><input id="id" placeholder="SupraLabs/model-name" /></div>
            <div class="field"><label>Name</label><input id="name" /></div>
            <div class="field"><label>Category</label><select id="category"></select></div>
            <div class="field"><label>Family</label><input id="family" placeholder="Instruction, Reasoning, Utility" /></div>
            <div class="field"><label>Status</label><input id="status" placeholder="Available, Featured, Preview" /></div>
            <div class="field"><label>Pipeline tag</label><input id="pipelineTag" placeholder="text-generation" /></div>
            <div class="field"><label>Last modified</label><input id="lastModified" type="date" /></div>
            <div class="field"><label>Downloads</label><input id="downloads" type="number" min="0" /></div>
            <div class="field"><label>Likes</label><input id="likes" type="number" min="0" /></div>
            <div class="field full"><label>Description</label><textarea id="description"></textarea></div>
            <div class="field full"><label>Model URL</label><input id="url" placeholder="https://huggingface.co/SupraLabs/..." /></div>
            <div class="field full"><label>Tags</label><input id="tags" placeholder="text-generation, gguf, llama" /></div>
            <div class="field full"><label>Visibility</label><div class="check-grid"><label class="check"><input id="isVisible" type="checkbox" /> Visible</label><label class="check"><input id="isFeatured" type="checkbox" /> Featured</label><label class="check"><input id="syncFeatured" type="checkbox" checked /> Sync featured metadata</label></div></div>
            <div class="field full"><label>Assets</label>
              <div class="asset-grid">
                <div class="asset">
                  <div class="preview icon" id="iconPreview">Icon</div>
                  <div class="upload"><input id="iconUrl" placeholder="Icon URL or uploaded data URL" /><input id="iconFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /><p class="hint">Icon upload limit: 1 MB.</p></div>
                </div>
                <div class="asset">
                  <div class="preview" id="thumbPreview">Thumbnail</div>
                  <div class="upload"><input id="thumbnailUrl" placeholder="Thumbnail URL or uploaded data URL" /><input id="thumbFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /><p class="hint">Thumbnail upload limit: 5 MB. Use R2 later for larger asset libraries.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside class="side-stack">
        <section class="card">
          <div class="card-head"><div><h3>Featured order</h3><p>Controls the Playground hero cards.</p></div><button class="btn soft" id="rebuildFeatured" type="button">Rebuild</button></div>
          <div class="card-body" id="featuredEditor"></div>
        </section>
        <section class="card">
          <div class="card-head"><div><h3>Categories</h3><p>Add, hide, or reorder model sections.</p></div><button class="btn soft" id="addCategory" type="button">Add</button></div>
          <div class="card-body" id="categoryEditor"></div>
        </section>
        <section class="card hidden" id="jsonPanel">
          <div class="card-head"><div><h3>Catalog JSON</h3><p>Paste JSON to import or copy current catalog.</p></div><button class="btn soft" id="applyJson" type="button">Apply</button></div>
          <div class="card-body"><textarea class="json-area" id="jsonText"></textarea></div>
        </section>
      </aside>
    </div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const ICON_LIMIT=${ICON_UPLOAD_LIMIT};
const THUMB_LIMIT=${THUMBNAIL_UPLOAD_LIMIT};
let catalog=null;
let selectedId=null;
let dirty=false;
const $=(id)=>document.getElementById(id);
const fields=["id","name","description","category","family","status","pipelineTag","tags","downloads","likes","lastModified","url","iconUrl","thumbnailUrl","isVisible"];
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
function setDirty(value=true){dirty=value;$("dirtyState").textContent=dirty?"Unsaved":"Saved"}
async function api(path, options={}){const res=await fetch(path,{headers:{"content-type":"application/json",...(options.headers||{})},...options});if(!res.ok)throw new Error(await res.text());return res.json()}
async function boot(){try{catalog=await api("/api/admin/catalog");showApp();render()}catch{document.body.classList.remove("ready")}}
function showApp(){$("login").classList.add("hidden");$("app").classList.remove("hidden")}
function model(){return catalog.models.find(m=>m.id===selectedId)||catalog.models[0]||null}
function normalizeModel(m={}){return {id:m.id||"SupraLabs/New-Model",name:m.name||"New Model",description:m.description||"",category:m.category||catalog.categories[0]?.id||"chat",family:m.family||"",status:m.status||"Available",pipelineTag:m.pipelineTag||"text-generation",tags:Array.isArray(m.tags)?m.tags:[],downloads:Number(m.downloads||0),likes:Number(m.likes||0),lastModified:m.lastModified||new Date().toISOString().slice(0,10),url:m.url||"",iconUrl:m.iconUrl||"",thumbnailUrl:m.thumbnailUrl||"",isVisible:m.isVisible!==false,sortOrder:Number(m.sortOrder||catalog.models.length*10+10)}}
function normalizeCatalog(next){return {version:1,updatedAt:next.updatedAt||new Date().toISOString(),categories:(next.categories||[]).map((c,i)=>({id:String(c.id||"category-"+i).trim(),label:String(c.label||c.id||"Category").trim(),description:String(c.description||""),sortOrder:Number(c.sortOrder??(i+1)*10),isVisible:c.isVisible!==false})).filter(c=>c.id),featured:(next.featured||[]).map((m,i)=>({...normalizeModel(m),sortOrder:Number(m.sortOrder??(i+1)*10)})),models:(next.models||[]).map(normalizeModel)}}
function render(){if(!catalog.models.length){selectedId=null}else if(!selectedId||!catalog.models.some(m=>m.id===selectedId)){selectedId=catalog.models[0]?.id||null}renderStats();renderFilters();renderModelList();renderEditor();renderFeatured();renderCategories()}
function renderStats(){$("modelCount").textContent=catalog.models.length;$("featuredCount").textContent=catalog.featured.length;$("categoryCount").textContent=catalog.categories.length;$("visibleCount").textContent=catalog.models.filter(m=>m.isVisible!==false).length}
function renderFilters(){const options=['<option value="">All categories</option>',...catalog.categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>')].join("");$("categoryFilter").innerHTML=options;$("category").innerHTML=catalog.categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join("")}
function renderModelList(){const q=$("searchInput").value.toLowerCase();const cat=$("categoryFilter").value;const rows=catalog.models.filter(m=>(!cat||m.category===cat)&&((m.name+" "+m.id+" "+m.description).toLowerCase().includes(q))).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.name.localeCompare(b.name));$("modelList").innerHTML=rows.map(m=>'<button class="model-item '+(m.id===selectedId?'active':'')+'" data-id="'+esc(m.id)+'"><strong>'+esc(m.name)+'</strong><span>'+esc(m.id)+' · '+esc(m.category||"model")+'</span></button>').join("")||'<p class="hint">No models match this view.</p>';document.querySelectorAll(".model-item").forEach(btn=>btn.onclick=()=>{selectedId=btn.dataset.id;render()})}
function renderEditor(){const m=model();$("editorTitle").textContent=m?m.name:"Model details";document.querySelectorAll("#editorTitle,#deleteModel,#duplicateModel").forEach(el=>el.toggleAttribute("disabled",!m));if(!m)return;for(const key of fields){const el=$(key);if(!el)continue;if(key==="tags")el.value=(m.tags||[]).join(", ");else if(el.type==="checkbox")el.checked=m[key]!==false;else el.value=m[key]??""}$("isFeatured").checked=catalog.featured.some(f=>f.id===m.id);preview("iconPreview",m.iconUrl,"Icon");preview("thumbPreview",m.thumbnailUrl,"Thumbnail")}
function renderFeatured(){$("featuredEditor").innerHTML=catalog.featured.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map((f,i)=>'<div class="featured-row"><input value="'+esc(f.id)+'" data-feature-id="'+esc(f.id)+'" /><input type="number" value="'+Number(f.sortOrder??(i+1)*10)+'" data-feature-order="'+esc(f.id)+'" /><button class="mini" data-remove-feature="'+esc(f.id)+'">Remove</button></div>').join("")||'<p class="hint">No featured models yet.</p>';document.querySelectorAll("[data-remove-feature]").forEach(b=>b.onclick=()=>{catalog.featured=catalog.featured.filter(f=>f.id!==b.dataset.removeFeature);setDirty();render()});document.querySelectorAll("[data-feature-order]").forEach(i=>i.onchange=()=>{const f=catalog.featured.find(f=>f.id===i.dataset.featureOrder);if(f)f.sortOrder=Number(i.value||0);setDirty();render()});document.querySelectorAll("[data-feature-id]").forEach(i=>i.onchange=()=>{const f=catalog.featured.find(f=>f.id===i.dataset.featureId);if(f){f.id=i.value;setDirty();render()}})}
function renderCategories(){$("categoryEditor").innerHTML=catalog.categories.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(c=>'<div class="category-row"><input value="'+esc(c.label)+'" data-cat-label="'+esc(c.id)+'" /><input type="number" value="'+Number(c.sortOrder||0)+'" data-cat-order="'+esc(c.id)+'" /><button class="mini" data-remove-cat="'+esc(c.id)+'">Remove</button></div>').join("");document.querySelectorAll("[data-cat-label]").forEach(i=>i.onchange=()=>{const c=catalog.categories.find(c=>c.id===i.dataset.catLabel);if(c)c.label=i.value;setDirty();render()});document.querySelectorAll("[data-cat-order]").forEach(i=>i.onchange=()=>{const c=catalog.categories.find(c=>c.id===i.dataset.catOrder);if(c)c.sortOrder=Number(i.value||0);setDirty();render()});document.querySelectorAll("[data-remove-cat]").forEach(b=>b.onclick=()=>{catalog.categories=catalog.categories.filter(c=>c.id!==b.dataset.removeCat);setDirty();render()})}
function preview(id,url,label){const el=$(id);el.innerHTML=url?'<img src="'+esc(url)+'" alt="" />':label}
function updateSelected(){const m=model();if(!m)return;const oldId=m.id;for(const key of fields){const el=$(key);if(!el)continue;if(key==="tags")m.tags=el.value.split(",").map(s=>s.trim()).filter(Boolean);else if(key==="downloads"||key==="likes")m[key]=Number(el.value||0);else if(el.type==="checkbox")m[key]=el.checked;else m[key]=el.value}if(oldId!==m.id){catalog.featured.forEach(f=>{if(f.id===oldId)f.id=m.id});selectedId=m.id}if($("isFeatured").checked){const existing=catalog.featured.find(f=>f.id===m.id);if($("syncFeatured").checked){const copy={...m,sortOrder:existing?.sortOrder??catalog.featured.length*10+10};if(existing)Object.assign(existing,copy);else catalog.featured.push(copy)}else if(!existing){catalog.featured.push({...m,sortOrder:catalog.featured.length*10+10})}}else{catalog.featured=catalog.featured.filter(f=>f.id!==m.id)}setDirty();render()}
fields.forEach(key=>{addEventListener("input",e=>{if(e.target&&e.target.id===key)updateSelected()});addEventListener("change",e=>{if(e.target&&e.target.id===key)updateSelected()})});
$("searchInput").oninput=renderModelList;$("categoryFilter").onchange=renderModelList;
$("loginForm").onsubmit=async(e)=>{e.preventDefault();$("loginError").textContent="";try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({token:$("token").value})});await boot()}catch(err){$("loginError").textContent="Unable to sign in. Check the admin token."}};
$("addModel").onclick=()=>{const m=normalizeModel({id:"SupraLabs/New-Model-"+(catalog.models.length+1),name:"New Model"});catalog.models.push(m);selectedId=m.id;setDirty();render()};
$("duplicateModel").onclick=()=>{const m=model();if(!m)return;const copy=normalizeModel({...m,id:m.id+"-copy",name:m.name+" Copy",sortOrder:(m.sortOrder||0)+1});catalog.models.push(copy);selectedId=copy.id;setDirty();render()};
$("deleteModel").onclick=()=>{const m=model();if(!m||!confirm("Remove this model from the catalog?"))return;catalog.models=catalog.models.filter(x=>x.id!==m.id);catalog.featured=catalog.featured.filter(x=>x.id!==m.id);selectedId=catalog.models[0]?.id||null;setDirty();render()};
$("addCategory").onclick=()=>{const id="category-"+(catalog.categories.length+1);catalog.categories.push({id,label:"New Category",description:"",sortOrder:catalog.categories.length*10+10,isVisible:true});setDirty();render()};
$("rebuildFeatured").onclick=()=>{catalog.featured=catalog.models.filter(m=>catalog.featured.some(f=>f.id===m.id)||m.status==="Featured").map((m,i)=>({...m,sortOrder:(i+1)*10}));setDirty();render()};
$("exportJson").onclick=()=>{$("jsonPanel").classList.toggle("hidden");$("jsonText").value=JSON.stringify(catalog,null,2)};
$("importJson").onclick=()=>{$("jsonPanel").classList.toggle("hidden");$("jsonText").focus()};
$("applyJson").onclick=()=>{try{catalog=normalizeCatalog(JSON.parse($("jsonText").value));selectedId=catalog.models[0]?.id||null;setDirty();render();toast("JSON applied")}catch(err){toast("Invalid JSON")}};
$("saveCatalog").onclick=async()=>{try{catalog.updatedAt=new Date().toISOString();const saved=await api("/api/admin/catalog",{method:"PUT",body:JSON.stringify(catalog)});catalog=saved;setDirty(false);render();toast("Catalog saved")}catch(err){toast(err.message||"Unable to save catalog")}};
async function upload(file,limit,target){if(!file)return;if(file.size>limit){toast("File is too large for this field.");return}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});$(target).value=data;updateSelected()}
$("iconFile").onchange=e=>upload(e.target.files[0],ICON_LIMIT,"iconUrl");
$("thumbFile").onchange=e=>upload(e.target.files[0],THUMB_LIMIT,"thumbnailUrl");
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]))}
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

  if (url.pathname === "/admin" && request.method === "GET") {
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
    categories: catalog.categories
      .filter((category) => category.isVisible !== false)
      .sort(sortByOrder),
    featured: catalog.featured
      .filter((model) => model.isVisible !== false)
      .sort(sortByOrder),
    models: catalog.models
      .filter((model) => model.isVisible !== false)
      .sort(sortByOrder),
  }
}

function normalizeCatalog(input) {
  const categories = Array.isArray(input.categories) ? input.categories : []
  const models = Array.isArray(input.models) ? input.models : []
  const featured = Array.isArray(input.featured) ? input.featured : []

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: categories
      .map(normalizeCategory)
      .filter((category) => category.id)
      .sort(sortByOrder),
    featured: featured
      .map(normalizeModel)
      .filter((model) => model.id)
      .sort(sortByOrder),
    models: models
      .map(normalizeModel)
      .filter((model) => model.id)
      .sort(sortByOrder),
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
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
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
