import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

const adminOnly = [authenticateToken, requireAdmin];

// ADMIN LOGIN
router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash, is_active
       FROM users
       WHERE LOWER(email) = $1
       AND role = 'admin'
       LIMIT 1`,
      [email]
    );

    const admin = result.rows[0];

    if (!admin || admin.is_active === false || !admin.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password"
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password"
      });
    }

    const token = jwt.sign(
      {
        userId: admin.id,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.full_name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to log in"
    });
  }
});

// VERIFY ADMIN SESSION
router.get("/me", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE id = $1 AND role = 'admin' AND is_active = TRUE`,
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: "Admin account is no longer active"
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Admin session error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to verify admin session"
    });
  }
});

// DASHBOARD STATISTICS
router.get("/dashboard", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_bookings,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'confirmed')
        )::int AS waiting_bookings,
        COUNT(*) FILTER (
          WHERE status = 'assigned'
        )::int AS assigned_bookings,
        COUNT(*) FILTER (
          WHERE status = 'in_progress'
        )::int AS ongoing_bookings,
        COUNT(*) FILTER (
          WHERE status = 'completed'
        )::int AS completed_bookings,
        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::int AS cancelled_bookings,
        COALESCE(
          SUM(amount) FILTER (WHERE status = 'completed'),
          0
        )::numeric AS completed_booking_value,
        COUNT(*) FILTER (
          WHERE scheduled_at::date = CURRENT_DATE
        )::int AS today_bookings
      FROM bookings
    `);

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*)::int FROM users WHERE role = 'technician') AS technicians,
        (SELECT COUNT(*)::int FROM services WHERE is_active = TRUE) AS active_services
    `);

    res.json({
      success: true,
      bookings: result.rows[0],
      business: counts.rows[0]
    });
  } catch (error) {
    console.error("Admin dashboard error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load dashboard"
    });
  }
});

// ALL BOOKINGS
router.get("/bookings", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.*,
        s.name AS service_name,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        t.full_name AS technician_name,
        t.phone AS technician_phone
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      JOIN users c ON c.id = b.customer_id
      LEFT JOIN users t
        ON t.id = b.technician_id
        AND t.role = 'technician'
      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error("Admin bookings error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load bookings"
    });
  }
});

// ALL CUSTOMERS
router.get("/customers", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.phone,
        u.email,
        u.is_active,
        u.created_at,
        COUNT(b.id)::int AS total_bookings,
        COALESCE(SUM(b.amount), 0)::numeric AS total_booking_value
      FROM users u
      LEFT JOIN bookings b ON b.customer_id = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      customers: result.rows
    });
  } catch (error) {
    console.error("Admin customers error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load customers"
    });
  }
});

// ALL TECHNICIANS
router.get("/technicians", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.phone,
        u.email,
        u.is_active,
        u.created_at,
        tp.skills,
        tp.service_area,
        tp.is_available,
        COUNT(b.id)::int AS total_jobs,
        COUNT(b.id) FILTER (
          WHERE b.status = 'completed'
        )::int AS completed_jobs,
        COUNT(b.id) FILTER (
          WHERE b.status IN ('assigned', 'in_progress')
        )::int AS active_jobs
      FROM users u
      LEFT JOIN technician_profiles tp ON tp.user_id = u.id
      LEFT JOIN bookings b ON b.technician_id = u.id
      WHERE u.role = 'technician'
      GROUP BY u.id, tp.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      technicians: result.rows
    });
  } catch (error) {
    console.error("Admin technicians error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load technicians"
    });
  }
});

// ASSIGN OR REASSIGN TECHNICIAN

// ADD TECHNICIAN
router.post("/technicians", ...adminOnly, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").replace(/[\s()-]/g, "");
  const area = String(req.body.area || "Bengaluru").trim();
  const skills = req.body.skills;

  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      message: "Technician name and phone are required"
    });
  }

  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number with country code"
    });
  }

  if (skills !== undefined && !Array.isArray(skills)) {
    return res.status(400).json({
      success: false,
      message: "Skills must be a list"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM users WHERE phone = $1",
      [phone]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered"
      });
    }

    const userResult = await client.query(
      `INSERT INTO users (full_name, phone, role)
       VALUES ($1, $2, 'technician')
       RETURNING id, full_name, phone, role, is_active`,
      [name, phone]
    );

    const technician = userResult.rows[0];

    await client.query(
      `INSERT INTO technician_profiles
       (user_id, skills, service_area, is_available)
       VALUES ($1, $2, $3, FALSE)`,
      [technician.id, skills || [], area || "Bengaluru"]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Technician added successfully",
      technician
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add technician error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to add technician"
    });
  } finally {
    client.release();
  }
});

// UPDATE TECHNICIAN
router.patch("/technicians/:technicianId", ...adminOnly, async (req, res) => {
  const { technicianId } = req.params;
  const { active, online, area, skills } = req.body;

  if (active !== undefined && typeof active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "Invalid active status"
    });
  }

  if (online !== undefined && typeof online !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "Invalid availability status"
    });
  }

  if (area !== undefined && typeof area !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid service area"
    });
  }

  if (skills !== undefined && !Array.isArray(skills)) {
    return res.status(400).json({
      success: false,
      message: "Skills must be a list"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM users
       WHERE id = $1 AND role = 'technician'
       FOR UPDATE`,
      [technicianId]
    );

    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Technician not found"
      });
    }

    if (active !== undefined) {
      await client.query(
        `UPDATE users
         SET is_active = $1
         WHERE id = $2 AND role = 'technician'`,
        [active, technicianId]
      );
    }

    const nextAvailability =
      active === false ? false : online;

    await client.query(
      `UPDATE technician_profiles
       SET skills = COALESCE($1::text[], skills),
           service_area = COALESCE($2, service_area),
           is_available = COALESCE($3, is_available)
       WHERE user_id = $4`,
      [
        skills === undefined ? null : skills,
        area === undefined ? null : area.trim(),
        nextAvailability === undefined ? null : nextAvailability,
        technicianId
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Technician updated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update technician error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update technician"
    });
  } finally {
    client.release();
  }
});
router.patch("/bookings/:bookingId/assign", ...adminOnly, async (req, res) => {
  const { bookingId } = req.params;
  const technicianId = req.body.technicianId || null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT id, status, technician_id
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingResult.rows[0];

    if (technicianId) {
      const techResult = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND role = 'technician'
           AND is_active = TRUE`,
        [technicianId]
      );

      if (!techResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Active technician not found"
        });
      }
    }

    const nextStatus = technicianId
      ? "assigned"
      : "confirmed";

    await client.query(
      `UPDATE bookings
       SET technician_id = $1,
           status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [technicianId, nextStatus, bookingId]
    );

    await client.query(
      `INSERT INTO booking_status_history
       (booking_id, status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        bookingId,
        nextStatus,
        req.user.userId,
        technicianId
          ? "Technician assigned by admin"
          : "Technician unassigned by admin"
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: technicianId
        ? "Technician assigned successfully"
        : "Technician unassigned successfully",
      status: nextStatus
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin assignment error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update technician assignment"
    });
  } finally {
    client.release();
  }
});

// ADMIN BOOKING STATUS UPDATE
router.patch("/bookings/:bookingId/status", ...adminOnly, async (req, res) => {
  const { bookingId } = req.params;
  const { status, notes = "" } = req.body;

  const allowedStatuses = [
    "pending",
    "confirmed",
    "assigned",
    "in_progress",
    "completed",
    "cancelled"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking status"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT id, status
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (!current.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    await client.query(
      `UPDATE bookings
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [status, bookingId]
    );

    await client.query(
      `INSERT INTO booking_status_history
       (booking_id, status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        bookingId,
        status,
        req.user.userId,
        String(notes || "Status updated by admin")
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Booking status updated",
      status
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin status error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update booking status"
    });
  } finally {
    client.release();
  }
});

// SERVICES AND CATEGORIES
router.get("/services", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        c.name AS category_name
      FROM services s
      LEFT JOIN service_categories c ON c.id = s.category_id
      ORDER BY c.name, s.name
    `);

    res.json({
      success: true,
      services: result.rows
    });
  } catch (error) {
    console.error("Admin services error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load services"
    });
  }
});

// PAYMENTS
router.get("/payments", ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        b.booking_number,
        b.status AS booking_status,
        u.full_name AS customer_name,
        u.phone AS customer_phone,
        s.name AS service_name
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      JOIN users u ON u.id = b.customer_id
      JOIN services s ON s.id = b.service_id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      payments: result.rows
    });
  } catch (error) {
    console.error("Admin payments error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load payments"
    });
  }
});

export default router;