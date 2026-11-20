/**
 * ĐĂNG NHẬP SSO (OpenID Connect — Authorization Code + PKCE)
 * ==========================================================================
 * TÌNH TRẠNG: chưa nối được với VNeID / SSO Cổng DVCQG.
 *
 * Lý do (không phải thiếu code, mà là ràng buộc từ bên cấp định danh):
 *   1. VNeID/DVCQG cấp client_id KÈM client_secret cho "confidential client"
 *      sau khi hồ sơ kết nối được duyệt. Secret không được phép nằm trong
 *      file tĩnh mà ai mở F12 cũng đọc được.
 *   2. Endpoint /token của các cổng này gần như chắc chắn không bật CORS cho
 *      origin lạ, nên trình duyệt không tự đổi mã lấy token được, kể cả khi
 *      dùng PKCE.
 *   3. redirect_uri phải được đăng ký trước trong hồ sơ kết nối.
 *
 * VÌ VẬY file này dựng sẵn toàn bộ luồng chuẩn OIDC để khi có thông tin kết
 * nối thì chỉ cần điền AUTH_CONFIG:
 *   - Có backend  -> đặt tokenProxyUrl, backend giữ client_secret.
 *   - Không backend, IdP cho phép public client + CORS -> để trống
 *     tokenProxyUrl, luồng PKCE chạy thẳng từ trình duyệt.
 *   - Chưa có gì  -> mode "mock" để xem và trình diễn giao diện.
 *
 * LƯU Ý QUAN TRỌNG: với trang tĩnh, đăng nhập ở đây chỉ để BIẾT AI ĐANG DÙNG
 * và cá nhân hoá giao diện. Nó KHÔNG bảo vệ dữ liệu: toàn bộ danh mục nằm
 * trong js/data.js mà trình duyệt nào cũng tải về được. Muốn thực sự kiểm
 * soát truy cập thì phải có máy chủ kiểm tra token trước khi trả dữ liệu.
 * ==========================================================================
 */

const AUTH_CONFIG = {
  // "mock" = đăng nhập giả lập để xem giao diện. Đổi thành "oidc" khi có client_id.
  mode: "mock",

  // Tên hiển thị trên nút đăng nhập.
  provider: "VNeID",

  // --- Điền theo tài liệu kết nối được cấp ---------------------------------
  // Chỉ cần issuer thì luồng tự đọc /.well-known/openid-configuration;
  // nếu IdP không công bố discovery thì điền tay 4 URL bên dưới.
  issuer: "",
  authorizeUrl: "",
  tokenUrl: "",
  userinfoUrl: "",
  endSessionUrl: "",

  clientId: "",
  scope: "openid profile",

  // Phải trùng tuyệt đối với redirect_uri đã đăng ký trong hồ sơ kết nối.
  redirectUri: window.location.origin + window.location.pathname,

  // Khi có backend: trỏ tới service tự đổi code lấy token (giữ client_secret).
  // Để trống = trình duyệt gọi thẳng tokenUrl (cần IdP bật CORS).
  tokenProxyUrl: "",

  // Bật lớp che giao diện khi chưa đăng nhập. Đây CHỈ là giao diện, không
  // phải kiểm soát truy cập — xem ghi chú đầu file.
  requireLogin: false,
};

const AUTH_SESSION_KEY = "dieuphoi-auth-session";
const AUTH_PKCE_KEY = "dieuphoi-auth-pkce";

// --------------------------------------------------------------------------
// LƯU PHIÊN
// --------------------------------------------------------------------------

/** Phiên nằm ở sessionStorage: đóng tab là mất, không rơi sang tab khác. */
function authRead() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch (err) {
    return null;
  }
}

function authWrite(session) {
  try { sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session)); } catch (err) { /* bỏ qua */ }
}

function authClear() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_PKCE_KEY);
  } catch (err) { /* bỏ qua */ }
}

// --------------------------------------------------------------------------
// PKCE
// --------------------------------------------------------------------------

function authRandomString(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => ("0" + b.toString(16)).slice(-2)).join("");
}

function authBase64Url(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function authChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return authBase64Url(digest);
}

/**
 * Giải mã phần payload của ID token để lấy tên hiển thị.
 * KHÔNG kiểm tra chữ ký — trang tĩnh không làm được việc đó. Token ở đây chỉ
 * dùng để hiển thị; mọi quyết định về quyền phải do máy chủ kiểm tra lại.
 */
function authDecodeJwt(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (err) {
    return {};
  }
}

// --------------------------------------------------------------------------
// CẤU HÌNH ENDPOINT
// --------------------------------------------------------------------------

let authDiscovered = null;

async function authEndpoints() {
  if (AUTH_CONFIG.authorizeUrl && AUTH_CONFIG.tokenUrl) return AUTH_CONFIG;
  if (authDiscovered) return authDiscovered;
  if (!AUTH_CONFIG.issuer) throw new Error("Chưa cấu hình issuer hoặc authorizeUrl trong AUTH_CONFIG.");

  const url = AUTH_CONFIG.issuer.replace(/\/+$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không đọc được cấu hình OIDC tại ${url} (HTTP ${res.status}).`);
  const meta = await res.json();

  authDiscovered = {
    ...AUTH_CONFIG,
    authorizeUrl: meta.authorization_endpoint,
    tokenUrl: meta.token_endpoint,
    userinfoUrl: meta.userinfo_endpoint,
    endSessionUrl: meta.end_session_endpoint || "",
  };
  return authDiscovered;
}

// --------------------------------------------------------------------------
// LUỒNG ĐĂNG NHẬP
// --------------------------------------------------------------------------

async function authLogin() {
  if (AUTH_CONFIG.mode === "mock") {
    authWrite({
      sub: "mock-0001",
      name: "Tài khoản thử nghiệm",
      donVi: "Chế độ thử — chưa nối SSO",
      mock: true,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    authRender();
    authNotify("Đã đăng nhập ở chế độ thử");
    return;
  }

  if (!AUTH_CONFIG.clientId) {
    authNotify("Chưa có client_id — xem hướng dẫn ở đầu js/auth.js");
    return;
  }

  try {
    const cfg = await authEndpoints();
    const verifier = authRandomString(32);
    const state = authRandomString(16);
    const nonce = authRandomString(16);
    sessionStorage.setItem(AUTH_PKCE_KEY, JSON.stringify({ verifier, state, nonce }));

    const params = new URLSearchParams({
      response_type: "code",
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: cfg.scope,
      state,
      nonce,
      code_challenge: await authChallenge(verifier),
      code_challenge_method: "S256",
    });
    window.location.assign(`${cfg.authorizeUrl}?${params.toString()}`);
  } catch (err) {
    authNotify(err.message || "Không khởi tạo được phiên đăng nhập");
  }
}

/** Chạy khi IdP chuyển hướng ngược về kèm ?code=...&state=... */
async function authHandleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    authCleanUrl();
    authNotify(`Đăng nhập bị từ chối: ${params.get("error_description") || error}`);
    return;
  }
  if (!code) return;

  let pkce = null;
  try { pkce = JSON.parse(sessionStorage.getItem(AUTH_PKCE_KEY) || "null"); } catch (err) { /* bỏ qua */ }
  authCleanUrl();

  if (!pkce || pkce.state !== params.get("state")) {
    authNotify("State không khớp — huỷ phiên đăng nhập để an toàn");
    return;
  }

  try {
    const cfg = await authEndpoints();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: pkce.verifier,
    });

    // Có backend thì để backend giữ client_secret và gọi IdP.
    const endpoint = AUTH_CONFIG.tokenProxyUrl || cfg.tokenUrl;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Đổi mã lấy token thất bại (HTTP ${res.status}).`);
    const token = await res.json();

    const claims = token.id_token ? authDecodeJwt(token.id_token) : {};
    let profile = claims;
    if (cfg.userinfoUrl && token.access_token) {
      try {
        const info = await fetch(cfg.userinfoUrl, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (info.ok) profile = { ...claims, ...(await info.json()) };
      } catch (err) { /* không lấy được userinfo thì dùng claims của id_token */ }
    }

    authWrite({
      sub: profile.sub || "",
      name: profile.name || profile.preferred_username || profile.email || "Người dùng",
      email: profile.email || "",
      donVi: profile.organization || profile.org_name || "",
      expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
    });
    authRender();
    authNotify("Đăng nhập thành công");
  } catch (err) {
    // Lỗi hay gặp nhất ở trang tĩnh: IdP không bật CORS cho endpoint token.
    const hint = err instanceof TypeError
      ? "Trình duyệt không gọi được endpoint token (nhiều khả năng do CORS). Cần một dịch vụ máy chủ đổi mã lấy token."
      : err.message;
    authNotify(hint);
  }
}

function authCleanUrl() {
  const url = window.location.origin + window.location.pathname + window.location.hash;
  window.history.replaceState({}, document.title, url);
}

function authLogout() {
  const session = authRead();
  authClear();
  authRender();

  if (AUTH_CONFIG.mode === "oidc" && AUTH_CONFIG.endSessionUrl && session && !session.mock) {
    const params = new URLSearchParams({ post_logout_redirect_uri: AUTH_CONFIG.redirectUri });
    window.location.assign(`${AUTH_CONFIG.endSessionUrl}?${params.toString()}`);
    return;
  }
  authNotify("Đã đăng xuất");
}

// --------------------------------------------------------------------------
// GIAO DIỆN
// --------------------------------------------------------------------------

function authEscape(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Dùng toast của app.js nếu có, không thì ghi log. */
function authNotify(message) {
  if (typeof showToast === "function") showToast(message);
  else console.info("[auth]", message);
}

function authInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  const last = parts[parts.length - 1] || "?";
  const first = parts.length > 1 ? parts[parts.length - 2] : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase() || "?";
}

const AUTH_SVG_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

function authRender() {
  const slot = document.getElementById("authSlot");
  if (!slot) return;
  const session = authRead();

  if (!session) {
    slot.innerHTML = `
      <button class="auth__btn" id="authLoginBtn" type="button">
        ${AUTH_SVG_USER}<span>Đăng nhập ${authEscape(AUTH_CONFIG.provider)}</span>
      </button>`;
  } else {
    slot.innerHTML = `
      <button class="auth__user" id="authUserBtn" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="auth__avatar">${authEscape(authInitials(session.name))}</span>
        <span class="auth__name">${authEscape(session.name)}</span>
      </button>
      <div class="auth__menu" id="authMenu" hidden>
        <p class="auth__menu-name">${authEscape(session.name)}</p>
        <p class="auth__menu-sub">${authEscape(session.donVi || session.email || session.sub || "")}</p>
        ${session.mock ? '<p class="auth__badge">Chế độ thử — chưa nối SSO thật</p>' : ""}
        <button class="auth__menu-item" id="authLogoutBtn" type="button">Đăng xuất</button>
      </div>`;
  }

  authApplyGate(session);
}

function authToggleMenu(open) {
  const menu = document.getElementById("authMenu");
  const btn = document.getElementById("authUserBtn");
  if (!menu || !btn) return;
  const next = open === undefined ? menu.hidden : open;
  menu.hidden = !next;
  btn.setAttribute("aria-expanded", String(next));
}

/** Lớp che khi chưa đăng nhập — chỉ là giao diện, không chặn được dữ liệu. */
function authApplyGate(session) {
  const existing = document.getElementById("authGate");
  if (!AUTH_CONFIG.requireLogin || session) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;

  const gate = document.createElement("div");
  gate.id = "authGate";
  gate.className = "authgate";
  gate.innerHTML = `
    <div class="authgate__panel">
      ${AUTH_SVG_USER}
      <p class="authgate__title">Cần đăng nhập để sử dụng</p>
      <p class="authgate__hint">Đăng nhập bằng tài khoản ${authEscape(AUTH_CONFIG.provider)} để xem danh mục thủ tục và hệ thống tác nghiệp.</p>
      <button class="btn btn--primary" id="authGateBtn" type="button">Đăng nhập ${authEscape(AUTH_CONFIG.provider)}</button>
    </div>`;
  document.body.appendChild(gate);
  document.getElementById("authGateBtn").addEventListener("click", authLogin);
}

function authBind() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("#authLoginBtn")) { authLogin(); return; }
    if (e.target.closest("#authLogoutBtn")) { authToggleMenu(false); authLogout(); return; }
    if (e.target.closest("#authUserBtn")) { authToggleMenu(); return; }
    if (!e.target.closest("#authMenu")) authToggleMenu(false);
  });

  // Esc đóng menu tài khoản trước, không để rơi xuống handler xoá bộ lọc.
  document.addEventListener("keydown", (e) => {
    const menu = document.getElementById("authMenu");
    if (e.key === "Escape" && menu && !menu.hidden) {
      e.stopPropagation();
      authToggleMenu(false);
    }
  }, true);
}

// --------------------------------------------------------------------------
// INIT
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  authBind();
  authRender();
  if (AUTH_CONFIG.mode === "oidc") authHandleRedirect();
});
