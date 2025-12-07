function initializeDashboard({ refreshIntervalMs = 60000 } = {}) {
  const card = document.getElementById('total-orders-card');
  const valueEl = document.getElementById('total-orders-value');
  
  if (!card || !valueEl) {
    console.error('Dashboard elements not found:', { card, valueEl });
    return () => {};
  }

  const endpoint = card.dataset.endpoint || '/api/dashboard/total-orders';
  const originalText = valueEl.textContent;

  const setLoading = () => { valueEl.textContent = '…'; };
  const setError = () => { valueEl.textContent = originalText; };

  async function loadTotal() {
    try {
      console.log('Fetching total orders from:', endpoint);
      setLoading();
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log('Total orders response:', json);
      
      const total = Number(json?.total ?? 0);
      valueEl.textContent = Number.isFinite(total) ? String(total) : originalText;
      
      // Update percentage change
      const subEl = document.getElementById('total-orders-sub');
      if (subEl && json.percentage_change !== undefined) {
        const change = json.percentage_change;
        const isPositive = change >= 0;
        const sign = isPositive ? '+' : '';
        subEl.textContent = `${sign}${change}% from last month`;
        subEl.className = isPositive ? 'text-success' : 'text-danger';
      }
      
      console.log('Updated total orders to:', total, 'with change:', json.percentage_change);
    } catch (err) {
      console.error('loadTotal error', err);
      setError();
    }
  }

  async function loadRecentOrders() {
    const container = document.getElementById('recent-orders-container');
    if (!container) return;

    try {
      console.log('Fetching recent orders...');
      const res = await fetch('/api/dashboard/recent-orders?limit=3', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log('Recent orders response:', json);

      if (!json.orders || json.orders.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">No orders found</div>';
        return;
      }

      const statusMap = {
        'in_transit': { class: 'in-transit', label: 'In Transit' },
        'delivered': { class: 'delivered', label: 'Delivered' },
        'pending': { class: 'pending', label: 'Pending' },
        'confirmed': { class: 'in-transit', label: 'Confirmed' },
        'packed': { class: 'in-transit', label: 'Packed' }
      };

      container.innerHTML = json.orders.map(order => {
        const status = statusMap[order.status] || { class: 'pending', label: order.status };
        return `
          <div class="order-card">
            <strong>${order.order_number}</strong>
            <span class="badge-status ${status.class}">${status.label}</span>
            <div>${order.company_name || 'N/A'}</div>
            <small>--- items • ₹---</small>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('loadRecentOrders error', err);
      container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading orders</div>';
    }
  }

  async function loadLowStock() {
    const container = document.getElementById('low-stock-container');
    const alertValueEl = document.getElementById('low-stock-alerts-value');
    const alertSubEl = document.getElementById('low-stock-alerts-sub');
    
    if (!container) return;

    try {
      console.log('Fetching low stock items...');
      const res = await fetch('/api/dashboard/low-stock', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log('Low stock response:', json);

      // Update the alert card count
      if (alertValueEl) {
        alertValueEl.textContent = json.total_count || 0;
      }
      if (alertSubEl) {
        const count = json.total_count || 0;
        alertSubEl.textContent = count > 0 ? 'Requires attention' : 'All items in stock';
      }

      if (!json.items || json.items.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">All items in stock</div>';
        return;
      }

      container.innerHTML = json.items.map(item => {
        const currentQty = Number(item.current_qty) || 0;
        const threshold = Number(item.reorder_threshold) || 100;
        const percentage = threshold > 0 ? Math.round((currentQty / threshold) * 100) : 0;
        
        return `
          <div class="stock-item">
            <strong>${item.name}</strong>
            <span class="restock">Restock</span>
            <div class="progress-bar">
              <div class="progress" style="width: ${percentage}%"></div>
            </div>
            <small>${currentQty} / ${threshold} units</small>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('loadLowStock error', err);
      container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading stock data</div>';
      if (alertValueEl) alertValueEl.textContent = '0';
    }
  }

  async function loadPendingDeliveries() {
    const valueEl = document.getElementById('pending-deliveries-value');
    const subEl = document.getElementById('pending-deliveries-sub');
    
    if (!valueEl || !subEl) return;

    try {
      console.log('Fetching pending deliveries...');
      const res = await fetch('/api/dashboard/pending-deliveries', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log('Pending deliveries response:', json);

      valueEl.textContent = json.total || 0;
      subEl.textContent = `${json.arriving_today || 0} arriving today`;

    } catch (err) {
      console.error('loadPendingDeliveries error', err);
      valueEl.textContent = '0';
      subEl.textContent = 'Error loading data';
    }
  }

  loadTotal();
  loadRecentOrders();
  loadLowStock();
  loadPendingDeliveries();
  
  const intervalId = refreshIntervalMs > 0 ? setInterval(() => {
    loadTotal();
    loadRecentOrders();
    loadLowStock();
    loadPendingDeliveries();
  }, refreshIntervalMs) : null;

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}


window.initializeDashboard = initializeDashboard;