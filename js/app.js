/**
 * APP LOGIC — giao diện ưu tiên thao tác nhanh
 * ------------------------------------------------------------------
 * Nguyên tắc:
 *   1. Hành động chính (mở cổng DVC / mở hệ thống tác nghiệp) nằm sẵn
 *      trên từng dòng — không bắt mở chi tiết rồi mới bấm được.
 *   2. Làm được mọi việc bằng bàn phím: / tìm, ↑↓ chọn, Enter mở,
 *      Shift+Enter xem chi tiết, C sao chép mã, 1/2 đổi tab, Esc thoát.
 *   3. Một listener uỷ quyền cho cả danh sách thay vì gắn cho từng dòng,
 *      để render lại 255 thủ tục vẫn nhẹ.
 * ------------------------------------------------------------------
 */

// Tab "Dịch vụ công": mức độ DVC trực tuyến theo Phụ lục QĐ 2117/QĐ-BTP.
const STATUS_LABEL_DVC = {
  "toan-trinh": "Toàn trình",
  "mot-phan": "Một phần",
  "khong-truc-tuyen": "Không trực tuyến",
};

// Tab "Tác nghiệp nội bộ": trạng thái triển khai của hệ thống (xem data.js).
const STATUS_LABEL_TN = TRANG_THAI_HT_LABEL;

/** Thứ tự hiển thị các nhóm hệ thống ở tab Tác nghiệp. */
const NHOM_ORDER = [NHOM_HT.CHUNG, NHOM_HT.BO, NHOM_HT.TINH];

const SVG_GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
const SVG_BUILDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M4 21h16M8 7h4M8 11h4M8 15h4"/></svg>';
const SVG_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const SVG_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const SVG_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

/** Biểu tượng của từng nhóm hệ thống. */
const NHOM_ICON = {
  [NHOM_HT.CHUNG]: SVG_GLOBE,
  [NHOM_HT.BO]: SVG_BUILDING,
  [NHOM_HT.TINH]: SVG_PIN,
};

const STORE_TAB = "dieuphoi-tab";
const STORE_THEME = "dieuphoi-theme";

const state = {
  tab: "dvc",          // "dvc" | "tn"
  query: "",
  category: "all",
  status: "all",
  items: [],           // kết quả đang hiển thị, dùng cho phím ↑ ↓
  selectedId: null,
  lastSyncAt: Date.now(),
};

const $ = (id) => document.getElementById(id);

// --------------------------------------------------------------------------
// DATA ACCESSORS
// --------------------------------------------------------------------------

/**
 * Nguồn dữ liệu hiện đang dùng dữ liệu trong js/data.js.
 *
 * Để nối API thật, thay nội dung 2 hàm dưới bằng fetch(), ví dụ:
 *
 *   async function getDichVuCong() {
 *     const res = await fetch("https://api.cuaban.gov.vn/dich-vu-cong");
 *     return res.json();
 *   }
 */
function getDichVuCong() { return DICH_VU_CONG; }
function getTacNghiep() { return TAC_NGHIEP; }

function isDVC() { return state.tab === "dvc"; }
function currentDataset() { return isDVC() ? getDichVuCong() : getTacNghiep(); }
function currentCategoryField() { return isDVC() ? "linhVuc" : "nhom"; }
function statusLabels() { return isDVC() ? STATUS_LABEL_DVC : STATUS_LABEL_TN; }
function findItem(id) { return currentDataset().find((d) => d.id === id); }

/** Mã dùng để sao chép nhanh: mã TTHC hoặc mã hệ thống. */
function primaryCode(item) { return isDVC() ? item.maTTHC : item.ma; }

/** Đường dẫn của hành động chính trên mỗi dòng. */
function primaryLink(item) {
  if (isDVC()) {
    const agency = item.coQuanThucHienList[0];
    return agency ? buildPortalUrl(item, agency) : "";
  }
  return item.url || "";
}

// --------------------------------------------------------------------------
// FILTER OPTIONS
// --------------------------------------------------------------------------

function populateFilterOptions() {
  const field = currentCategoryField();
  const categories = [...new Set(currentDataset().map((item) => item[field]))].sort(
    (a, b) => a.localeCompare(b, "vi")
  );

  const categorySelect = $("filterCategory");
  categorySelect.innerHTML =
    `<option value="all">${isDVC() ? "Tất cả lĩnh vực" : "Tất cả nhóm hệ thống"}</option>` +
    categories.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");

  const statusSelect = $("filterStatus");
  statusSelect.innerHTML =
    `<option value="all">${isDVC() ? "Tất cả mức độ trực tuyến" : "Tất cả trạng thái"}</option>` +
    Object.entries(statusLabels())
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join("");

  state.category = "all";
  state.status = "all";
  categorySelect.value = "all";
  statusSelect.value = "all";
}

// --------------------------------------------------------------------------
// FILTERING
// --------------------------------------------------------------------------

function getFilteredItems() {
  const field = currentCategoryField();
  const q = state.query.trim().toLowerCase();

  return currentDataset().filter((item) => {
    if (state.category !== "all" && item[field] !== state.category) return false;
    if (state.status !== "all" && item.trangThai !== state.status) return false;
    if (!q) return true;

    let haystack;
    if (isDVC()) {
      haystack = [item.maTTHC, item.ten, item.linhVuc, item.ghiChu];
      item.coQuanThucHienList.forEach((c) => haystack.push(c.tinh, c.maCoQuan, c.maDVC));
    } else {
      haystack = [item.ma, item.ten, item.nhom, item.moTa, item.doiTuong, item.donViCungCap, item.url];
    }
    return haystack.some((value) => (value || "").toLowerCase().includes(q));
  });
}

// --------------------------------------------------------------------------
// RENDERING
// --------------------------------------------------------------------------

function render() {
  const items = getFilteredItems();
  state.items = items;

  const container = $("listContainer");
  const emptyState = $("emptyState");

  $("countDVC").textContent = getDichVuCong().length;
  $("countTN").textContent = getTacNghiep().length;
  $("resultCount").innerHTML = `<strong>${items.length}</strong> ${isDVC() ? "thủ tục" : "hệ thống"}`;
  renderChips();

  container.classList.toggle("list", isDVC());
  container.classList.toggle("syslist", !isDVC());

  // Giữ dòng đang chọn nếu nó còn trong kết quả, không thì bỏ chọn.
  if (state.selectedId && !items.some((i) => i.id === state.selectedId)) state.selectedId = null;

  if (items.length === 0) {
    container.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  container.innerHTML = isDVC()
    ? items.map((item) => renderRow(item)).join("")
    : renderSystemGroups(items);

  markSelected(false);
}

/** Các bộ lọc đang bật, bấm × là gỡ ngay. */
function renderChips() {
  const chips = [];
  if (state.category !== "all") chips.push(chipHtml(state.category, "category"));
  if (state.status !== "all") chips.push(chipHtml(statusLabels()[state.status] || state.status, "status"));
  $("activeChips").innerHTML = chips.join("");
}

function chipHtml(label, key) {
  return `
    <span class="chip">${escapeHtml(label)}
      <button class="chip__x" type="button" data-clear="${key}" aria-label="Bỏ lọc ${escapeAttr(label)}">×</button>
    </span>`;
}

/** Một dòng thủ tục: mã (bấm để chép) · tên · lĩnh vực · mức độ · hành động. */
function renderRow(item) {
  const url = primaryLink(item);
  const open = url
    ? `<a class="act act--open" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"> Nộp hồ sơ <span aria-hidden="true">↗</span></a>`
    : `<span class="act act--open is-off">Chưa có cổng</span>`;

  return `
    <div class="row" data-id="${escapeAttr(item.id)}">
      <button class="row__code" type="button" data-copy="${escapeAttr(item.maTTHC)}"
              title="Sao chép mã ${escapeAttr(item.maTTHC)}">${escapeHtml(item.maTTHC)}</button>
      <p class="row__title" title="${escapeAttr(item.ten)}">${escapeHtml(item.ten)}</p>
      <span class="row__tag" title="${escapeAttr(item.linhVuc)}">${escapeHtml(item.linhVuc)}</span>
      <span class="status status--${item.trangThai}">${STATUS_LABEL_DVC[item.trangThai] || item.trangThai}</span>
      <span class="row__act">
        ${open}
        <button class="act act--more" type="button" data-detail="${escapeAttr(item.id)}"
                title="Chi tiết (Shift+Enter)" aria-label="Chi tiết">${SVG_INFO}</button>
      </span>
    </div>
  `;
}

// --------------------------------------------------------------------------
// TAB TÁC NGHIỆP — DANH MỤC HỆ THỐNG DẠNG THẺ, GOM THEO NHÓM
// --------------------------------------------------------------------------

/** Rút gọn địa chỉ truy cập để hiển thị (bỏ giao thức và dấu / ở cuối). */
function shortDomain(url) {
  if (!url) return "";
  let host = url.split("//").pop();
  if (host.endsWith("/")) host = host.slice(0, -1);
  return host;
}

function renderSystemGroups(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.nhom)) groups.set(item.nhom, []);
    groups.get(item.nhom).push(item);
  });

  const rank = (name) => {
    const i = NHOM_ORDER.indexOf(name);
    return i === -1 ? NHOM_ORDER.length : i;
  };
  const names = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "vi"));

  return names
    .map((name) => {
      const list = groups.get(name);
      return `
        <section class="sysgroup">
          <h2 class="sysgroup__head">
            <span class="sysgroup__icon">${NHOM_ICON[name] || SVG_GLOBE}</span>
            <span class="sysgroup__name">${escapeHtml(name)}</span>
            <span class="sysgroup__count">${list.length}</span>
          </h2>
          <div class="sysgrid">${list.map((item) => renderSystemCard(item)).join("")}</div>
        </section>
      `;
    })
    .join("");
}

function renderSystemCard(item) {
  const open = item.url
    ? `<a class="act act--open" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Mở hệ thống <span aria-hidden="true">↗</span></a>`
    : `<span class="act act--open is-off">Chưa có địa chỉ</span>`;

  const copy = item.url
    ? `<button class="act act--more" type="button" data-copy="${escapeAttr(item.url)}"
               title="Sao chép liên kết" aria-label="Sao chép liên kết">${SVG_LINK}</button>`
    : "";

  return `
    <article class="syscard" data-id="${escapeAttr(item.id)}">
      <header class="syscard__head">
        <button class="syscard__code" type="button" data-copy="${escapeAttr(item.ma)}"
                title="Sao chép mã ${escapeAttr(item.ma)}">${escapeHtml(item.ma)}</button>
        <span class="status status--${item.trangThai}">${STATUS_LABEL_TN[item.trangThai] || item.trangThai}</span>
      </header>
      <h3 class="syscard__title">${escapeHtml(item.ten)}</h3>
      <p class="syscard__host">${escapeHtml(shortDomain(item.url) || "chưa công bố địa chỉ")}</p>
      <p class="syscard__desc">${escapeHtml(item.moTa)}</p>
      <dl class="syscard__meta">
        <div><dt>Đối tượng</dt><dd>${escapeHtml(item.doiTuong)}</dd></div>
        <div><dt>Đơn vị cung cấp</dt><dd>${escapeHtml(item.donViCungCap)}</dd></div>
      </dl>
      <footer class="syscard__act">
        ${open}
        ${copy}
        <button class="act act--more" type="button" data-detail="${escapeAttr(item.id)}"
                title="Chi tiết (Shift+Enter)" aria-label="Chi tiết">${SVG_INFO}</button>
      </footer>
    </article>
  `;
}

// --------------------------------------------------------------------------
// CHỌN DÒNG BẰNG BÀN PHÍM
// --------------------------------------------------------------------------

function markSelected(scroll = true) {
  const container = $("listContainer");
  container.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
  if (!state.selectedId) return;

  const el = container.querySelector(`[data-id="${CSS.escape(state.selectedId)}"]`);
  if (!el) return;
  el.classList.add("is-selected");
  if (scroll) el.scrollIntoView({ block: "nearest" });
}

function selectIndex(index) {
  if (!state.items.length) return;
  const i = Math.max(0, Math.min(state.items.length - 1, index));
  state.selectedId = state.items[i].id;
  markSelected();
}

function moveSelection(step) {
  if (!state.items.length) return;
  const current = state.items.findIndex((i) => i.id === state.selectedId);
  selectIndex(current === -1 ? (step > 0 ? 0 : state.items.length - 1) : current + step);
}

function selectedItem() {
  return state.selectedId ? findItem(state.selectedId) : null;
}

function openExternal(url) {
  if (!url) {
    showToast("Hệ thống chưa công bố địa chỉ truy cập");
    return;
  }
  window.open(url, "_blank", "noopener");
}

// --------------------------------------------------------------------------
// REDIRECT URL BUILDER — đây là phần lõi mô phỏng luồng của trang gốc:
// Lĩnh vực > Thủ tục > Cơ quan thực hiện theo tỉnh > chuyển hướng cổng DVC
// --------------------------------------------------------------------------

/**
 * Build URL chuyển hướng sang cổng DVC của ngành, theo đúng khuôn tham số
 * quan sát được từ ví dụ thật:
 *   ?vneid=1&MaTTHCDP=...&MaTTHC=...&MaDVC=...&MaCoQuanThucHien=...&keyword=&CapThucHien=...
 *
 * Nếu ngành khác dùng tên tham số khác, chỉnh lại hàm này — đây là điểm
 * duy nhất cần sửa để khớp với mọi cổng DVC bạn cần trỏ tới.
 */
function buildPortalUrl(procedure, agency) {
  const params = new URLSearchParams({
    vneid: "1",
    MaTTHCDP: procedure.maTTHC,
    MaTTHC: procedure.maTTHC,
    MaDVC: agency.maDVC,
    MaCoQuanThucHien: agency.maCoQuan,
    keyword: "",
    // CapThucHien: String(procedure.capThucHien ?? ""),
  });
  return `${procedure.portalBaseUrl}?${params.toString()}`;
}

// --------------------------------------------------------------------------
// DRAWER (chi tiết)
// --------------------------------------------------------------------------

function openDrawer(id) {
  const item = findItem(id);
  if (!item) return;
  state.selectedId = id;
  markSelected(false);

  if (isDVC()) openDrawerDVC(item);
  else openDrawerTacNghiep(item);

  $("drawer").classList.add("is-open");
  $("drawer").setAttribute("aria-hidden", "false");
  $("overlay").classList.add("is-open");
  $("drawer").querySelector(".drawer__panel").focus();
}

function metaHtml(fields) {
  return fields
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`)
    .join("");
}

function actionsHtml(url, openLabel, code, codeLabel) {
  const open = url
    ? `<a class="btn btn--primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${openLabel} ↗</a>`
    : "";
  const copyUrl = url
    ? `<button class="btn" type="button" data-copy="${escapeAttr(url)}">Sao chép liên kết</button>`
    : "";
  return `
    ${open}
    <button class="btn" type="button" data-copy="${escapeAttr(code)}">${codeLabel}</button>
    ${copyUrl}
  `;
}

function openDrawerDVC(item) {
  $("drawerCode").textContent = item.maTTHC;
  $("drawerTitle").textContent = item.ten;
  $("drawerActions").innerHTML = actionsHtml(
    primaryLink(item), "Mở cổng dịch vụ công", item.maTTHC, "Sao chép mã TTHC"
  );

  const fields = [
    ["Lĩnh vực", item.linhVuc],
    ["Dịch vụ công trực tuyến", MUC_DO_LABEL[item.mucDoDVC]],
  ];
  // Nhóm II — lý do chỉ cung cấp một phần, theo đúng 4 cột con của Phụ lục.
  (item.lyDoMotPhan || []).forEach(({ nhan, noiDung }) => fields.push([nhan, noiDung]));
  if (item.ghiChu) fields.push(["Ghi chú", item.ghiChu]);
  $("drawerMeta").innerHTML = metaHtml(fields);

  $("drawerExtra").innerHTML = `
    <div class="agency-section">
      <p class="agency-section__label">Dịch vụ công &rsaquo; ${escapeHtml(item.linhVuc)} &rsaquo; Chọn cơ quan thực hiện</p>
      <div class="agency-list">
        ${item.coQuanThucHienList.map((agency) => renderAgencyRow(item, agency)).join("")}
      </div>
    </div>
  `;
}

function renderAgencyRow(procedure, agency) {
  const url = buildPortalUrl(procedure, agency);
  return `
    <div class="agency-row">
      <div class="agency-row__head">
        <span class="agency-row__tinh">${escapeHtml(agency.tinh)}</span>
        <span class="agency-row__code">${escapeHtml(agency.maCoQuan)}</span>
      </div>
      <a class="btn btn--primary btn--block" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        Mở cổng dịch vụ công ↗
      </a>
      <p class="agency-row__url">${escapeHtml(url)}</p>
    </div>
  `;
}

function openDrawerTacNghiep(item) {
  $("drawerCode").textContent = item.ma;
  $("drawerTitle").textContent = item.ten;
  $("drawerActions").innerHTML = actionsHtml(
    item.url, "Mở hệ thống tác nghiệp", item.ma, "Sao chép mã hệ thống"
  );

  $("drawerMeta").innerHTML = metaHtml([
    ["Nhóm hệ thống", item.nhom],
    ["Chức năng", item.moTa],
    ["Đối tượng sử dụng", item.doiTuong],
    ["Đơn vị cung cấp", item.donViCungCap],
    ["Trạng thái", STATUS_LABEL_TN[item.trangThai]],
    ["Địa chỉ truy cập", item.url || "Chưa công bố"],
  ]);
  $("drawerExtra").innerHTML = "";
}

function closeDrawer() {
  $("drawer").classList.remove("is-open");
  $("drawer").setAttribute("aria-hidden", "true");
  $("overlay").classList.remove("is-open");
}

function drawerIsOpen() { return $("drawer").classList.contains("is-open"); }

// --------------------------------------------------------------------------
// SAO CHÉP + TOAST
// --------------------------------------------------------------------------

function copyText(text) {
  const done = () => showToast(`Đã sao chép: ${text}`);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    return;
  }
  fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch (err) {
    showToast("Trình duyệt không cho sao chép tự động");
  }
  ta.remove();
}

let toastTimer = null;
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  void toast.offsetWidth;   // ép vẽ lại trước khi bật hiệu ứng hiện
  toast.classList.add("is-on");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-on");
    setTimeout(() => { toast.hidden = true; }, 200);
  }, 1600);
}

// --------------------------------------------------------------------------
// CLOCK + SYNC INDICATOR
// --------------------------------------------------------------------------

function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  $("clock").textContent = `${hh}:${mm}:${ss}`;

  const secondsAgo = Math.max(0, Math.round((Date.now() - state.lastSyncAt) / 1000));
  $("syncAgo").textContent = secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)} phút`;
}

function simulateRefresh() {
  const sync = $("syncIndicator");
  const refreshBtn = $("refreshBtn");
  sync.classList.add("is-syncing");
  refreshBtn.classList.add("is-spinning");

  setTimeout(() => {
    state.lastSyncAt = Date.now();
    sync.classList.remove("is-syncing");
    refreshBtn.classList.remove("is-spinning");
    render();
  }, 550);
}

// --------------------------------------------------------------------------
// THEME
// --------------------------------------------------------------------------

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(STORE_THEME); } catch (err) { /* chế độ riêng tư */ }
  document.documentElement.setAttribute("data-theme", saved || "light");
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem(STORE_THEME, next); } catch (err) { /* bỏ qua */ }
}

// --------------------------------------------------------------------------
// EVENTS
// --------------------------------------------------------------------------

function switchTab(tab) {
  if (state.tab === tab) return;
  state.tab = tab;
  state.query = "";
  state.selectedId = null;
  $("searchInput").value = "";
  try { localStorage.setItem(STORE_TAB, tab); } catch (err) { /* bỏ qua */ }

  $("tabDVC").classList.toggle("is-active", tab === "dvc");
  $("tabDVC").setAttribute("aria-selected", String(tab === "dvc"));
  $("tabTN").classList.toggle("is-active", tab === "tn");
  $("tabTN").setAttribute("aria-selected", String(tab === "tn"));
  $("searchInput").placeholder = tab === "dvc"
    ? "Tìm mã, tên thủ tục, lĩnh vực…"
    : "Tìm tên hệ thống, địa chỉ, đơn vị cung cấp…";

  populateFilterOptions();
  render();
}

function resetFilters() {
  state.query = "";
  state.category = "all";
  state.status = "all";
  $("searchInput").value = "";
  $("filterCategory").value = "all";
  $("filterStatus").value = "all";
  render();
}

function focusSearch() {
  const input = $("searchInput");
  input.focus();
  input.select();
}

function bindEvents() {
  $("tabDVC").addEventListener("click", () => switchTab("dvc"));
  $("tabTN").addEventListener("click", () => switchTab("tn"));

  $("searchInput").addEventListener("input", (e) => {
    state.query = e.target.value;
    state.selectedId = null;
    render();
  });

  $("filterCategory").addEventListener("change", (e) => { state.category = e.target.value; render(); });
  $("filterStatus").addEventListener("change", (e) => { state.status = e.target.value; render(); });
  $("resetBtn").addEventListener("click", resetFilters);
  $("clearFiltersBtn").addEventListener("click", resetFilters);
  $("refreshBtn").addEventListener("click", simulateRefresh);
  $("themeBtn").addEventListener("click", toggleTheme);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("overlay").addEventListener("click", closeDrawer);

  // Gỡ nhanh một bộ lọc từ chip.
  $("activeChips").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clear]");
    if (!btn) return;
    if (btn.dataset.clear === "category") { state.category = "all"; $("filterCategory").value = "all"; }
    else { state.status = "all"; $("filterStatus").value = "all"; }
    render();
  });

  // Một listener cho toàn bộ danh sách (255 dòng vẫn nhẹ).
  $("listContainer").addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) { copyText(copyBtn.dataset.copy); return; }

    const detailBtn = e.target.closest("[data-detail]");
    if (detailBtn) { openDrawer(detailBtn.dataset.detail); return; }

    if (e.target.closest("a")) return;   // nút "Mở..." để trình duyệt tự xử lý

    const row = e.target.closest("[data-id]");
    if (row) openDrawer(row.dataset.id);
  });

  // Sao chép từ trong drawer.
  $("drawer").addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) copyText(copyBtn.dataset.copy);
  });

  document.addEventListener("keydown", onKeydown);
}

function onKeydown(e) {
  const el = e.target;
  const inField = el instanceof HTMLElement && el.matches("input, select, textarea");

  // Ctrl/Cmd + K: nhảy vào ô tìm kiếm từ bất kỳ đâu.
  if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    focusSearch();
    return;
  }

  if (e.key === "Escape") {
    if (drawerIsOpen()) { closeDrawer(); return; }
    if (state.query || state.category !== "all" || state.status !== "all") { resetFilters(); return; }
    if (inField) el.blur();
    return;
  }

  if (drawerIsOpen()) return;

  if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); return; }
  if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); return; }

  if (e.key === "Enter") {
    const item = selectedItem();
    if (!item) { selectIndex(0); return; }   // Enter lần đầu: chọn kết quả đầu tiên
    e.preventDefault();
    if (e.shiftKey) openDrawer(item.id);
    else openExternal(primaryLink(item));
    return;
  }

  if (inField) return;   // các phím chữ/số bên dưới chỉ chạy khi không gõ chữ

  if (e.key === "/") { e.preventDefault(); focusSearch(); return; }
  if (e.key === "1") { switchTab("dvc"); return; }
  if (e.key === "2") { switchTab("tn"); return; }
  if (e.key === "c" || e.key === "C") {
    const item = selectedItem();
    if (item) copyText(primaryCode(item));
  }
}

// --------------------------------------------------------------------------
// UTIL
// --------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

// --------------------------------------------------------------------------
// INIT
// --------------------------------------------------------------------------

function init() {
  initTheme();
  bindEvents();

  // Mở lại đúng tab đã dùng lần trước.
  let savedTab = null;
  try { savedTab = localStorage.getItem(STORE_TAB); } catch (err) { /* bỏ qua */ }
  if (savedTab === "tn") switchTab("tn");
  else { populateFilterOptions(); render(); }

  tickClock();
  setInterval(tickClock, 1000);
}

document.addEventListener("DOMContentLoaded", init);
