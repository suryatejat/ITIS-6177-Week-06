const express = require("express");
const app = express();
const port = 3000;
const mariadb = require("mariadb");
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { body, param, validationResult } = require('express-validator');

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'sample',
  port: 3306,
  connectionsLimit: 100,
  acquireTimeout: 30000,
});

app.use(express.json());

// Middleware to handle database connection
app.use(async (req, res, next) => {
  try {
    req.db = await pool.getConnection();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sample API',
      version: '1.0.0',
      description: 'A sample API for managing customers, foods, and orders',
    },
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api/foods:
 *   post:
 *     summary: Create a new food item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *               - itemName
 *               - itemUnit
 *             properties:
 *               itemId:
 *                 type: string
 *               itemName:
 *                 type: string
 *               itemUnit:
 *                 type: string
 *     responses:
 *       201:
 *         description: Food item created successfully
 *       400:
 *         description: Invalid input
 */
app.post('/api/foods', [
  body('itemId').isLength({ min: 1, max: 6 }).withMessage('Item ID must be between 1 and 6 characters long'),
  body('itemName').trim().isLength({ min: 1, max: 25 }).escape(),
  body('itemUnit').trim().isLength({ min: 1, max: 5 }).escape(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { itemId, itemName, itemUnit, companyId } = req.body;

  try {
    await req.db.query(
      'INSERT INTO foods (ITEM_ID, ITEM_NAME, ITEM_UNIT) VALUES (?, ?, ?)',
      [itemId, itemName, itemUnit, companyId]
    );
    res.status(201).json({ message: 'Food item created successfully' });
  } catch (err) {
    console.error('Error creating food item:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/foods/{itemId}:
 *   patch:
 *     summary: Update a food item's name or unit
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemName:
 *                 type: string
 *               itemUnit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Food item updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Food item not found
 */
app.patch('/api/foods/:itemId', [
  param('itemId').isLength({ min: 1, max: 6 }).withMessage('Item ID must be between 1 and 6 characters long'),
  body('itemName').optional().trim().isLength({ min: 1, max: 25 }).escape(),
  body('itemUnit').optional().trim().isLength({ min: 1, max: 5 }).escape(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { itemId } = req.params;
  const { itemName, itemUnit } = req.body;

  if (!itemName && !itemUnit) {
    return res.status(400).json({ error: 'At least one field (itemName or itemUnit) must be provided' });
  }

  try {
    let query = 'UPDATE foods SET ';
    const updateFields = [];
    const values = [];

    if (itemName) {
      updateFields.push('ITEM_NAME = ?');
      values.push(itemName);
    }
    if (itemUnit) {
      updateFields.push('ITEM_UNIT = ?');
      values.push(itemUnit);
    }

    query += updateFields.join(', ') + ' WHERE ITEM_ID = ?';
    values.push(itemId);

    const result = await req.db.query(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    res.json({ message: 'Food item updated successfully' });
  } catch (err) {
    console.error('Error updating food item:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/foods/{itemId}:
 *   put:
 *     summary: Update or create a food item
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemName
 *               - itemUnit
 *             properties:
 *               itemName:
 *                 type: string
 *               itemUnit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Food item updated successfully
 *       201:
 *         description: Food item created successfully
 *       400:
 *         description: Invalid input
 */
app.put('/api/foods/:itemId', [
  param('itemId').isLength({ min: 1, max: 6 }).withMessage('Item ID must be between 1 and 6 characters long'),
  body('itemName').trim().isLength({ min: 1, max: 25 }).escape(),
  body('itemUnit').trim().isLength({ min: 1, max: 5 }).escape(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { itemId } = req.params;
  const { itemName, itemUnit, companyId } = req.body;

  try {
    const result = await req.db.query(
      'INSERT INTO foods (ITEM_ID, ITEM_NAME, ITEM_UNIT) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ITEM_NAME = ?, ITEM_UNIT = ?',
      [itemId, itemName, itemUnit, companyId, itemName, itemUnit, companyId]
    );
    if (result.affectedRows === 1 && result.warningStatus === 0) {
      res.status(201).json({ message: 'Food item created successfully' });
    } else {
      res.json({ message: 'Food item updated successfully' });
    }
  } catch (err) {
    console.error('Error updating/creating food item:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Retrieve a list of customer names
 *     responses:
 *       200:
 *         description: A list of customer names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customerList:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/customers', async (req, res) => {
  try {
    const rows = await req.db.query('SELECT CUST_NAME FROM customer');
    const customerNames = rows.map(row => row.CUST_NAME);
    res.json({ customerList: customerNames });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Retrieve a list of student names
 *     responses:
 *       200:
 *         description: A list of student names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 studentList:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/students', async (req, res) => {
  try {
    const rows = await req.db.query('SELECT NAME FROM student');
    const studentNames = rows.map(row => row.ITEM_NAME);
    res.json({ studentList: studentNames });
  } catch (err) {
    console.error('Error fetching Students:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/foods:
 *   get:
 *     summary: Retrieve a list of food item names
 *     responses:
 *       200:
 *         description: A list of food item names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 foodList:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/foods', async (req, res) => {
  try {
    const rows = await req.db.query('SELECT ITEM_NAME FROM foods');
    const customerNames = rows.map(row => row.ITEM_NAME);
    res.json({ foodList: customerNames });
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

/**
 * @swagger
 * /api/customers/{custCode}:
 *   delete:
 *     summary: Delete a customer
 *     parameters:
 *       - in: path
 *         name: custCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *       404:
 *         description: Customer not found
 */
app.delete('/api/customers/:custCode', [
  param('custCode').isLength({ min: 6, max: 6 }).withMessage('Customer code must be 6 characters long'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { custCode } = req.params;

  try {
    const result = await req.db.query('DELETE FROM customer WHERE CUST_CODE = ?', [custCode]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    req.db.release();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
});