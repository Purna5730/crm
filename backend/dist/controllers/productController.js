"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockMovements = exports.addStockMovement = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProduct = exports.getProducts = exports.productValidation = void 0;
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
exports.productValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Product name is required'),
    (0, express_validator_1.body)('sku').notEmpty().withMessage('SKU is required'),
    (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('unit_price').isFloat({ min: 0 }).withMessage('Valid unit price required'),
    (0, express_validator_1.body)('current_stock').isInt({ min: 0 }).withMessage('Valid stock quantity required'),
    (0, express_validator_1.body)('min_stock_alert').isInt({ min: 0 }).withMessage('Valid min stock alert required'),
];
const getProducts = async (req, res) => {
    try {
        const search = req.query.search || '';
        const query = search
            ? `SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? OR category LIKE ? OR location LIKE ? ORDER BY created_at DESC`
            : `SELECT * FROM products ORDER BY created_at DESC`;
        const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];
        const [rows] = await db_1.default.query(query, params);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.getProducts = getProducts;
const getProduct = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        const [movements] = await db_1.default.query(`SELECT sm.*, p.name as product_name FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       WHERE sm.product_id = ? ORDER BY sm.created_at DESC`, [req.params.id]);
        res.json({ ...rows[0], movements });
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.getProduct = getProduct;
const createProduct = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = req.body;
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(`INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES (?,?,?,?,?,?,?)`, [name, sku, category, unit_price, current_stock, min_stock_alert, location || null]);
        const productId = result.insertId;
        if (Number(current_stock) > 0) {
            const [user] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
            await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [productId, current_stock, 'IN', 'Initial stock', user[0]?.name || 'System']);
        }
        await conn.commit();
        res.status(201).json({ id: productId, message: 'Product created' });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, sku, category, unit_price, min_stock_alert, location } = req.body;
    try {
        const [result] = await db_1.default.execute(`UPDATE products SET name=?, sku=?, category=?, unit_price=?, min_stock_alert=?, location=? WHERE id=?`, [name, sku, category, unit_price, min_stock_alert, location || null, req.params.id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.json({ message: 'Product updated' });
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const [result] = await db_1.default.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.json({ message: 'Product deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.deleteProduct = deleteProduct;
const addStockMovement = async (req, res) => {
    const { quantity, movement_type, reason } = req.body;
    if (!quantity || !movement_type) {
        res.status(400).json({ message: 'Quantity and movement type required' });
        return;
    }
    if (!['IN', 'OUT'].includes(movement_type)) {
        res.status(400).json({ message: 'Movement type must be IN or OUT' });
        return;
    }
    if (Number(quantity) <= 0) {
        res.status(400).json({ message: 'Quantity must be greater than 0' });
        return;
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        const currentStock = rows[0].current_stock;
        if (movement_type === 'OUT' && currentStock < Number(quantity)) {
            res.status(400).json({ message: `Insufficient stock. Available: ${currentStock}` });
            await conn.rollback();
            return;
        }
        const newStock = movement_type === 'IN' ? currentStock + Number(quantity) : currentStock - Number(quantity);
        await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, req.params.id]);
        const [user] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
        await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [req.params.id, quantity, movement_type, reason || null, user[0]?.name || 'Unknown']);
        await conn.commit();
        res.json({ message: 'Stock updated', new_stock: newStock });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.addStockMovement = addStockMovement;
const getStockMovements = async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`SELECT sm.*, p.name as product_name, p.sku FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       ORDER BY sm.created_at DESC LIMIT 100`);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.getStockMovements = getStockMovements;
