const navToggle = document.querySelector("[data-nav-toggle]");
const header = document.querySelector(".site-header");

if (navToggle && header) {
  navToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("nav-active");
    document.body.classList.toggle("nav-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".site-nav a, .nav-cta a").forEach((link) => {
  link.addEventListener("click", () => {
    if (header?.classList.contains("nav-active")) {
      header.classList.remove("nav-active");
      document.body.classList.remove("nav-open");
      navToggle?.setAttribute("aria-expanded", "false");
    }
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".animate-in").forEach((item) => observer.observe(item));

const services = {
  "Signature Haircut": { price: "PHP 950", duration: "60 min" },
  "Luxury Color Refresh": { price: "PHP 3,200", duration: "150 min" },
  "Keratin Repair Ritual": { price: "PHP 2,800", duration: "120 min" },
  "Botanical Hair Spa": { price: "PHP 1,600", duration: "75 min" },
  "Soft Glam Makeup": { price: "PHP 2,500", duration: "90 min" },
  "Signature Mani-Pedi": { price: "PHP 1,350", duration: "80 min" }
};

const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE =
  window.location.protocol === "file:" || (isLocalHost && window.location.port !== "3000")
    ? "http://localhost:3000"
    : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function requestJson(url, options = {}) {
  let storedAuth = null;
  try {
    storedAuth = JSON.parse(localStorage.getItem("familySalonAuth") || "null");
  } catch (_e) {}

  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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
    throw new Error(
      "Cannot reach the booking server. Run npm.cmd start, then open http://localhost:3000."
    );
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = data.error || "Request failed.";
    throw new Error(message);
  }

  return data;
}

const bookingForm = document.querySelector("[data-booking-form]");
const bookingMessage = document.querySelector("[data-booking-message]");
const appointmentsContainer = document.querySelector("[data-appointments]");
const appointmentEmpty = document.querySelector("[data-appointments-empty]");
const serviceSelect = document.querySelector("[data-service-select]");
const bookingSummary = document.querySelector("[data-booking-summary]");

function updateBookingSummary() {
  if (!serviceSelect || !bookingSummary) {
    return;
  }

  const service = services[serviceSelect.value];
  bookingSummary.textContent = service
    ? `${serviceSelect.value} | ${service.duration} | ${service.price}`
    : "Select a service to preview duration and price.";
}

function renderAppointments(items = []) {
  if (!appointmentsContainer || !appointmentEmpty) {
    return;
  }

  appointmentsContainer.innerHTML = "";

  if (!items.length) {
    appointmentEmpty.classList.add("visible");
    return;
  }

  appointmentEmpty.classList.remove("visible");

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "appointment-item";
    card.innerHTML = `
      <strong>${item.name}</strong>
      <span>${item.service}</span><br>
      <span>${item.date} at ${item.time}</span><br>
      <span>${item.contact}</span>
    `;
    appointmentsContainer.appendChild(card);
  });
}

async function loadAppointments() {
  if (!appointmentsContainer) {
    return;
  }
  try {
    const data = await requestJson(apiUrl("/api/appointments"));
    renderAppointments(data.items || []);
  } catch {
    renderAppointments([]);
  }
}

if (serviceSelect) {
  serviceSelect.addEventListener("change", updateBookingSummary);
  updateBookingSummary();
}

if (bookingForm) {
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const payload = {
      service: formData.get("service"),
      date: formData.get("date"),
      time: formData.get("time"),
      name: formData.get("name"),
      contact: formData.get("contact"),
      notes: formData.get("notes"),
      approval: Boolean(formData.get("approval"))
    };

    try {
      const data = await requestJson(apiUrl("/api/appointments"), {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const saved = data.item;
      if (bookingMessage) {
        bookingMessage.textContent = `${saved.name}, your ${saved.service} appointment for ${saved.date} at ${saved.time} is reserved. Status: ${saved.status}.`;
        bookingMessage.classList.add("visible");
      }
      bookingForm.reset();
      updateBookingSummary();
      loadAppointments();
    } catch (error) {
      if (bookingMessage) {
        bookingMessage.textContent = error.message || "We could not save your booking right now.";
        bookingMessage.classList.add("visible");
      }
    }
  });
}

loadAppointments();

const reviewForm = document.querySelector("[data-review-form]");
const reviewList = document.querySelector("[data-review-list]");
const reviewMessage = document.querySelector("[data-review-message]");

function renderReviews(items = []) {
  if (!reviewList) {
    return;
  }

  const existingDynamic = reviewList.querySelectorAll("[data-dynamic-review]");
  existingDynamic.forEach((item) => item.remove());

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "testimonial-card animate-in visible";
    article.setAttribute("data-dynamic-review", "true");
    article.innerHTML = `
      <div class="stars" aria-label="${item.rating} out of 5 stars">${"★".repeat(item.rating)}<span style="opacity: 0.25">${"★".repeat(5 - item.rating)}</span></div>
      <p>${item.message}</p>
      <h3>${item.name}</h3>
      <p class="muted">${item.visit}</p>
    `;
    reviewList.appendChild(article);
  });
}

async function loadReviews() {
  if (!reviewList) {
    return;
  }
  try {
    const data = await requestJson(apiUrl("/api/reviews"));
    renderReviews(data.items || []);
  } catch {
    renderReviews([]);
  }
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(reviewForm);
    const payload = {
      name: formData.get("name"),
      visit: formData.get("visit"),
      rating: Number(formData.get("rating")),
      message: formData.get("message")
    };

    try {
      await requestJson(apiUrl("/api/reviews"), {
        method: "POST",
        body: JSON.stringify(payload)
      });
      reviewForm.reset();
      loadReviews();
      if (reviewMessage) {
        reviewMessage.textContent = "Thank you. Your review has been added to the guest wall.";
        reviewMessage.classList.add("visible");
      }
    } catch (error) {
      if (reviewMessage) {
        reviewMessage.textContent = error.message || "We could not save your review right now.";
        reviewMessage.classList.add("visible");
      }
    }
  });
}

loadReviews();

const contactForm = document.querySelector("[data-contact-form]");
const contactMessage = document.querySelector("[data-contact-message]");

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      message: formData.get("message")
    };

    try {
      await requestJson(apiUrl("/api/contact"), {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (contactMessage) {
        contactMessage.textContent = `${payload.name}, thank you for reaching out. Our team will reply within one business day.`;
        contactMessage.classList.add("visible");
      }
      contactForm.reset();
    } catch (error) {
      if (contactMessage) {
        contactMessage.textContent = error.message || "We could not send your message right now.";
        contactMessage.classList.add("visible");
      }
    }
  });
}

document.querySelectorAll(".password-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = toggle.previousElementSibling;
    const type = input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);

    const svg = toggle.querySelector("svg");
    if (type === "text") {
      svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
      svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  });
});
