const AUTH_STORAGE_KEY = "familySalonAuth";
const authSlot = document.querySelector("[data-auth-slot]");
const loginForm = document.querySelector("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");
const authMessage = document.querySelector("[data-auth-message]");
const dashboardRoot = document.querySelector("[data-admin-dashboard]");
const dashboardMessage = document.querySelector("[data-dashboard-message]");

const authIsLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AUTH_API_BASE =
  window.location.protocol === "file:" || (authIsLocalHost && window.location.port !== "3000")
    ? "http://localhost:3000"
    : "";

function authApiUrl(path) {
  return `${AUTH_API_BASE}${path}`;
}

function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveStoredAuth(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function authRequestJson(url, options = {}) {
  const storedAuth = getStoredAuth();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (storedAuth?.token) {
    headers.Authorization = `Bearer ${storedAuth.token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      headers,
      ...options
    });
  } catch (_error) {
    throw new Error("Cannot reach the server. Run npm.cmd start and open http://localhost:3000.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function showAuthMessage(element, message, visible = true) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("visible", visible);
}

function renderAuthSlot() {
  if (!authSlot) {
    return;
  }

  const auth = getStoredAuth();

  if (!auth?.user) {
    authSlot.innerHTML = `
      <a class="nav-link-chip" href="login.html">Login</a>
      <a class="nav-link-chip nav-link-chip-strong" href="signup.html">Sign Up</a>
    `;
    return;
  }

  const dashboardLink =
    auth.user.role === "admin"
      ? '<a class="nav-link-chip nav-link-chip-strong" href="admin.html">Dashboard</a>'
      : '<span class="nav-link-chip nav-link-chip-muted">Signed in</span>';

  authSlot.innerHTML = `
    ${dashboardLink}
    <button class="nav-link-chip" type="button" data-logout-button>Logout</button>
  `;

  const logoutButton = authSlot.querySelector("[data-logout-button]");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await authRequestJson(authApiUrl("/api/auth/logout"), { method: "POST" });
      } catch (_error) {
        // Local logout still matters even if the server session is already gone.
      }

      clearStoredAuth();
      renderAuthSlot();

      if (window.location.pathname.endsWith("/admin.html") || window.location.pathname.endsWith("admin.html")) {
        window.location.href = "login.html";
      }
    });
  }
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password")
    };

    try {
      const data = await authRequestJson(authApiUrl("/api/auth/signup"), {
        method: "POST",
        body: JSON.stringify(payload)
      });

      saveStoredAuth(data);
      renderAuthSlot();
      showAuthMessage(authMessage, "Account created successfully. You are now signed in.");
      window.setTimeout(() => {
        window.location.href = data.user.role === "admin" ? "admin.html" : "booking.html";
      }, 900);
    } catch (error) {
      showAuthMessage(authMessage, error.message || "We could not create your account.");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };

    try {
      const data = await authRequestJson(authApiUrl("/api/auth/login"), {
        method: "POST",
        body: JSON.stringify(payload)
      });

      saveStoredAuth(data);
      renderAuthSlot();
      showAuthMessage(authMessage, `Welcome back, ${data.user.name}. Redirecting now.`);
      window.setTimeout(() => {
        window.location.href = data.user.role === "admin" ? "admin.html" : "booking.html";
      }, 900);
    } catch (error) {
      showAuthMessage(authMessage, error.message || "We could not log you in.");
    }
  });
}

function appointmentStatusBadge(status) {
  const map = {
    "Pending approval": "status-pending",
    Confirmed: "status-confirmed",
    Completed: "status-completed",
    Cancelled: "status-cancelled"
  };

  return map[status] || "status-pending";
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function updateAppointmentStatus(id, status) {
  await authRequestJson(authApiUrl(`/api/admin/appointments/${id}/status`), {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

function renderAdminDashboard(data) {
  if (!dashboardRoot) {
    return;
  }

  const { stats, appointments, reviews, messages, users } = data;

  dashboardRoot.innerHTML = `
    <section class="dashboard-shell">
      <div class="dashboard-topbar animate-in visible">
        <div>
          <span class="eyebrow">Admin Dashboard</span>
          <h1 class="section-title">Salon operations at a glance</h1>
          <p class="section-copy">Track appointments, guest messages, reviews, and account activity from one organized workspace.</p>
        </div>
      </div>

      <div class="dashboard-stats">
        <article class="dashboard-stat-card"><span>Total appointments</span><strong>${stats.appointments}</strong></article>
        <article class="dashboard-stat-card"><span>Pending approval</span><strong>${stats.pendingAppointments}</strong></article>
        <article class="dashboard-stat-card"><span>Reviews</span><strong>${stats.reviews}</strong></article>
        <article class="dashboard-stat-card"><span>Contact messages</span><strong>${stats.messages}</strong></article>
      </div>

      <div class="dashboard-grid">
        <section class="dashboard-panel">
          <div class="dashboard-panel-head">
            <h2>Appointments</h2>
            <p>Update booking progress and keep the queue organized.</p>
          </div>
          <div class="dashboard-list">
            ${appointments
              .map(
                (item) => `
                  <article class="dashboard-card">
                    <div class="dashboard-card-top">
                      <div>
                        <h3>${item.name}</h3>
                        <p>${item.service}</p>
                      </div>
                      <span class="status-badge ${appointmentStatusBadge(item.status || "Pending approval")}">${item.status || "Pending approval"}</span>
                    </div>
                    <p class="dashboard-meta">${item.date} at ${item.time} | ${item.contact}</p>
                    <p class="dashboard-notes">${item.notes || "No notes provided."}</p>
                    <div class="dashboard-select-wrap">
                      <span style="display:block; margin-bottom: 0.45rem; font-weight:700; color:var(--text); font-size:0.95rem;">Update status</span>
                      <div class="aesthetic-select-wrapper">
                        <select data-appointment-status data-id="${item._id}">
                          <option value="Pending approval" ${item.status === "Pending approval" ? "selected" : ""}>Pending approval</option>
                          <option value="Confirmed" ${item.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                          <option value="Completed" ${item.status === "Completed" ? "selected" : ""}>Completed</option>
                          <option value="Cancelled" ${item.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                        </select>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"></path></svg>
                      </div>
                    </div>
                  </article>
                `
              )
              .join("") || '<div class="empty-state visible">No appointments saved yet.</div>'}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="dashboard-panel-head">
            <h2>Contact inbox</h2>
            <p>Recent inquiries from guests.</p>
          </div>
          <div class="dashboard-list compact">
            ${messages
              .map(
                (item) => `
                  <article class="dashboard-card">
                    <div class="dashboard-card-top">
                      <div>
                        <h3>${item.name}</h3>
                        <p>${item.email}</p>
                      </div>
                      <span class="dashboard-time">${formatDateTime(item.createdAt)}</span>
                    </div>
                    <p class="dashboard-meta">${item.phone}</p>
                    <p class="dashboard-notes">${item.message}</p>
                  </article>
                `
              )
              .join("") || '<div class="empty-state visible">No contact messages yet.</div>'}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="dashboard-panel-head">
            <h2>Latest reviews</h2>
            <p>Guest feedback collected from the website.</p>
          </div>
          <div class="dashboard-list compact">
            ${reviews
              .map(
                (item) => `
                  <article class="dashboard-card">
                    <div class="dashboard-card-top">
                      <div>
                        <h3>${item.name}</h3>
                        <p>${item.visit}</p>
                      </div>
                      <span class="status-badge status-confirmed">${"★".repeat(item.rating)}</span>
                    </div>
                    <p class="dashboard-notes">${item.message}</p>
                  </article>
                `
              )
              .join("") || '<div class="empty-state visible">No reviews yet.</div>'}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="dashboard-panel-head">
            <h2>Accounts</h2>
            <p>Registered users with role visibility.</p>
          </div>
          <div class="dashboard-list compact">
            ${users
              .map(
                (item) => `
                  <article class="dashboard-card">
                    <div class="dashboard-card-top">
                      <div>
                        <h3>${item.name}</h3>
                        <p>${item.email}</p>
                      </div>
                      <span class="status-badge ${item.role === "admin" ? "status-confirmed" : "status-pending"}">${item.role}</span>
                    </div>
                    <p class="dashboard-meta">Joined ${formatDateTime(item.createdAt)}</p>
                  </article>
                `
              )
              .join("") || '<div class="empty-state visible">No user accounts yet.</div>'}
          </div>
        </section>
      </div>
    </section>
  `;

  dashboardRoot.querySelectorAll("[data-appointment-status]").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const { id } = target.dataset;

      try {
        await updateAppointmentStatus(id, target.value);
        showAuthMessage(dashboardMessage, "Appointment status updated.");
        await loadAdminDashboard();
      } catch (error) {
        showAuthMessage(dashboardMessage, error.message || "Could not update appointment status.");
      }
    });
  });
}

async function loadAdminDashboard() {
  if (!dashboardRoot) {
    return;
  }

  const auth = getStoredAuth();
  if (!auth?.token) {
    window.location.href = "login.html";
    return;
  }

  if (auth.user?.role !== "admin") {
    dashboardRoot.innerHTML = '<div class="empty-state visible">This area is for admin users only.</div>';
    return;
  }

  try {
    const data = await authRequestJson(authApiUrl("/api/admin/dashboard"));
    renderAdminDashboard(data);
    showAuthMessage(dashboardMessage, "Dashboard connected to MongoDB.", true);
  } catch (error) {
    if (error.message.includes("session") || error.message.includes("log in")) {
      clearStoredAuth();
      renderAuthSlot();
      window.location.href = "login.html";
      return;
    }

    dashboardRoot.innerHTML = '<div class="empty-state visible">We could not load the admin dashboard right now.</div>';
    showAuthMessage(dashboardMessage, error.message || "Dashboard failed to load.");
  }
}

function requireLoginForFeatures() {
  const auth = getStoredAuth();
  const path = window.location.pathname;

  if (!auth?.user) {
    if (path.endsWith("booking.html")) {
      window.location.href = "login.html";
      return;
    }

    if (path.endsWith("testimonials.html")) {
      const reviewForm = document.querySelector("[data-review-form]");
      if (reviewForm) {
        reviewForm.innerHTML = '<div class="empty-state visible" style="margin-top:1rem;">Please <a href="login.html" style="text-decoration:underline;">sign in</a> to share your experience.</div>';
      }
    }
  }
}

requireLoginForFeatures();
renderAuthSlot();
loadAdminDashboard();
