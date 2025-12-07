// js/scripts.js

function initBillingPage() {
  const itemsBody = document.getElementById("itemsBody");
  if (!itemsBody) return;  // not on Billing page

  // Start with empty medicines array (products will be added via barcode/search)
  let medicines = [];
  const GST_RATE = 0.12;

  const q = (id) => document.getElementById(id);
  const formatCurrency = (value) => "₹" + value.toFixed(2);

  const summaryItems = q("summaryItems");
  const summarySubtotal = q("summarySubtotal");
  const summaryGST = q("summaryGST");
  const summaryGrand = q("summaryGrand");

  const clearAllBtn = q("clearAllBtn");
  const holdBillBtn = q("holdBillBtn");
  const generateBillBtn = q("generateBillBtn");

  const customerMobileInput = q("customerMobile");
  const customerNameInput = q("customerName");
  const fetchCustomerBtn = q("fetchCustomerBtn");

  function renderItems() {
    itemsBody.innerHTML = "";

    medicines.forEach((item) => {
      if (item.qty <= 0) return;

      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.id = item.id;
      row.dataset.productId = item.id; // For barcode scanning integration

      row.innerHTML = `
        <div class="col-item">
          <div class="med-name">${item.name}</div>
          <div class="med-batch">Batch: ${item.batch}</div>
        </div>
        <div class="col-qty qty-control">
          <button class="qty-btn minus">-</button>
          <input type="number" class="qty-input" value="${item.qty}" min="1" max="9999" />
          <button class="qty-btn plus">+</button>
        </div>
        <div class="col-price">${formatCurrency(item.price)}</div>
        <div class="col-total">${formatCurrency(item.price * item.qty)}</div>
        <div class="col-action">
          <button class="delete-btn">🗑</button>
        </div>
      `;

      itemsBody.appendChild(row);
    });

    updateSummary();
  }

  // Add new medicine from barcode scan
  function addNewMedicine(product) {
    const existingItem = medicines.find(m => m.id === product.id);
    
    if (existingItem) {
      existingItem.qty += 1;
    } else {
      medicines.push({
        id: product.id,
        name: product.name,
        batch: product.sku || 'N/A',
        price: product.unit_price || 0,
        qty: 1
      });
    }
    
    renderItems();
  }

  // Expose function globally for billing.js
  window.addNewMedicine = addNewMedicine;

  function calculateSummary() {
    const activeItems = medicines.filter((m) => m.qty > 0);
    const subtotal = activeItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const gst = subtotal * GST_RATE;
    const grand = subtotal + gst;
    return { activeItems, subtotal, gst, grand };
  }

  function updateSummary() {
    const { activeItems, subtotal, gst, grand } = calculateSummary();
    summaryItems.textContent = activeItems.length;
    summarySubtotal.textContent = formatCurrency(subtotal);
    summaryGST.textContent = formatCurrency(gst);
    summaryGrand.textContent = formatCurrency(grand);
  }

  function getCurrentBillPayload() {
    const { activeItems, subtotal, gst, grand } = calculateSummary();

    return {
      customerMobile: customerMobileInput.value.trim(),
      customerName: customerNameInput.value.trim(),
      items: activeItems.map((item) => ({
        id: item.id,
        name: item.name,
        batch: item.batch,
        price: item.price,
        qty: item.qty,
        lineTotal: item.price * item.qty
      })),
      subtotal,
      gst,
      grandTotal: grand,
      createdAt: new Date().toISOString()
    };
  }

  itemsBody.addEventListener("click", (e) => {
    console.log('Click detected:', e.target.className, e.target.tagName);
    
    const row = e.target.closest(".item-row");
    if (!row) {
      console.log('No row found');
      return;
    }

    // Use string ID (UUID) instead of converting to number
    const id = row.dataset.id;
    console.log('Row ID:', id);
    
    // Compare as strings since product IDs are UUIDs
    const item = medicines.find((m) => String(m.id) === String(id));
    if (!item) {
      console.log('Item not found in medicines array. Looking for:', id);
      console.log('Available items:', medicines.map(m => ({ id: m.id, name: m.name })));
      return;
    }

    console.log('Current item:', item.name, 'Qty:', item.qty);

    if (e.target.classList.contains("plus")) {
      console.log('Plus button clicked');
      item.qty += 1;
      renderItems();
    } else if (e.target.classList.contains("minus")) {
      console.log('Minus button clicked');
      if (item.qty > 1) {
        item.qty -= 1;
        renderItems();
      }
    } else if (e.target.classList.contains("delete-btn")) {
      console.log('Delete button clicked');
      item.qty = 0;
      renderItems();
    } else {
      console.log('No matching button class found');
    }
  });

  // Handle manual quantity input
  itemsBody.addEventListener("input", (e) => {
    if (!e.target.classList.contains("qty-input")) return;

    const row = e.target.closest(".item-row");
    if (!row) return;

    const id = row.dataset.id;
    const item = medicines.find((m) => String(m.id) === String(id));
    if (!item) return;

    const newQty = parseInt(e.target.value) || 1;
    
    // Validate quantity
    if (newQty < 1) {
      e.target.value = 1;
      item.qty = 1;
    } else if (newQty > 9999) {
      e.target.value = 9999;
      item.qty = 9999;
    } else {
      item.qty = newQty;
    }

    console.log('Quantity manually changed to:', item.qty);
    updateSummary();
    
    // Update the total for this row
    const priceText = row.querySelector('.col-price').textContent.replace('₹', '');
    const price = parseFloat(priceText) || 0;
    const total = item.qty * price;
    row.querySelector('.col-total').textContent = formatCurrency(total);
  });

  // Handle quantity input blur (when user clicks away)
  itemsBody.addEventListener("blur", (e) => {
    if (!e.target.classList.contains("qty-input")) return;
    
    // Ensure value is valid
    if (!e.target.value || parseInt(e.target.value) < 1) {
      e.target.value = 1;
      
      const row = e.target.closest(".item-row");
      if (row) {
        const id = row.dataset.id;
        const item = medicines.find((m) => String(m.id) === String(id));
        if (item) {
          item.qty = 1;
          updateSummary();
        }
      }
    }
  }, true);

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      medicines.forEach((m) => (m.qty = 0));
      renderItems();
    });
  }

  if (holdBillBtn) {
    holdBillBtn.addEventListener("click", () => {
      alert("Bill is put on hold (frontend demo only).");
    });
  }

  if (generateBillBtn) {
    generateBillBtn.addEventListener("click", async () => {
      const bill = getCurrentBillPayload();

      if (bill.items.length === 0) {
        alert("Please add items to the bill");
        return;
      }

      try {
        // Check stock availability for all items before generating bill
        console.log('Checking stock availability...');
        const stockCheckPromises = bill.items.map(async (item) => {
          const res = await fetch(`/api/billing/products/${item.id}`);
          const data = await res.json();
          return {
            name: item.name,
            requested: item.qty,
            available: data.available_stock || 0,
            sufficient: (data.available_stock || 0) >= item.qty
          };
        });

        const stockChecks = await Promise.all(stockCheckPromises);
        const insufficientStock = stockChecks.filter(check => !check.sufficient);

        if (insufficientStock.length > 0) {
          let message = '❌ Insufficient Stock!\n\n';
          insufficientStock.forEach(item => {
            message += `${item.name}:\n`;
            message += `  Requested: ${item.requested}\n`;
            message += `  Available: ${item.available}\n`;
            message += `  Short by: ${item.requested - item.available}\n\n`;
          });
          message += 'Please adjust quantities and try again.';
          
          alert(message);
          return;
        }

        // All stock checks passed, proceed with bill generation
        const response = await fetch('/api/billing/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bill)
        });

        const result = await response.json();

        if (response.ok) {
          console.group("Bill Saved Successfully");
          console.log("Bill Number:", result.bill_number);
          console.log("Customer:", bill.customerName || "(anonymous)", bill.customerMobile);
          console.table(
            bill.items.map((it) => ({
              name: it.name,
              qty: it.qty,
              price: formatCurrency(it.price),
              total: formatCurrency(it.lineTotal)
            }))
          );
          console.log("Subtotal:", formatCurrency(bill.subtotal));
          console.log("GST:", formatCurrency(bill.gst));
          console.log("Grand Total:", formatCurrency(bill.grandTotal));
          console.groupEnd();

          // Show print dialog
          const printBill = confirm(`Bill generated successfully!\n\nBill Number: ${result.bill_number}\nTotal: ₹${bill.grandTotal.toFixed(2)}\n\nWould you like to print the bill?`);
          
          if (printBill) {
            printBillReceipt(result.bill_number, bill);
          }
          
          // Clear the bill
          medicines.forEach((m) => (m.qty = 0));
          medicines = [];
          customerMobileInput.value = '';
          customerNameInput.value = '';
          if (customerNameDisplay) customerNameDisplay.style.display = 'none';
          renderItems();
          
          // Reload recent bills
          if (typeof window.reloadRecentBills === 'function') {
            window.reloadRecentBills();
          }
        } else {
          alert(`Error: ${result.error || 'Failed to save bill'}`);
        }
      } catch (error) {
        console.error('Error saving bill:', error);
        alert('Error saving bill. Please try again.');
      }
    });
  }

  const customerNameField = document.getElementById('customerNameField');
  const customerNameDisplay = document.getElementById('customerNameDisplay');
  const customerNameText = document.getElementById('customerNameText');
  let currentCustomerMode = 'fetch'; // 'fetch' or 'add'

  if (fetchCustomerBtn) {
    fetchCustomerBtn.addEventListener("click", async () => {
      const mobile = customerMobileInput.value.trim();
      
      if (!mobile) {
        alert("Please enter a mobile number");
        return;
      }

      if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
        alert("Please enter a valid 10-digit mobile number");
        return;
      }

      // If in 'add' mode, save the customer
      if (currentCustomerMode === 'add') {
        const name = customerNameInput.value.trim();
        
        if (!name) {
          alert("Please enter customer name");
          customerNameInput.focus();
          return;
        }

        try {
          fetchCustomerBtn.disabled = true;
          fetchCustomerBtn.textContent = "Saving...";

          const saveRes = await fetch('/api/billing/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobile: mobile,
              name: name
            })
          });

          const saveData = await saveRes.json();
          
          if (saveRes.ok) {
            console.log('New customer created:', saveData.customer);
            
            // Switch back to fetch mode and show the name
            currentCustomerMode = 'fetch';
            fetchCustomerBtn.textContent = "Fetch";
            customerNameField.style.display = 'none';
            customerNameDisplay.style.display = 'block';
            customerNameText.textContent = name;
            
            // Store in hidden input for bill generation
            customerNameInput.value = name;
            
            alert(`Customer added successfully!\nName: ${name}\nMobile: ${mobile}`);
          } else {
            alert('Error saving customer: ' + (saveData.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('Error saving customer:', error);
          alert('Error saving customer. Please try again.');
        } finally {
          fetchCustomerBtn.disabled = false;
        }
        return;
      }

      // Fetch mode - search for customer
      try {
        fetchCustomerBtn.disabled = true;
        fetchCustomerBtn.textContent = "...";

        const res = await fetch(`/api/billing/customers/search?mobile=${mobile}`);
        const data = await res.json();

        if (data.found && data.customer) {
          // Customer exists - show name in display box
          customerNameInput.value = data.customer.name;
          customerNameField.style.display = 'none';
          customerNameDisplay.style.display = 'block';
          customerNameText.textContent = data.customer.name;
          currentCustomerMode = 'fetch';
          fetchCustomerBtn.textContent = "Fetch";
          console.log('Customer found:', data.customer);
          
          // Show success briefly
          const originalBg = customerMobileInput.style.backgroundColor;
          customerMobileInput.style.backgroundColor = '#dcfce7';
          setTimeout(() => {
            customerMobileInput.style.backgroundColor = originalBg;
          }, 1000);
        } else {
          // Customer not found - switch to add mode
          currentCustomerMode = 'add';
          fetchCustomerBtn.textContent = "Add";
          customerNameField.style.display = 'block';
          customerNameDisplay.style.display = 'none';
          customerNameInput.value = '';
          customerNameInput.focus();
          console.log('Customer not found, switching to add mode');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        alert('Error fetching customer. Please try again.');
      } finally {
        fetchCustomerBtn.disabled = false;
        if (currentCustomerMode === 'fetch') {
          fetchCustomerBtn.textContent = "Fetch";
        }
      }
    });
  }

  // Auto-fetch customer when mobile number is entered (on Enter key)
  if (customerMobileInput) {
    customerMobileInput.addEventListener("keypress", (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (fetchCustomerBtn) {
          fetchCustomerBtn.click();
        }
      }
    });

    // Reset to fetch mode when mobile number changes
    customerMobileInput.addEventListener("input", () => {
      if (currentCustomerMode === 'add') {
        currentCustomerMode = 'fetch';
        fetchCustomerBtn.textContent = "Fetch";
        customerNameField.style.display = 'none';
      }
      // Hide name display when mobile changes
      if (customerNameDisplay) {
        customerNameDisplay.style.display = 'none';
      }
    });
  }

  // Handle Enter key in name field when adding customer
  if (customerNameInput) {
    customerNameInput.addEventListener("keypress", (e) => {
      if (e.key === 'Enter' && currentCustomerMode === 'add') {
        e.preventDefault();
        if (fetchCustomerBtn) {
          fetchCustomerBtn.click();
        }
      }
    });
  }

  // Load recent bills
  async function loadRecentBills() {
    const container = document.getElementById('recentBillsList');
    if (!container) return;

    try {
      const res = await fetch('/api/billing/bills/recent?limit=5', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      console.log('Recent bills:', data);

      if (!data.bills || data.bills.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">No bills yet</div>';
        return;
      }

      container.innerHTML = data.bills.map(bill => {
        const date = new Date(bill.created_at);
        const timeAgo = getTimeAgo(date);
        
        return `
          <div class="recent-item">
            <div>
              <div class="recent-id">${bill.bill_number}</div>
              <div class="recent-time">${timeAgo}</div>
            </div>
            <div class="recent-amount">₹${Number(bill.total).toFixed(2)}</div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Error loading recent bills:', err);
      container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading bills</div>';
    }
  }

  // Helper function to get time ago
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  }

  // Expose function to reload bills after generating
  window.reloadRecentBills = loadRecentBills;

  // Print bill receipt
  function printBillReceipt(billNumber, billData) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill - ${billNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            max-width: 80mm;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .shop-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .shop-details {
            font-size: 12px;
            margin-bottom: 3px;
          }
          .bill-info {
            margin: 10px 0;
            font-size: 12px;
          }
          .bill-info div {
            margin-bottom: 3px;
          }
          .items-table {
            width: 100%;
            margin: 10px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 5px 0;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            width: 40px;
            text-align: center;
          }
          .item-price {
            width: 60px;
            text-align: right;
          }
          .item-total {
            width: 70px;
            text-align: right;
          }
          .totals {
            margin-top: 10px;
            font-size: 12px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .grand-total {
            font-weight: bold;
            font-size: 14px;
            border-top: 2px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 11px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">LIGIMED PHARMACY</div>
          <div class="shop-details">Pharmacy Portal</div>
          <div class="shop-details">Tel: +91-XXXXXXXXXX</div>
        </div>
        
        <div class="bill-info">
          <div><strong>Bill No:</strong> ${billNumber}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
          <div><strong>Customer:</strong> ${billData.customerName || 'Walk-in'}</div>
          ${billData.customerMobile ? `<div><strong>Mobile:</strong> ${billData.customerMobile}</div>` : ''}
        </div>
        
        <div class="items-table">
          <div class="item-row" style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 3px;">
            <div class="item-name">Item</div>
            <div class="item-qty">Qty</div>
            <div class="item-price">Price</div>
            <div class="item-total">Total</div>
          </div>
          ${billData.items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.qty}</div>
              <div class="item-price">₹${item.price.toFixed(2)}</div>
              <div class="item-total">₹${item.lineTotal.toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${billData.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>GST (12%):</span>
            <span>₹${billData.gst.toFixed(2)}</span>
          </div>
          <div class="total-row grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${billData.grandTotal.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <div>Thank you for your business!</div>
          <div style="margin-top: 5px;">*** COMPUTER GENERATED BILL ***</div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            Print Bill
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Auto-print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  // Load recent bills on page load
  loadRecentBills();

  renderItems();
}

// Make function visible to main.js
window.initBillingPage = initBillingPage;
