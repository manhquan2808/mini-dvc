/**
 * APP LOGIC
 * ------------------------------------------------------------------
 * Toàn bộ chức năng: đồng hồ thời gian thực, đổi giao diện sáng/tối,
 * chuyển tab, tìm kiếm, lọc theo lĩnh vực/trạng thái, xem chi tiết,
 * và mô phỏng "làm mới / đồng bộ dữ liệu".
 * ------------------------------------------------------------------
 */

// Mức độ cung cấp dịch vụ công trực tuyến theo Phụ lục QĐ 2117/QĐ-BTP.
const STATUS_LABEL = {
  "toan-trinh": "Toàn trình",
  "mot-phan": "Một phần",
  "khong-truc-tuyen": "Không trực tuyến",
};

const PRIORITY_LABEL = {
  "cao": "Ưu tiên cao",
  "trung-binh": "Ưu tiên trung bình",
  "thap": "Ưu tiên thấp",
};

const state = {
  tab: "dvc",          // "dvc" | "tn"
  query: "",
  category: "all",
  status: "all",
  lastSyncAt: Date.now(),
};

// --------------------------------------------------------------------------
// DATA ACCESSORS
// --------------------------------------------------------------------------

/**
 * Nguồn dữ liệu hiện đang dùng dữ liệu mẫu trong js/data.js.
 *
 * Để nối API thật, thay nội dung 2 hàm dưới bằng fetch(), ví dụ:
 *
 *   async function getDichVuCong() {
 *     const res = await fetch("https://api.cuaban.gov.vn/dich-vu-cong");
 *     return res.json();
 *   }
 *
 * Sau đó gọi loadData() ở dưới dạng async và render lại danh sách
 * khi promise hoàn tất.
 */
function getDichVuCong() { return DICH_VU_CONG; }
function getTacNghiep() { return TAC_NGHIEP; }

function currentDataset() {
  return state.tab === "dvc" ? getDichVuCong() : getTacNghiep();
}

function currentCategoryField() {
  return state.tab === "dvc" ? "linhVuc" : "phongBan";
}

// --------------------------------------------------------------------------
// FILTER OPTIONS
// --------------------------------------------------------------------------

function populateFilterOptions() {
  const categoryField = currentCategoryField();
  const dataset = currentDataset();
  const categories = [...new Set(dataset.map((item) => item[categoryField]))].sort();

  const categorySelect = document.getElementById("filterCategory");
  const categoryLabel = state.tab === "dvc" ? "Tất cả lĩnh vực" : "Tất cả phòng ban";
  categorySelect.innerHTML = `<option value="all">${categoryLabel}</option>` +
    categories.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");

  const statusSelect = document.getElementById("filterStatus");
  const statusLabel = state.tab === "dvc" ? "Tất cả mức độ trực tuyến" : "Tất cả trạng thái";
  statusSelect.innerHTML = `<option value="all">${statusLabel}</option>` +
    Object.entries(STATUS_LABEL).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");

  state.category = "all";
  state.status = "all";
  categorySelect.value = "all";
  statusSelect.value = "all";
}

// --------------------------------------------------------------------------
// FILTERING
// --------------------------------------------------------------------------

function getFilteredItems() {
  const dataset = currentDataset();
  const categoryField = currentCategoryField();
  const q = state.query.trim().toLowerCase();

  return dataset.filter((item) => {
    if (state.category !== "all" && item[categoryField] !== state.category) return false;
    if (state.status !== "all" && item.trangThai !== state.status) return false;
    if (!q) return true;

    let haystack;
    if (state.tab === "dvc") {
      haystack = [item.maTTHC, item.ten, item.linhVuc, item.ghiChu];
      item.coQuanThucHienList.forEach((c) => haystack.push(c.tinh, c.maCoQuan, c.maDVC));
    } else {
      haystack = [item.ma, item.ten, item.phongBan, item.nguoiPhuTrach];
    }

    return haystack.some((field) => (field || "").toLowerCase().includes(q));
  });
}

// --------------------------------------------------------------------------
// RENDERING
// --------------------------------------------------------------------------

function render() {
  const items = getFilteredItems();
  const container = document.getElementById("listContainer");
  const emptyState = document.getElementById("emptyState");
  const resultCount = document.getElementById("resultCount");

  document.getElementById("countDVC").textContent = getDichVuCong().length;
  document.getElementById("countTN").textContent = getTacNghiep().length;

  resultCount.textContent = `${items.length} kết quả`;

  if (items.length === 0) {
    container.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  container.innerHTML = items.map((item) => renderRow(item)).join("");

  container.querySelectorAll(".row").forEach((el) => {
    el.addEventListener("click", () => openDrawer(el.dataset.id));
  });
}

function renderRow(item) {
  const isDVC = state.tab === "dvc";

  if (isDVC) {
    const count = item.coQuanThucHienList.length;
    const places = count === 1
      ? item.coQuanThucHienList[0].tinh
      : `${count} tỉnh/thành có thể thực hiện`;
    return `
      <button class="row" type="button" data-id="${escapeAttr(item.id)}">
        <span class="row__code">${escapeHtml(item.maTTHC)}</span>
        <span class="row__main">
          <p class="row__title">${escapeHtml(item.ten)}</p>
          <p class="row__sub">${escapeHtml(places)}</p>
        </span>
        <span class="row__tag">${escapeHtml(item.linhVuc)}</span>
        <span class="row__time">${escapeHtml(item.thoiGian)}</span>
        <span class="status status--${item.trangThai}">${STATUS_LABEL[item.trangThai] || item.trangThai}</span>
      </button>
    `;
  }

  return `
    <button class="row" type="button" data-id="${escapeAttr(item.id)}">
      <span class="row__code">${escapeHtml(item.ma)}</span>
      <span class="row__main">
        <p class="row__title">${escapeHtml(item.ten)}</p>
        <p class="row__sub">Phụ trách: ${escapeHtml(item.nguoiPhuTrach)}</p>
      </span>
      <span class="row__tag">${escapeHtml(item.phongBan)}</span>
      <span class="row__time">${escapeHtml(item.han)}</span>
      <span class="status status--${item.trangThai}">${STATUS_LABEL[item.trangThai] || item.trangThai}</span>
    </button>
  `;
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
    CapThucHien: String(procedure.capThucHien ?? ""),
  });
  return `${procedure.portalBaseUrl}?${params.toString()}`;
}

// --------------------------------------------------------------------------
// DRAWER (chi tiết)
// --------------------------------------------------------------------------

function openDrawer(id) {
  const item = currentDataset().find((d) => d.id === id);
  if (!item) return;
  const isDVC = state.tab === "dvc";

  if (isDVC) {
    openDrawerDVC(item);
  } else {
    openDrawerTacNghiep(item);
  }

  document.getElementById("drawer").classList.add("is-open");
  document.getElementById("drawer").setAttribute("aria-hidden", "false");
  document.getElementById("overlay").classList.add("is-open");
}

function openDrawerDVC(item) {
  document.getElementById("drawerCode").textContent = item.maTTHC;
  document.getElementById("drawerTitle").textContent = item.ten;

  const fields = [
    ["Lĩnh vực", item.linhVuc],
    ["Dịch vụ công trực tuyến", MUC_DO_LABEL[item.mucDoDVC]],
  ];
  // Nhóm II — lý do chỉ cung cấp một phần, theo đúng 4 cột con của Phụ lục.
  (item.lyDoMotPhan || []).forEach(({ nhan, noiDung }) => fields.push([nhan, noiDung]));
  if (item.ghiChu) fields.push(["Ghi chú", item.ghiChu]);
  document.getElementById("drawerMeta").innerHTML = fields
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`)
    .join("");

  const agencyListHtml = `
    <div class="agency-section">
      <p class="agency-section__label">Dịch vụ công &rsaquo; ${escapeHtml(item.linhVuc)} &rsaquo; Chọn cơ quan thực hiện</p>
      <div class="agency-list">
        ${item.coQuanThucHienList.map((agency) => renderAgencyRow(item, agency)).join("")}
      </div>
    </div>
  `;
  document.getElementById("drawerMeta").insertAdjacentHTML("afterend", agencyListHtml);
}

function renderAgencyRow(procedure, agency) {
  const url = buildPortalUrl(procedure, agency);
  return `
    <div class="agency-row">
      <div class="agency-row__head">
        <span class="agency-row__tinh">${escapeHtml(agency.tinh)}</span>
        <span class="agency-row__code">${escapeHtml(agency.maCoQuan)}</span>
      </div>
      <a class="btn btn--primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        Mở cổng dịch vụ công ↗
      </a>
      <p class="agency-row__url">${escapeHtml(url)}</p>
    </div>
  `;
}

function openDrawerTacNghiep(item) {
  document.getElementById("drawerCode").textContent = item.ma;
  document.getElementById("drawerTitle").textContent = item.ten;

  const fields = [
    ["Phòng ban", item.phongBan],
    ["Người phụ trách", item.nguoiPhuTrach],
    ["Hạn xử lý", item.han],
    ["Mức độ ưu tiên", PRIORITY_LABEL[item.uuTien] || item.uuTien],
    ["Trạng thái", STATUS_LABEL[item.trangThai]],
    ["Cập nhật", item.capNhat],
  ];
  document.getElementById("drawerMeta").innerHTML = fields
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`)
    .join("");
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("is-open");
  document.getElementById("drawer").setAttribute("aria-hidden", "true");
  document.getElementById("overlay").classList.remove("is-open");
  // dọn agency-section đã chèn thêm (nếu có) để lần mở sau không bị lặp
  document.querySelectorAll(".agency-section").forEach((el) => el.remove());
}

// --------------------------------------------------------------------------
// CLOCK + SYNC INDICATOR
// --------------------------------------------------------------------------

function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("clock").textContent = `${hh}:${mm}:${ss}`;

  const secondsAgo = Math.max(0, Math.round((Date.now() - state.lastSyncAt) / 1000));
  const label = secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)} phút`;
  document.getElementById("syncAgo").textContent = label;
}

function simulateRefresh() {
  const sync = document.getElementById("syncIndicator");
  const refreshBtn = document.getElementById("refreshBtn");
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
  const saved = localStorage.getItem("dieuphoi-theme");
  const theme = saved || "light";
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("dieuphoi-theme", next);
}

// --------------------------------------------------------------------------
// EVENTS
// --------------------------------------------------------------------------

function switchTab(tab) {
  state.tab = tab;
  state.query = "";
  document.getElementById("searchInput").value = "";

  document.getElementById("tabDVC").classList.toggle("is-active", tab === "dvc");
  document.getElementById("tabDVC").setAttribute("aria-selected", String(tab === "dvc"));
  document.getElementById("tabTN").classList.toggle("is-active", tab === "tn");
  document.getElementById("tabTN").setAttribute("aria-selected", String(tab === "tn"));

  populateFilterOptions();
  render();
}

function bindEvents() {
  document.getElementById("tabDVC").addEventListener("click", () => switchTab("dvc"));
  document.getElementById("tabTN").addEventListener("click", () => switchTab("tn"));

  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById("filterCategory").addEventListener("change", (e) => {
    state.category = e.target.value;
    render();
  });

  document.getElementById("filterStatus").addEventListener("change", (e) => {
    state.status = e.target.value;
    render();
  });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    state.status = "all";
    document.getElementById("searchInput").value = "";
    document.getElementById("filterCategory").value = "all";
    document.getElementById("filterStatus").value = "all";
    render();
  });

  document.getElementById("refreshBtn").addEventListener("click", simulateRefresh);
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);

  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  document.getElementById("overlay").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
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
  populateFilterOptions();
  render();
  tickClock();
  setInterval(tickClock, 1000);
}

document.addEventListener("DOMContentLoaded", init);
