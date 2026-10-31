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
    target.innerHTML = imageData
      ? '<img src="' + escapeHTML(imageData) + '" alt="Featured story image preview">'
      : '<span>CG22</span><small>STORY IMAGE</small>';
    $("#imageStatus").textContent = imageData ? "Image added to preview." : "";
  }

  // Upload selected image to Cloudinary
  async function uploadImageToCloudinary(file) {
    const CLOUD_NAME = "bkueepzo";
    const UPLOAD_PRESET = "cg22_news_upload";

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET);
    form.append("folder", "cg22-news");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: form }
    );

    const result = await response.json();
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || "Cloudinary image upload failed.");
    }
    return result.secure_url;
  }

 
  $("#imageFile").addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 1200000) {
      showToast("Please use an image smaller than 1.2 MB.");
      return;
    }

    const status = $("#imageStatus");
    status.textContent = "Uploading image to Cloudinary…";

    try {
      const imageUrl = await uploadImageToCloudinary(file);
      setImage(imageUrl);
      showToast("Image uploaded successfully!");
    } catch (error) {
      status.textContent = "Image upload failed.";
      showToast(error.message);
    }
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
  $("#helpBtn").addEventListener("click",()=>showToast("Blogger draft mode is available. Save a story as an unpublished draft on the main Khabar CG22 website. Other channels remain disconnected."));
  
  // ===== Khabar CG22: Secure Blogger Draft Integration =====
  const PUBLISH_API = "https://khabarcg22-publish-api.d-deep-m.workers.dev";
  let adminSessionToken = "";

  // Add a Blogger login/status panel to Settings
  const settingsView = $("#view-settings");
  if (settingsView && !$("#bloggerAdminPanel")) {
    const panel = document.createElement("section");
    panel.id = "bloggerAdminPanel";
    panel.style.cssText = "margin:20px 0;padding:18px;border:1px solid #ddd;border-radius:12px;background:#fff;";
    panel.innerHTML = `
      <h3 style="margin:0 0 8px">Blogger connection</h3>
      <p id="bloggerAuthStatus" style="margin:0 0 14px;font-size:13px">Checking login status…</p>
      <button type="button" id="bloggerLoginBtn" style="padding:10px 16px;border:0;border-radius:8px;cursor:pointer">Login with Google</button>
      <button type="button" id="bloggerLogoutBtn" style="display:none;margin-left:8px;padding:10px 16px;border:1px solid #ccc;border-radius:8px;cursor:pointer">Logout</button>
      <p style="font-size:11px;opacity:.7;margin:12px 0 0">Connected blog: www.khabarcg22.in · Draft-only mode</p>
    `;
    settingsView.appendChild(panel);
  }

  // Add a separate Blogger draft button beside the existing review button
  const reviewButton = $("#reviewBtn");
  if (reviewButton && !$("#saveBloggerDraftBtn")) {
    const draftButton = document.createElement("button");
    draftButton.type = "button";
    draftButton.id = "saveBloggerDraftBtn";
    draftButton.textContent = "Save as Blogger Draft";
    draftButton.style.cssText = "display:block;margin-top:12px;padding:12px 18px;border:0;border-radius:9px;cursor:pointer;background:#263b55;color:white;width:100%;";
    reviewButton.insertAdjacentElement("afterend", draftButton);
  }

  const setBloggerStatus = (message, loggedIn = false) => {
    const status = $("#bloggerAuthStatus");
    const login = $("#bloggerLoginBtn");
    const logout = $("#bloggerLogoutBtn");
    if (status) status.textContent = message;
    if (login) login.style.display = loggedIn ? "none" : "inline-block";
    if (logout) logout.style.display = loggedIn ? "inline-block" : "none";
  };

  async function verifyAdminSession() {
    if (!adminSessionToken) {
      setBloggerStatus("Not logged in. Login with your authorized Google account.");
      return false;
    }
    try {
      const response = await fetch(PUBLISH_API + "/admin/check", {
        method: "GET",
        headers: { Authorization: "Bearer " + adminSessionToken }
      });
      const result = await response.json();
      if (!response.ok || !result.authenticated) throw new Error("Session invalid or expired.");
      setBloggerStatus("Connected as " + (result.email || "admin") + ". Ready to save Blogger drafts.", true);
      return true;
    } catch (error) {
      adminSessionToken = "";
      setBloggerStatus("Login check failed: " + error.message);
      return false;
    }
  }

  // Read the one-time login token from the URL fragment, then remove it
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const receivedToken = hashParams.get("admin_token");
  if (receivedToken) {
    adminSessionToken = receivedToken;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    verifyAdminSession();
  } else {
    verifyAdminSession();
  }

  $("#bloggerLoginBtn")?.addEventListener("click", () => {
    window.location.href = PUBLISH_API + "/admin/login";
  });

  $("#bloggerLogoutBtn")?.addEventListener("click", async () => {
    if (adminSessionToken) {
      try {
        await fetch(PUBLISH_API + "/admin/logout", {
          method: "POST",
          headers: { Authorization: "Bearer " + adminSessionToken }
        });
      } catch (error) {
        // Clear the local session even if the network request fails.
      }
    }
    adminSessionToken = "";
    setBloggerStatus("Logged out. Login again when you want to save a draft.");
    showToast("Logged out from Blogger admin.");
  });

  $("#saveBloggerDraftBtn")?.addEventListener("click", async () => {
    if (!adminSessionToken || !(await verifyAdminSession())) {
      showToast("Please login with Google first from Settings.");
      return;
    }

    const headline = $("#headline").value.trim();
    const story = $("#story").value.trim();
    if (!headline || !story) {
      showToast("Add both headline and full story first.");
      return;
    }

    if (!confirm("Save this story as an UNPUBLISHED DRAFT on the main Khabar CG22 website (www.khabarcg22.in)? It will NOT go live.")) return;

    const escapeForHtml = value => String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

   
const storyHtml = "<p>" + escapeForHtml(story).replace(/\n/g, "</p><p>") + "</p>";

let imageHtml = "";
if (imageData) {
  try {
    const imageUrl = new URL(imageData);
    if (imageUrl.protocol === "https:" && imageUrl.hostname === "res.cloudinary.com") {
      imageHtml = '<div><img src="' + escapeForHtml(imageUrl.href) + '" alt="' + escapeForHtml(headline) + '" style="max-width:100%;height:auto;" /></div>';
    }
  } catch (error) {
    imageHtml = "";
  }
}

const content = imageHtml + storyHtml;

    const labels = [$("#category").value, $("#location").value.trim()].filter(Boolean);

    const button = $("#saveBloggerDraftBtn");
    button.disabled = true;
    button.textContent = "Saving draft…";

    try {
      const response = await fetch(PUBLISH_API + "/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + adminSessionToken
        },
        body: JSON.stringify({ title: headline, content, labels })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.message || "Draft save failed.");

      showToast("Unpublished Blogger draft saved on www.khabarcg22.in!");
      setBloggerStatus("Google admin session active. Main Khabar CG22 draft saved.", true);
    } catch (error) {
      showToast("Blogger draft error: " + error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Save as Blogger Draft";
    }
  });
  // ===== End Blogger Draft Integration =====

  updateCounts(); updatePreview(); renderRecent();
})();
