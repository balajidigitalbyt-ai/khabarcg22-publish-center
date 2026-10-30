(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "cg22-publish-center-v1";
  let imageData = "";
  let pendingPost = null;
  let toastTimer;

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { drafts: [], queue: [], published: [] }; }
    catch { return { drafts: [], queue: [], published: [] }; }
  };
  let state = readState();
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateCounts(); return true; }
    catch { showToast("Browser storage is full. Remove a large image or old draft."); return false; }
  };
  const showToast = message => {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const wordCount = value => value.trim() ? value.trim().split(/\s+/).length : 0;
  const selectedDestinations = () => $$('input[name="destination"]:checked').map(el => el.value);
  const formData = () => ({
    id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    headline: $("#headline").value.trim(), story: $("#story").value.trim(),
    category: $("#category").value, location: $("#location").value.trim(),
    image: imageData, destinations: selectedDestinations(), updatedAt: new Date().toISOString()
  });
  const updateCounts = () => {
    $("#draftCount").textContent = state.drafts.length;
    $("#overviewDrafts").textContent = state.drafts.length;
    $("#overviewQueue").textContent = state.queue.length;
    $("#overviewPublished").textContent = state.published.length;
  };
  const updatePreview = () => {
    const headline = $("#headline").value.trim();
    const story = $("#story").value.trim();
    $("#headlineCount").textContent = $("#headline").value.length + " / 140";
    $("#storyCount").textContent = wordCount(story) + " words";
    $("#previewHeadline").textContent = headline || "Your headline will appear here";
    $("#previewExcerpt").textContent = story ? story.slice(0, 190) + (story.length > 190 ? "…" : "") : "Your story preview will appear here as you write. Keep the opening clear and informative.";
    $("#previewCategory").textContent = ($("#category").value || "LOCAL NEWS").toUpperCase();
    $("#previewLocation").textContent = ($("#location").value || "BHATAPARA").toUpperCase();
  };
  ["headline","story","category","location"].forEach(id => $("#" + id).addEventListener(id === "category" ? "change" : "input", updatePreview));

  function navigate(view) {
    const valid = ["overview","create","drafts","queue","published","settings"].includes(view) ? view : "overview";
    $$(".page-view").forEach(el => el.classList.toggle("active", el.id === "view-" + valid));
    $$(".nav-link[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === valid));
    const titles = {overview:"Overview",create:"Create post",drafts:"Drafts",queue:"Publishing queue",published:"Published history",settings:"Settings"};
    $("#crumbTitle").textContent = titles[valid];
    if (valid === "drafts") renderList("drafts");
    if (valid === "queue") renderList("queue");
    if (valid === "published") renderList("published");
    if (valid === "overview") renderRecent();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  $$("[data-view]").forEach(el => el.addEventListener("click", () => navigate(el.dataset.view)));
  $$("[data-go]").forEach(el => el.addEventListener("click", () => navigate(el.dataset.go)));

  function setImage(source) {
    imageData = source || "";
    const target = $("#previewImage");
    target.innerHTML = imageData ? '<img src="' + imageData + '" alt="Featured story image preview">' : '<span>CG22</span><small>STORY IMAGE</small>';
    $("#imageStatus").textContent = imageData ? "Image added to preview." : "";
  }
  $("#imageFile").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { showToast("Please choose a JPG, PNG or WEBP image."); return; }
    if (file.size > 1200000) { showToast("Please use an image smaller than 1.2 MB for browser draft storage."); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.onerror = () => showToast("Could not read this image. Try another file.");
    reader.readAsDataURL(file);
  });
  $("#useImageUrl").addEventListener("click", () => {
    const url = $("#imageUrl").value.trim();
    if (!url) { showToast("Paste an image URL first."); return; }
    try {
      const parsed = new URL(url);
      if (!["https:","http:"].includes(parsed.protocol)) throw new Error("Invalid");
      setImage(url); showToast("Image URL added to preview.");
    } catch { showToast("Please enter a valid http or https image URL."); }
  });
  $("#uploadZone").addEventListener("dragover", event => { event.preventDefault(); $("#uploadZone").classList.add("dragging"); });
  $("#uploadZone").addEventListener("dragleave", () => $("#uploadZone").classList.remove("dragging"));
  $("#uploadZone").addEventListener("drop", event => {
    event.preventDefault(); $("#uploadZone").classList.remove("dragging");
    const file = event.dataTransfer.files[0];
    if (file) { const input = $("#imageFile"); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event("change")); }
  });

  function fillForm(post) {
    $("#headline").value = post.headline || ""; $("#story").value = post.story || "";
    $("#category").value = post.category || ""; $("#location").value = post.location || "";
    $$('input[name="destination"]').forEach(el => el.checked = (post.destinations || []).includes(el.value));
    $("#imageUrl").value = ""; setImage(post.image || ""); updatePreview(); navigate("create");
  }
  function clearForm() {
    $("#headline").value = ""; $("#story").value = ""; $("#category").value = ""; $("#location").value = "";
    $$('input[name="destination"]').forEach(el => el.checked = false);
    $("#imageFile").value = ""; $("#imageUrl").value = ""; setImage(""); updatePreview();
  }
  $("#clearBtn").addEventListener("click", () => {
    if ($("#headline").value || $("#story").value || imageData) {
      if (!confirm("Clear all content in the editor? This will not delete saved drafts.")) return;
    }
    clearForm(); showToast("Editor cleared.");
  });
  $("#saveDraftBtn").addEventListener("click", () => {
    const post = formData();
    if (!post.headline && !post.story) { showToast("Add a headline or story before saving a draft."); return; }
    const existing = state.drafts.findIndex(item => item.id === window.currentDraftId);
    if (existing >= 0) { post.id = window.currentDraftId; state.drafts[existing] = post; }
    else state.drafts.unshift(post);
    if (persist()) { window.currentDraftId = post.id; showToast("Draft saved on this device."); renderRecent(); }
  });
  $("#reviewBtn").addEventListener("click", () => {
    const post = formData();
    if (!post.headline || !post.story) { showToast("Please add both a headline and the full story."); return; }
    if (!post.destinations.length) { showToast("Choose at least one destination."); return; }
    pendingPost = post;
    $("#reviewContent").innerHTML = '<div class="review-detail"><small>HEADLINE</small><strong>' + escapeHTML(post.headline) + '</strong></div><div class="review-detail"><small>STORY</small><strong>' + escapeHTML(post.story.slice(0,260)) + (post.story.length > 260 ? "…" : "") + '</strong></div><div class="review-detail"><small>CATEGORY / LOCATION</small><strong>' + escapeHTML(post.category || "Uncategorised") + " · " + escapeHTML(post.location || "Location not added") + '</strong></div><div class="review-detail"><small>DESTINATIONS</small><strong>' + escapeHTML(post.destinations.join(" · ")) + '</strong></div><p style="font-size:10px;color:#a07836;line-height:1.5">Demo only: this action places the story in a local queue. It will not publish or send anything.</p>';
    $("#reviewDialog").showModal();
  });
  $("#backToEdit").addEventListener("click", () => $("#reviewDialog").close());
  $("#queuePost").addEventListener("click", () => {
    if (!pendingPost) return;
    const idx = state.drafts.findIndex(item => item.id === window.currentDraftId);
    if (idx >= 0) state.drafts.splice(idx,1);
    state.queue.unshift({...pendingPost, queuedAt:new Date().toISOString()});
    if (persist()) {
      window.currentDraftId = null; $("#reviewDialog").close(); clearForm(); navigate("queue");
      showToast("Added to demo publishing queue. Nothing was sent.");
    }
  });
  function dateLabel(value) {
    try { return new Date(value).toLocaleString(undefined,{day:"numeric",month:"short",year:"numeric"}); }
    catch { return "Recently"; }
  }
  function renderRecent() {
    const target = $("#recentDrafts");
    if (!state.drafts.length) { target.className = "empty-state compact"; target.innerHTML = '<span class="empty-symbol">✎</span><strong>No drafts yet</strong><p>Your saved stories will appear here.</p><button class="outline-button" data-go="create">Create your first post</button>'; target.querySelector("[data-go]").addEventListener("click",()=>navigate("create")); return; }
    target.className = "recent-list";
    target.innerHTML = state.drafts.slice(0,3).map(post => '<div class="list-row"><div class="list-thumb">' + (post.image ? '<img src="' + escapeHTML(post.image) + '" alt="">' : "22") + '</div><div class="list-info"><strong>' + escapeHTML(post.headline || "Untitled draft") + '</strong><small>' + escapeHTML(post.category || "Uncategorised") + ' · Updated ' + dateLabel(post.updatedAt) + '</small></div><button class="mini-action" data-edit="' + escapeHTML(post.id) + '">Continue →</button></div>').join("");
    target.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click",()=>editDraft(btn.dataset.edit)));
  }
  function renderList(type) {
    const target = $("#" + type + "List"); const items = state[type] || [];
    if (!items.length) {
      const messages = {drafts:["No drafts saved yet","Create a post and save it here to continue later."],queue:["Your queue is clear","Stories you add to the demo queue will appear here."],published:["No published activity","A history of demo workflow actions will appear here."]};
      target.innerHTML = '<div class="empty-list"><b>' + messages[type][0] + '</b><span>' + messages[type][1] + '</span></div>'; return;
    }
    target.innerHTML = items.map(post => '<div class="list-row"><div class="list-thumb">' + (post.image ? '<img src="' + escapeHTML(post.image) + '" alt="">' : "22") + '</div><div class="list-info"><strong>' + escapeHTML(post.headline || "Untitled story") + '</strong><small>' + escapeHTML(post.category || "Uncategorised") + ' · ' + dateLabel(post.updatedAt || post.queuedAt || post.publishedAt) + ' · ' + escapeHTML((post.destinations || []).join(", ")) + '</small></div><div class="list-actions">' + (type === "drafts" ? '<button class="mini-action" data-edit="' + escapeHTML(post.id) + '">Edit</button>' : type === "queue" ? '<button class="mini-action" data-done="' + escapeHTML(post.id) + '">Mark done (demo)</button>' : '<span class="status-off">Demo record</span>') + '<button class="mini-action danger" data-delete="' + escapeHTML(post.id) + '">Delete</button></div></div>').join("");
    target.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click",()=>editDraft(btn.dataset.edit)));
    target.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click",()=>deleteItem(type,btn.dataset.delete)));
    target.querySelectorAll("[data-done]").forEach(btn => btn.addEventListener("click",()=>markDone(btn.dataset.done)));
  }
  function editDraft(id) {
    const post = state.drafts.find(item => item.id === id); if (!post) return;
    window.currentDraftId = id; fillForm(post);
  }
  function deleteItem(type,id) {
    if (!confirm("Delete this item from " + type + "?")) return;
    state[type] = state[type].filter(item => item.id !== id);
    if (persist()) { renderList(type); renderRecent(); showToast("Item deleted."); }
  }
  function markDone(id) {
    const idx = state.queue.findIndex(item => item.id === id); if (idx < 0) return;
    const item = state.queue.splice(idx,1)[0]; item.publishedAt = new Date().toISOString(); state.published.unshift(item);
    if (persist()) { renderList("queue"); showToast("Moved to demo history. No platform was contacted."); }
  }
  $("#helpBtn").addEventListener("click",()=>showToast("Demo mode: drafts stay in this browser. Publishing connections are planned for Phase 2."));
  updateCounts(); updatePreview(); renderRecent();
})();