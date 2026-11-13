
import express from "express";
import { randomBytes } from "node:crypto";
import pool from "../db.js";
import {
  authenticateToken,
  requireCustomer,
  requireTechnician
} from "../middleware/auth.js";

const router = express.Router();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --------------------------------------------------
// CUSTOMER: Create a booking
// --------------------------------------------------

router.post("/", authenticateToken, requireCustomer, async (req, res) => {
  const { serviceId, address, scheduledAt, notes } = req.body;

  if (!serviceId || !address || !scheduledAt) {
    return res.status(400).json({
      success: false,
      message: "Service, address and scheduled date are required"
    });
  }

  if (!uuidPattern.test(String(serviceId))) {
    return res.status(400).json({
      success: false,
      message: "Invalid service ID"
    });
  }

  const bookingDate = new Date(scheduledAt);

  if (Number.isNaN(bookingDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking date"
    });
  }

  if (String(address).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: "Please enter a complete address"
    });
  }

  try {
    const customer = await pool.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'customer'
         AND is_active = TRUE`,
      [req.user.userId]
    );

    if (!customer.rows.length) {
      return res.status(403).json({
        success: false,
        message: "Active customer account not found"
      });
    }

    const service = await pool.query(
      `SELECT s.id, s.base_price
       FROM services s
       JOIN service_categories c ON c.id = s.category_id
       WHERE s.id = $1
         AND s.is_active = TRUE
         AND c.is_active = TRUE`,
      [serviceId]
    );

    if (!service.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Selected service is unavailable"
      });
    }

    const amount = service.rows[0].base_price ?? 0;

    const bookingNumber =
      "CF-" +
      Date.now() +
      "-" +
      randomBytes(3).toString("hex").toUpperCase();

    const result = await pool.query(
      `INSERT INTO bookings
       (booking_number, customer_id, service_id, address,
        scheduled_at, amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        bookingNumber,
        req.user.userId,
        serviceId,
        String(address).trim(),
        bookingDate,
        amount,
        notes ? String(notes).trim() : null
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: result.rows[0]
    });
  } catch (error) {
    console.error("Create booking error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking"
    });
  }
});

// --------------------------------------------------
// CUSTOMER: Get own bookings with technician details
// --------------------------------------------------

router.get("/my", authenticateToken, requireCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         b.*,
         s.name AS service_name,
         t.full_name AS technician_name,
         t.phone AS technician_phone
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN users t
         ON t.id = b.technician_id
         AND t.role = 'technician'
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows
    });
  } catch (error) {
    console.error("Get customer bookings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load bookings"
    });
  }
});

// --------------------------------------------------
// TECHNICIAN: Get available unassigned bookings
// --------------------------------------------------

router.get(
  "/technician/available",
  authenticateToken,
  requireTechnician,
  async (req, res) => {
    try {
      const technician = await pool.query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND role = 'technician'
           AND is_active = TRUE`,
        [req.user.userId]
      );

      if (!technician.rows.length) {
        return res.status(403).json({
          success: false,
          message: "Active technician account not found"
        });
      }

      const result = await pool.query(
        `SELECT
           b.id,
           b.booking_number,
           b.customer_id,
           b.service_id,
           b.address,
           b.scheduled_at,
           b.amount,
           b.status,
           b.notes,
           b.created_at,
           s.name AS service_name,
           u.full_name AS customer_name,
           u.phone AS customer_phone
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         JOIN users u ON u.id = b.customer_id
         WHERE b.technician_id IS NULL
           AND b.status IN ('pending', 'confirmed')
         ORDER BY b.scheduled_at ASC`
      );

      return res.json({
        success: true,
        count: result.rows.length,
        bookings: result.rows
      });
    } catch (error) {
      console.error("Available technician bookings error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load available bookings"
      });
    }
  }
);

// --------------------------------------------------
// TECHNICIAN: Get bookings assigned to this technician
// --------------------------------------------------

router.get(
  "/technician/my",
  authenticateToken,
  requireTechnician,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           b.*,
           s.name AS service_name,
           u.full_name AS customer_name,
           u.phone AS customer_phone
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         JOIN users u ON u.id = b.customer_id
         WHERE b.technician_id = $1
         ORDER BY b.scheduled_at DESC`,
        [req.user.userId]
      );

      return res.json({
        success: true,
        count: result.rows.length,
        bookings: result.rows
      });
    } catch (error) {
      console.error("Technician bookings error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load your bookings"
      });
    }
  }
);

// --------------------------------------------------
// TECHNICIAN: Accept an available booking
// --------------------------------------------------

router.post(
  "/:bookingId/accept",
  authenticateToken,
  requireTechnician,
  async (req, res) => {
    const { bookingId } = req.params;

    if (!uuidPattern.test(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const technician = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND role = 'technician'
           AND is_active = TRUE`,
        [req.user.userId]
      );

      if (!technician.rows.length) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          success: false,
          message: "Active technician account not found"
        });
      }

      const result = await client.query(
        `UPDATE bookings
         SET technician_id = $1,
             status = 'assigned',
             updated_at = NOW()
         WHERE id = $2
           AND technician_id IS NULL
           AND status IN ('pending', 'confirmed')
         RETURNING *`,
        [req.user.userId, bookingId]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "This booking is no longer available"
        });
      }

      await client.query(
        `INSERT INTO booking_status_history
         (booking_id, status, changed_by, notes)
         VALUES ($1, 'assigned', $2, $3)`,
        [
          bookingId,
          req.user.userId,
          "Booking accepted by technician"
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Booking accepted successfully",
        booking: result.rows[0]
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Accept booking error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to accept booking"
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// TECHNICIAN: Update job status
// --------------------------------------------------

router.patch(
  "/:bookingId/status",
  authenticateToken,
  requireTechnician,
  async (req, res) => {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!uuidPattern.test(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    if (!["in_progress", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job status"
      });
    }

    const previousStatus =
      status === "in_progress" ? "assigned" : "in_progress";

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE bookings
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
           AND technician_id = $3
           AND status = $4
         RETURNING *`,
        [
          status,
          bookingId,
          req.user.userId,
          previousStatus
        ]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message:
            "Booking not found, not assigned to you, or status transition is not allowed"
        });
      }

      await client.query(
        `INSERT INTO booking_status_history
         (booking_id, status, changed_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          bookingId,
          status,
          req.user.userId,
          status === "completed"
            ? "Service completed by technician"
            : "Technician started the service"
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Booking status updated successfully",
        booking: result.rows[0]
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Update booking status error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to update booking status"
      });
    } finally {
      client.release();
    }
  }
);

export default router;
