"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addStockMovement = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProduct = exports.getStockMovements = exports.getProducts = exports.stockMovementValidation = exports.productValidation = void 0;
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
// ── helpers ──────────────────────────────────────────────
const validationError = (res, errors) => res.status(422).json({ success: false, errors: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
const parsePage = (p, limit) => {
    const page = Math.max(1, parseInt(p) || 1);
    const size = Math.min(100, Math.max(1, parseInt(limit) || 20));
    return { page, size, offset: (page - 1) * size };
};
// ── validation rules ─────────────────────────────────────
exports.productValidation = [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Product name is required'),
    (0, express_validator_1.body)('sku').trim().notEmpty().withMessage('SKU is required')
        .matches(/^[A-Za-z0-9\-_]+$/).withMessage('SKU must be alphanumeric (hyphens/underscores allowed)'),
    (0, express_validator_1.body)('category').trim().notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    (0, express_validator_1.body)('current_stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    (0, express_validator_1.body)('min_stock_alert').isInt({ min: 0 }).withMessage('Min stock alert must be a non-negative integer'),
];
exports.stockMovementValidation = [
    (0, express_validator_1.body)('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    (0, express_validator_1.body)('movement_type').isIn(['IN', 'OUT']).withMessage('Movement type must be IN or OUT'),
    (0, express_validator_1.body)('reason').optional().trim(),
];
// ── GET /products ─────────────────────────────────────────
const getProducts = async (req, res) => {
    try {
        const { page, size, offset } = parsePage(req.query.page, req.query.limit);
        const search = (req.query.search || '').trim();
        const category = (req.query.category || '').trim();
        const lowStock = req.query.low_stock === 'true';
        const conditions = [];
        const params = [];
        if (search) {
            conditions.push('(name LIKE ? OR sku LIKE ? OR category LIKE ? OR location LIKE ?)');
            params.push(...Array(4).fill(`%${search}%`));
        }
        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }
        if (lowStock) {
            conditions.push('current_stock <= min_stock_alert');
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [[{ total }]] = await db_1.default.query(`SELECT COUNT(*) as total FROM products ${where}`, params);
        const [rows] = await db_1.default.query(`SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, offset]);
        res.status(200).json({
            success: true,
            data: rows,
            pagination: { total, page, limit: size, pages: Math.ceil(total / size) }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.getProducts = getProducts;
// ── GET /products/movements ───────────────────────────────
const getStockMovements = async (req, res) => {
    try {
        const { page, size, offset } = parsePage(req.query.page, req.query.limit);
        const productId = req.query.product_id;
        const type = req.query.type;
        const conditions = [];
        const params = [];
        if (productId) {
            conditions.push('sm.product_id = ?');
            params.push(productId);
        }
        if (type && ['IN', 'OUT'].includes(type)) {
            conditions.push('sm.movement_type = ?');
            params.push(type);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [[{ total }]] = await db_1.default.query(`SELECT COUNT(*) as total FROM stock_movements sm ${where}`, params);
        const [rows] = await db_1.default.query(`SELECT sm.*, p.name as product_name, p.sku FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`, [...params, size, offset]);
        res.status(200).json({
            success: true,
            data: rows,
            pagination: { total, page, limit: size, pages: Math.ceil(total / size) }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.getStockMovements = getStockMovements;
// ── GET /products/:id ─────────────────────────────────────
const getProduct = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid product ID' });
        return;
    }
    try {
        const [rows] = await db_1.default.query('SELECT * FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        const [movements] = await db_1.default.query(`SELECT sm.*, p.name as product_name FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       WHERE sm.product_id = ? ORDER BY sm.created_at DESC LIMIT 50`, [id]);
        res.status(200).json({ success: true, data: { ...rows[0], movements } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.getProduct = getProduct;
// ── POST /products ────────────────────────────────────────
const createProduct = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = req.body;
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [existing] = await conn.query('SELECT id FROM products WHERE sku = ?', [sku]);
        if (existing.length > 0) {
            res.status(409).json({ success: false, message: `SKU "${sku}" already exists` });
            await conn.rollback();
            return;
        }
        const [result] = await conn.execute(`INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES (?,?,?,?,?,?,?)`, [name, sku.toUpperCase(), category, unit_price, current_stock, min_stock_alert, location || null]);
        const productId = result.insertId;
        if (Number(current_stock) > 0) {
            const [user] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
            await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [productId, current_stock, 'IN', 'Initial stock', user[0]?.name || 'System']);
        }
        await conn.commit();
        res.status(201).json({ success: true, message: 'Product created successfully', data: { id: productId } });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.createProduct = createProduct;
// ── PUT /products/:id ─────────────────────────────────────
const updateProduct = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid product ID' });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { name, sku, category, unit_price, min_stock_alert, location } = req.body;
    try {
        const [result] = await db_1.default.execute(`UPDATE products SET name=?, sku=?, category=?, unit_price=?, min_stock_alert=?, location=? WHERE id=?`, [name, sku.toUpperCase(), category, unit_price, min_stock_alert, location || null, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Product updated successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.updateProduct = updateProduct;
// ── DELETE /products/:id ──────────────────────────────────
const deleteProduct = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid product ID' });
        return;
    }
    try {
        const [result] = await db_1.default.execute('DELETE FROM products WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Product deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.deleteProduct = deleteProduct;
// ── POST /products/:id/stock ──────────────────────────────
const addStockMovement = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid product ID' });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { quantity, movement_type, reason } = req.body;
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id, name, current_stock FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Product not found' });
            await conn.rollback();
            return;
        }
        const { current_stock, name } = rows[0];
        if (movement_type === 'OUT' && current_stock < Number(quantity)) {
            res.status(400).json({
                success: false,
                message: `Insufficient stock for "${name}". Available: ${current_stock}, Requested: ${quantity}`
            });
            await conn.rollback();
            return;
        }
        const newStock = movement_type === 'IN'
            ? current_stock + Number(quantity)
            : current_stock - Number(quantity);
        await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, id]);
        const [user] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
        await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [id, quantity, movement_type, reason?.trim() || null, user[0]?.name || 'Unknown']);
        await conn.commit();
        res.status(200).json({ success: true, message: 'Stock updated', data: { previous_stock: current_stock, new_stock: newStock, movement_type, quantity } });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.addStockMovement = addStockMovement;
