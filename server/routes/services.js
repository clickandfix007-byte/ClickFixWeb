
import express from "express";
import pool from "../db.js";

const router = express.Router();

// Get all active service categories
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug
      FROM service_categories
      WHERE is_active = TRUE
      ORDER BY name
    `);

    res.json({
      success: true,
      count: result.rows.length,
      categories: result.rows
    });
  } catch (error) {
    console.error("Categories API:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load categories"
    });
  }
});

// Get all active services
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.slug,
        s.description,
        s.base_price,
        c.name AS category_name,
        c.slug AS category_slug
      FROM services s
      LEFT JOIN service_categories c
        ON c.id = s.category_id
      WHERE s.is_active = TRUE
        AND c.is_active = TRUE
      ORDER BY c.name, s.name
    `);

    res.json({
      success: true,
      count: result.rows.length,
      services: result.rows
    });
  } catch (error) {
    console.error("Services API:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load services"
    });
  }
});

export default router;
