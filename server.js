const crypto = require("crypto");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_NAME = process.env.ADMIN_NAME || "Salon Admin";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@familysalonspasauyo.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const SESSION_TTL_DAYS = 7;
let dbReadyPromise = null;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Add it in your .env file.");
  process.exit(1);
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (
    typeof salt !== "string" ||
    typeof expectedHash !== "string" ||
    !salt.trim() ||
    !expectedHash.trim() ||
    expectedHash.length % 2 !== 0
  ) {
    return false;
  }

  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  const actualBuffer = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

const appointmentSchema = new mongoose.Schema(
  {
    service: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: String, required: true, trim: true, maxlength: 40 },
    time: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    contact: { type: String, required: true, trim: true, maxlength: 160 },
    notes: { type: String, default: "", trim: true, maxlength: 1200 },
    approvalRequested: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Pending approval", "Confirmed", "Completed", "Cancelled"],
      default: "Confirmed"
    }
  },
  { timestamps: true }
);

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    visit: { type: String, required: true, trim: true, maxlength: 160 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true, trim: true, maxlength: 1500 }
  },
  { timestamps: true }
);

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 180 },
    phone: { type: String, required: true, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, maxlength: 180 },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ["admin", "customer"], default: "customer" }
  },
  { timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Appointment = mongoose.model("Appointment", appointmentSchema);
const Review = mongoose.model("Review", reviewSchema);
const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
const User = mongoose.model("User", userSchema);
const Session = mongoose.model("Session", sessionSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

    if (!token) {
      res.status(401).json({ error: "Please log in first." });
      return;
    }

    const session = await Session.findOne({
      token,
      expiresAt: { $gt: new Date() }
    })
      .populate("user")
      .lean();

    if (!session?.user) {
      res.status(401).json({ error: "Your session has expired. Please log in again." });
      return;
    }

    req.authToken = token;
    req.user = session.user;
    next();
  } catch (_error) {
    res.status(500).json({ error: "Authentication failed. Please try again." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }

  next();
}

async function createSessionForUser(user) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    token,
    user: user._id,
    expiresAt
  });

  return {
    token,
    expiresAt,
    user: sanitizeUser(user)
  };
}

async function ensureDefaultAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  const passwordData = createPasswordHash(ADMIN_PASSWORD);

  if (!existing) {
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      role: "admin"
    });
    console.log(`Created default admin account for ${ADMIN_EMAIL}`);
    return;
  }

  let updated = false;

  if (existing.name !== ADMIN_NAME) {
    existing.name = ADMIN_NAME;
    updated = true;
  }

  if (existing.role !== "admin") {
    existing.role = "admin";
    updated = true;
  }

  const hasValidPasswordFields =
    typeof existing.passwordHash === "string" &&
    typeof existing.passwordSalt === "string" &&
    existing.passwordHash.trim() &&
    existing.passwordSalt.trim();

  if (!hasValidPasswordFields) {
    existing.passwordHash = passwordData.hash;
    existing.passwordSalt = passwordData.salt;
    updated = true;
  }

  if (updated) {
    await existing.save();
    console.log(`Synchronized default admin account for ${ADMIN_EMAIL}`);
  }
}

app.get("/api/health", async (_req, res) => {
  let collections = [];

  const isConnected = mongoose.connection.readyState === 1;

  if (isConnected) {
    try {
      collections = await mongoose.connection.db.listCollections().toArray();
    } catch (_error) {
      collections = [];
    }
  }

  res.json({
    ok: true,
    database: isConnected ? "connected" : "disconnected",
    dbName: mongoose.connection?.name || null,
    collections: collections.map((item) => item.name),
    adminEmail: ADMIN_EMAIL
  });
});

app.use("/api", async (req, res, next) => {
  if (req.path.startsWith("/health")) {
    return next();
  }

  try {
    await ensureDatabaseReady();
    next();
  } catch (error) {
    console.error("API database initialization failed:", error.message);
    res.status(503).json({
      error: "Database connection is not ready. Check your Vercel environment variables and MongoDB network access."
    });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 8) {
      res.status(400).json({ error: "Enter your name, a valid email, and a password with at least 8 characters." });
      return;
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      res.status(409).json({ error: "That email is already registered. Please log in instead." });
      return;
    }

    const passwordData = createPasswordHash(password);
    const user = await User.create({
      name,
      email,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      role: "customer"
    });

    const session = await createSessionForUser(user);
    res.status(201).json(session);
  } catch (_error) {
    res.status(400).json({ error: "We could not create your account right now." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    const session = await createSessionForUser(user);
    res.json(session);
  } catch (_error) {
    res.status(500).json({ error: "We could not log you in right now." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const freshUser = await User.findById(req.user._id).lean();
    res.json({ user: sanitizeUser(freshUser) });
  } catch (_error) {
    res.status(500).json({ error: "Could not load your account." });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await Session.deleteOne({ token: req.authToken });
  res.json({ ok: true });
});

app.get("/api/appointments", async (_req, res) => {
  try {
    const items = await Appointment.find().sort({ createdAt: -1 }).limit(30).lean();
    res.json({ items });
  } catch (_error) {
    res.status(500).json({ error: "Failed to load appointments." });
  }
});

app.post("/api/appointments", requireAuth, async (req, res) => {
  try {
    const approvalRequested = Boolean(req.body.approval);
    const payload = {
      service: req.body.service,
      date: req.body.date,
      time: req.body.time,
      name: req.body.name,
      contact: req.body.contact,
      notes: req.body.notes || "",
      approvalRequested,
      status: approvalRequested ? "Pending approval" : "Confirmed"
    };
    const saved = await Appointment.create(payload);
    res.status(201).json({ item: saved });
  } catch (_error) {
    res.status(400).json({ error: "Invalid booking data." });
  }
});

app.get("/api/reviews", async (_req, res) => {
  try {
    const items = await Review.find().sort({ createdAt: -1 }).limit(60).lean();
    res.json({ items });
  } catch (_error) {
    res.status(500).json({ error: "Failed to load reviews." });
  }
});

app.post("/api/reviews", requireAuth, async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      visit: req.body.visit,
      rating: Number(req.body.rating),
      message: req.body.message
    };
    const saved = await Review.create(payload);
    res.status(201).json({ item: saved });
  } catch (_error) {
    res.status(400).json({ error: "Invalid review data." });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      message: req.body.message
    };
    await ContactMessage.create(payload);
    res.status(201).json({ ok: true });
  } catch (_error) {
    res.status(400).json({ error: "Invalid contact form data." });
  }
});

app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [appointments, reviews, messages, users] = await Promise.all([
      Appointment.find().sort({ createdAt: -1 }).limit(50).lean(),
      Review.find().sort({ createdAt: -1 }).limit(30).lean(),
      ContactMessage.find().sort({ createdAt: -1 }).limit(30).lean(),
      User.find().sort({ createdAt: -1 }).limit(50).lean()
    ]);

    const stats = {
      appointments: await Appointment.countDocuments(),
      pendingAppointments: await Appointment.countDocuments({ status: "Pending approval" }),
      reviews: await Review.countDocuments(),
      messages: await ContactMessage.countDocuments(),
      users: await User.countDocuments()
    };

    res.json({
      stats,
      appointments,
      reviews,
      messages,
      users: users.map((user) => sanitizeUser(user))
    });
  } catch (_error) {
    res.status(500).json({ error: "Failed to load admin dashboard." });
  }
});

app.patch("/api/admin/appointments/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || "");
    const allowedStatuses = ["Pending approval", "Confirmed", "Completed", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid appointment status." });
      return;
    }

    const item = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!item) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }

    res.json({ item });
  } catch (_error) {
    res.status(400).json({ error: "We could not update that appointment." });
  }
});

app.get("*", (req, res) => {
  const requestedPath = req.path === "/" ? "/index.html" : req.path;
  const absolute = path.join(__dirname, requestedPath);
  res.sendFile(absolute, (error) => {
    if (error) {
      res.status(404).sendFile(path.join(__dirname, "index.html"));
    }
  });
});

async function ensureDatabaseReady() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      await mongoose.connect(MONGODB_URI, { autoIndex: true });
      await ensureDefaultAdmin();
    })().catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }

  await dbReadyPromise;
}

// Connect to MongoDB
ensureDatabaseReady().catch((error) => {
  console.error("MongoDB connection failed:", error.message);
});

// If not running on Vercel, listen on PORT
if (process.env.NODE_ENV !== "production") {
  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the existing process or change PORT in .env.`);
      return;
    }
    console.error("Server failed to start:", error.message);
  });
}

module.exports = app;
