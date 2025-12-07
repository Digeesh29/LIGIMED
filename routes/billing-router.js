import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// Search products by barcode or name
router.get('/products/search', async (req, res) => {
  try {
    const { barcode, name, sku } = req.query;
    const orgId = req.query.orgId || null;
    
    if (!barcode && !name && !sku) {
      return res.status(400).json({ error: 'Please provide barcode, name, or sku' });
    }

    let query = supabase.from('products').select('*');
    
    if (barcode) {
      query = query.eq('barcode', barcode);
    } else if (sku) {
      query = query.eq('sku', sku);
    } else if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    
    const { data, error } = await query.limit(10);
    
    if (error) {
      console.error('Product search error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Get stock for each product
    const productsWithStock = await Promise.all(
      (data || []).map(async (product) => {
        let stockQuery = supabase
          .from('current_stock')
          .select('qty')
          .eq('product_id', product.id);
        
        if (orgId) stockQuery = stockQuery.eq('org_id', orgId);

        const { data: stockData } = await stockQuery;
        
        const totalStock = stockData?.reduce((sum, s) => sum + Number(s.qty || 0), 0) || 0;

        return {
          ...product,
          available_stock: totalStock
        };
      })
    );

    console.log('Product search:', { barcode, name, sku, found: productsWithStock.length });
    
    return res.json({ 
      product: productsWithStock.length > 0 ? productsWithStock[0] : null,
      products: productsWithStock
    });
  } catch (err) {
    console.error('GET /products/search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID with stock info
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.query.orgId || null;

    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (prodError) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get current stock
    let stockQuery = supabase
      .from('current_stock')
      .select('qty')
      .eq('product_id', id);
    
    if (orgId) stockQuery = stockQuery.eq('org_id', orgId);

    const { data: stockData } = await stockQuery;
    
    const totalStock = stockData?.reduce((sum, s) => sum + Number(s.qty || 0), 0) || 0;

    return res.json({
      ...product,
      available_stock: totalStock
    });
  } catch (err) {
    console.error('GET /products/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Save bill
router.post('/bills', async (req, res) => {
  try {
    const { customerMobile, customerName, items, subtotal, gst, grandTotal, paymentMethod } = req.body;
    const orgId = req.body.orgId || null;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in bill' });
    }

    const billNumber = `BILL-${Date.now()}`;
    
    // 1. Get or create customer if mobile provided
    let customerId = null;
    if (customerMobile) {
      // Check if customer exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('mobile', customerMobile)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else if (customerName) {
        // Create new customer
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            mobile: customerMobile,
            name: customerName
          })
          .select('id')
          .single();
        
        if (newCustomer) {
          customerId = newCustomer.id;
        }
      }
    }

    // 2. Create bill record
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        org_id: orgId,
        bill_number: billNumber,
        customer_id: customerId,
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerMobile || null,
        subtotal: subtotal,
        tax_amount: gst,
        discount_amount: 0,
        grand_total: grandTotal,
        payment_method: paymentMethod || 'cash',
        payment_status: 'paid'
      })
      .select()
      .single();
    
    if (billError) {
      console.error('Bill creation error:', billError);
      return res.status(500).json({ error: 'Failed to create bill' });
    }

    // 2. Create bill items
    const billItems = items.map(item => ({
      bill_id: bill.id,
      product_id: item.id,
      product_name: item.name,
      batch_number: item.batch,
      qty: item.qty,
      unit_price: item.price,
      tax_rate: 12,
      tax_amount: (item.price * item.qty * 0.12),
      line_total: item.lineTotal
    }));

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(billItems);
    
    if (itemsError) {
      console.error('Bill items error:', itemsError);
      return res.status(500).json({ error: 'Failed to save bill items' });
    }

    // 3. Create inventory movements (reduce stock)
    const movements = items.map(item => ({
      org_id: orgId,
      product_id: item.id,
      location_id: null,
      change_qty: -item.qty,
      movement_type: 'sale',
      reference: billNumber,
      unit_cost: item.price
    }));

    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert(movements);
    
    if (movementError) {
      console.error('Inventory movement error:', movementError);
    }

    console.log('Bill saved:', { billNumber, items: items.length, total: grandTotal });

    return res.json({
      success: true,
      bill_number: billNumber,
      bill_id: bill.id,
      total: grandTotal
    });
  } catch (err) {
    console.error('POST /bills error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent bills
router.get('/bills/recent', async (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const limit = parseInt(req.query.limit) || 10;

    let query = supabase
      .from('bills')
      .select('bill_number, customer_name, grand_total, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (orgId) query = query.eq('org_id', orgId);

    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const bills = data.map(bill => ({
      bill_number: bill.bill_number,
      customer_name: bill.customer_name,
      total: bill.grand_total,
      created_at: bill.created_at
    }));

    return res.json({ bills });
  } catch (err) {
    console.error('GET /bills/recent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get bill details by ID or number
router.get('/bills/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const orgId = req.query.orgId || null;

    // Check if identifier is UUID or bill number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    let query = supabase.from('bills').select('*');
    
    if (isUUID) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('bill_number', identifier);
    }
    
    if (orgId) query = query.eq('org_id', orgId);

    const { data: bill, error: billError } = await query.single();
    
    if (billError || !bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Get bill items
    const { data: items, error: itemsError } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id);
    
    if (itemsError) {
      return res.status(500).json({ error: 'Failed to fetch bill items' });
    }

    return res.json({
      ...bill,
      items: items || []
    });
  } catch (err) {
    console.error('GET /bills/:identifier error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer endpoints
router.get('/customers/search', async (req, res) => {
  try {
    const { mobile } = req.query;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number required' });
    }

    console.log('Searching for customer with mobile:', mobile);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('mobile', mobile)
      .maybeSingle();
    
    if (error) {
      console.error('Customer search error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Customer search result:', data ? 'Found' : 'Not found');

    return res.json({ 
      customer: data, 
      found: data !== null 
    });
  } catch (err) {
    console.error('GET /customers/search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/customers', async (req, res) => {
  try {
    const { mobile, name, email, address } = req.body;

    if (!mobile || !name) {
      return res.status(400).json({ error: 'Mobile and name are required' });
    }

    console.log('Creating customer:', { mobile, name });

    const { data, error } = await supabase
      .from('customers')
      .insert({
        mobile,
        name,
        email: email || null,
        address: address || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Customer creation error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Customer created:', data.id);

    return res.json({ customer: data, created: true });
  } catch (err) {
    console.error('POST /customers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
