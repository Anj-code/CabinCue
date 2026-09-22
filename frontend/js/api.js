/**
 * Small shared API + storage helper used by every page.
 * No frameworks — plain fetch wrapped with the auth token.
 */

const API_BASE = ""; // same-origin; backend serves the frontend too

const Auth = {
  getToken() {
    return localStorage.getItem("fc_token");
  },
  getRole() {
    return localStorage.getItem("fc_role");
  },
  getName() {
    return localStorage.getItem("fc_name");
  },
  getUserId() {
    return localStorage.getItem("fc_user_id");
  },
  setSession({ access_token, role, name, user_id }) {
    localStorage.setItem("fc_token", access_token);
    localStorage.setItem("fc_role", role);
    localStorage.setItem("fc_name", name);
    localStorage.setItem("fc_user_id", String(user_id));
  },
  clear() {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_role");
    localStorage.removeItem("fc_name");
    localStorage.removeItem("fc_user_id");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  logout() {
    this.clear();
    window.location.href = "login.html";
  },
  /**
   * Redirects to login.html unless a valid session exists for the given role.
   * Call at the top of every protected page.
   */
  requireRole(role) {
    if (!this.isLoggedIn() || this.getRole() !== role) {
      window.location.href = "login.html";
    }
  },
};

/**
 * Wrapper around fetch() that attaches the bearer token and handles
 * JSON parsing + error surfacing consistently.
 */
async function apiRequest(path, { method = "GET", body = null, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = Auth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error("Could not reach the server. Is the backend running?");
  }

  if (response.status === 401 && auth) {
    Auth.clear();
    window.location.href = "login.html";
    throw new Error("Session expired. Please log in again.");
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    const errMessage =
      typeof message === "string" ? message : JSON.stringify(message);
    throw new Error(errMessage);
  }

  return data;
}

/* ---------- Small UI helpers shared across pages ---------- */

function showToast(message, type = "") {
  let toast = document.getElementById("fc-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "fc-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function formatDate(dateStr) {
  // dateStr expected "YYYY-MM-DD"
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  // timeStr expected "HH:MM" (24h) -> convert to 12h display
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  } catch {
    return timeStr;
  }
}

function timeAgo(isoString) {
  const then = new Date(isoString + (isoString.endsWith("Z") ? "" : "Z"));
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusBadgeClass(status) {
  return (
    {
      PENDING: "badge-pending",
      CONFIRMED: "badge-confirmed",
      REJECTED: "badge-rejected",
      RESCHEDULED: "badge-rescheduled",
      CANCELLED: "badge-cancelled",
    }[status] || "badge-pending"
  );
}

function statusEmoji(status) {
  return (
    {
      PENDING: "🟡",
      CONFIRMED: "🟢",
      REJECTED: "🔴",
      RESCHEDULED: "🔵",
      CANCELLED: "⚪",
    }[status] || "🟡"
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/**
 * Returns today's date (local) as "YYYY-MM-DD", used as the min attribute
 * on date inputs so students/faculty cannot pick a past date client-side.
 */
function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
