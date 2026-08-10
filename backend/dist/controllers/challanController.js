"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateChallanStatus = exports.createChallan = exports.getChallan = exports.getChallans = void 0;
const db_1 = __importDefault(require("../config/db"));
// Auto-generate challan number: CH-YYYYMMDD-XXXX
const generateChallanNumber = async (conn) => {
    const date = new Date();
    const prefix = `CH-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const [rows] = await conn.query(`SELECT challan_number FROM challans WHERE challan_number LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
    const seq = rows.length > 0 ? parseInt(rows[0].challan_number.split('-')[2]) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
};
const getChallans = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        let query = `SELECT c.*, COUNT(ci.id) as item_count 
                 FROM challans c LEFT JOIN challan_items ci ON c.id = ci.challan_id`;
        const conditions = [];
        const params = [];
        if (search) {
            conditions.push(`(c.challan_number LIKE ? OR c.customer_name LIKE ? OR c.customer_business LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            conditions.push(`c.status = ?`);
            params.push(status);
        }
        if (conditions.length)
            query += ` WHERE ${conditions.join(' AND ')}`;
        query += ` GROUP BY c.id ORDER BY c.created_at DESC`;
        const [rows] = await db_1.default.query(query, params);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.getChallans = getChallans;
const getChallan = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM challans WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Challan not found' });
            return;
        }
        const [items] = await db_1.default.query('SELECT * FROM challan_items WHERE challan_id = ?', [req.params.id]);
        res.json({ ...rows[0], items });
    }
    catch (err) {
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
};
exports.getChallan = getChallan;
const createChallan = async (req, res) => {
    const { customer_id, items, status, notes } = req.body;
    if (!customer_id) {
        res.status(400).json({ message: 'Customer is required' });
        return;
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'At least one product is required' });
        return;
    }
    for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
            res.status(400).json({ message: 'Each item needs a valid product and quantity > 0' });
            return;
        }
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        // Get customer snapshot
        const [customers] = await conn.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
        if (customers.length === 0) {
            res.status(404).json({ message: 'Customer not found' });
            await conn.rollback();
            return;
        }
        const customer = customers[0];
        // Get user name
        const [users] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
        const createdBy = users[0]?.name || 'Unknown';
        // Validate products and get snapshots
        let totalQty = 0, totalAmount = 0;
        const resolvedItems = [];
        for (const item of items) {
            const [products] = await conn.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (products.length === 0) {
                await conn.rollback();
                res.status(404).json({ message: `Product ID ${item.product_id} not found` });
                return;
            }
            const product = products[0];
            // Stock check only if confirming
            if (status === 'confirmed' && product.current_stock < item.quantity) {
                await conn.rollback();
                res.status(400).json({
                    message: `Insufficient stock for "${product.name}". Available: ${product.current_stock}, Requested: ${item.quantity}`
                });
                return;
            }
            const totalPrice = Number(product.unit_price) * Number(item.quantity);
            totalQty += Number(item.quantity);
            totalAmount += totalPrice;
            resolvedItems.push({ ...item, product, totalPrice });
        }
        const challanNumber = await generateChallanNumber(conn);
        // Insert challan
        const [challanResult] = await conn.execute(`INSERT INTO challans (challan_number, customer_id, customer_name, customer_mobile, customer_business, customer_address, total_quantity, total_amount, status, created_by, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [challanNumber, customer_id, customer.name, customer.mobile, customer.business_name,
            customer.address, totalQty, totalAmount, status || 'draft', createdBy, notes || null]);
        const challanId = challanResult.insertId;
        // Insert items (product snapshot)
        for (const item of resolvedItems) {
            await conn.execute(`INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity, total_price)
         VALUES (?,?,?,?,?,?,?)`, [challanId, item.product_id, item.product.name, item.product.sku, item.product.unit_price, item.quantity, item.totalPrice]);
        }
        // Deduct stock if confirmed
        if (status === 'confirmed') {
            for (const item of resolvedItems) {
                await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
                await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [item.product_id, item.quantity, 'OUT', `Challan ${challanNumber}`, createdBy]);
            }
        }
        await conn.commit();
        res.status(201).json({ id: challanId, challan_number: challanNumber, message: 'Challan created' });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.createChallan = createChallan;
const updateChallanStatus = async (req, res) => {
    const { status } = req.body;
    if (!['draft', 'confirmed', 'cancelled'].includes(status)) {
        res.status(400).json({ message: 'Invalid status' });
        return;
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM challans WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Challan not found' });
            await conn.rollback();
            return;
        }
        const challan = rows[0];
        if (challan.status === 'cancelled') {
            res.status(400).json({ message: 'Cancelled challan cannot be changed' });
            await conn.rollback();
            return;
        }
        if (challan.status === status) {
            res.status(400).json({ message: `Challan is already ${status}` });
            await conn.rollback();
            return;
        }
        const [users] = await conn.query('SELECT name FROM users WHERE id = ?', [req.userId]);
        const updatedBy = users[0]?.name || 'Unknown';
        const [items] = await conn.query('SELECT * FROM challan_items WHERE challan_id = ?', [req.params.id]);
        // Draft → Confirmed: deduct stock
        if (challan.status === 'draft' && status === 'confirmed') {
            for (const item of items) {
                const [prod] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [item.product_id]);
                if (prod[0].current_stock < item.quantity) {
                    await conn.rollback();
                    res.status(400).json({
                        message: `Insufficient stock for "${item.product_name}". Available: ${prod[0].current_stock}, Required: ${item.quantity}`
                    });
                    return;
                }
                await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
                await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [item.product_id, item.quantity, 'OUT', `Challan ${challan.challan_number} confirmed`, updatedBy]);
            }
        }
        // Confirmed → Cancelled: restore stock
        if (challan.status === 'confirmed' && status === 'cancelled') {
            for (const item of items) {
                await conn.execute('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
                await conn.execute(`INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`, [item.product_id, item.quantity, 'IN', `Challan ${challan.challan_number} cancelled`, updatedBy]);
            }
        }
        await conn.execute('UPDATE challans SET status = ? WHERE id = ?', [status, req.params.id]);
        await conn.commit();
        res.json({ message: `Challan ${status}` });
    }
    catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.sqlMessage || err.message });
    }
    finally {
        conn.release();
    }
};
exports.updateChallanStatus = updateChallanStatus;
