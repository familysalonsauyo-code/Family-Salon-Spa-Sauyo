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

