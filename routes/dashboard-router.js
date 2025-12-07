import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

router.get('/total-orders', async (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const includeCancelled = req.query.includeCancelled === 'true' || req.query.includeCancelled === '1';

    // Get current month orders
    let q = supabase.from('orders').select('*', { count: 'exact', head: true });
    if (orgId) q = q.eq('org_id', orgId);
    if (!includeCancelled) q = q.neq('status', 'cancelled');

    const { error, count } = await q;
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message || 'Supabase error' });
    }

    // Get last month orders for comparison
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    let lastMonthQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());
    
    if (orgId) lastMonthQuery = lastMonthQuery.eq('org_id', orgId);
    if (!includeCancelled) lastMonthQuery = lastMonthQuery.neq('status', 'cancelled');

    const { count: lastMonthCount } = await lastMonthQuery;

    // Calculate percentage change
    let percentageChange = 0;
    if (lastMonthCount && lastMonthCount > 0) {
      percentageChange = Math.round(((count - lastMonthCount) / lastMonthCount) * 100);
    }

    console.log('Total orders query:', { 
      orgId, 
      includeCancelled, 
      currentTotal: count, 
      lastMonthTotal: lastMonthCount,
      percentageChange,
      error 
    });

    return res.json({ 
      total: count ?? 0,
      percentage_change: percentageChange,
      last_month_total: lastMonthCount ?? 0
    });
  } catch (err) {
    console.error('GET /total-orders error', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent-orders', async (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const limit = parseInt(req.query.limit) || 3;

    let q = supabase
      .from('orders')
      .select('order_number, company_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (orgId) q = q.eq('org_id', orgId);

    const { data, error } = await q;
    
    console.log('Recent orders query:', { orgId, limit, count: data?.length, error });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message || 'Supabase error' });
    }

    return res.json({ orders: data || [] });
  } catch (err) {
    console.error('GET /recent-orders error', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const orgId = req.query.orgId || null;

    // Get all products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, sku, reorder_threshold');
    
    if (prodError) {
      console.error('Products query error:', prodError);
      return res.status(500).json({ error: prodError.message });
    }

    // Get current stock for all products
    let stockQuery = supabase.from('current_stock').select('product_id, qty');
    if (orgId) stockQuery = stockQuery.eq('org_id', orgId);
    
    const { data: stockData, error: stockError } = await stockQuery;
    
    if (stockError) {
      console.error('Stock query error:', stockError);
    }

    // Create a map of product_id to current qty
    const stockMap = {};
    if (stockData) {
      stockData.forEach(s => {
        if (!stockMap[s.product_id]) {
          stockMap[s.product_id] = 0;
        }
        stockMap[s.product_id] += Number(s.qty) || 0;
      });
    }

    // Calculate low stock items
    const allLowStockItems = products
      .map(p => {
        const currentQty = stockMap[p.id] || 0;
        const threshold = p.reorder_threshold || 100;
        return {
          name: p.name,
          sku: p.sku,
          current_qty: currentQty,
          reorder_threshold: threshold,
          shortage: threshold - currentQty
        };
      })
      .filter(item => item.current_qty <= item.reorder_threshold)
      .sort((a, b) => b.shortage - a.shortage);

    const lowStockItems = allLowStockItems.slice(0, 3);

    console.log('Low stock items:', { total: allLowStockItems.length, showing: lowStockItems.length });

    return res.json({ 
      items: lowStockItems,
      total_count: allLowStockItems.length
    });
  } catch (err) {
    console.error('GET /low-stock error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending-deliveries', async (req, res) => {
  try {
    const orgId = req.query.orgId || null;

    // Count orders with pending delivery statuses
    let q = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'packed', 'in_transit']);
    
    if (orgId) q = q.eq('org_id', orgId);

    const { error, count } = await q;
    
    console.log('Pending deliveries query:', { orgId, count, error });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message || 'Supabase error' });
    }

    // Count orders arriving today
    let todayQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'packed', 'in_transit'])
      .gte('expected_delivery', new Date().toISOString().split('T')[0])
      .lt('expected_delivery', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    
    if (orgId) todayQuery = todayQuery.eq('org_id', orgId);

    const { error: todayError, count: todayCount } = await todayQuery;

    return res.json({ 
      total: count ?? 0,
      arriving_today: todayCount ?? 0
    });
  } catch (err) {
    console.error('GET /pending-deliveries error', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
