// js/billing.js - Barcode scanning and billing functionality

// Initialize barcode scanning
function initBarcodeScanning() {
  const searchInput = document.getElementById('searchInput');
  
  if (!searchInput) return;

  // USB Barcode Scanner Support (auto-detect barcode input)
  let barcodeBuffer = '';
  let barcodeTimeout = null;

  searchInput.addEventListener('keypress', async (e) => {
    // Clear timeout on each keypress
    clearTimeout(barcodeTimeout);
    
    // Add character to buffer
    barcodeBuffer += e.key;
    
    // If Enter is pressed, it's likely a barcode scanner
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcode = barcodeBuffer.replace('Enter', '').trim();
      
      if (barcode.length >= 8 && /^\d+$/.test(barcode)) {
        console.log('Barcode scanned:', barcode);
        await searchProductByBarcode(barcode);
        searchInput.value = '';
      }
      
      barcodeBuffer = '';
      return;
    }
    
    // Set timeout to clear buffer (barcode scanners type fast)
    barcodeTimeout = setTimeout(() => {
      barcodeBuffer = '';
    }, 100);
  });

  // Manual search on input change (for typing)
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    
    if (query.length >= 3) {
      await searchProductByName(query);
    }
  }, 500));
}

// Search product by barcode
async function searchProductByBarcode(barcode) {
  try {
    const res = await fetch(`/api/billing/products/search?barcode=${barcode}`);
    const data = await res.json();
    
    if (data.product) {
      console.log('Product found:', data.product);
      
      // Check stock availability
      if (data.product.available_stock !== undefined && data.product.available_stock <= 0) {
        alert(`❌ ${data.product.name}\n\nOut of Stock!\nCurrent Stock: ${data.product.available_stock}`);
        return;
      }
      
      addProductToBill(data.product);
    } else {
      alert('Product not found for barcode: ' + barcode);
    }
  } catch (err) {
    console.error('Barcode search error:', err);
    alert('Error searching product');
  }
}

// Search product by name
async function searchProductByName(name) {
  try {
    const res = await fetch(`/api/billing/products/search?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    
    if (data.products && data.products.length > 0) {
      showProductSuggestions(data.products);
    }
  } catch (err) {
    console.error('Name search error:', err);
  }
}

// Check stock availability
async function checkStockAvailability(productId) {
  try {
    const res = await fetch(`/api/billing/products/${productId}`);
    const data = await res.json();
    return data.available_stock || 0;
  } catch (err) {
    console.error('Stock check error:', err);
    return 0;
  }
}

// Show product suggestions dropdown
function showProductSuggestions(products) {
  const searchInput = document.getElementById('searchInput');
  
  // Remove existing suggestions
  let dropdown = document.getElementById('product-suggestions');
  if (dropdown) dropdown.remove();
  
  // Create new dropdown
  dropdown = document.createElement('div');
  dropdown.id = 'product-suggestions';
  dropdown.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    width: ${searchInput.offsetWidth}px;
  `;
  
  products.forEach(product => {
    const stockStatus = product.available_stock !== undefined 
      ? (product.available_stock > 0 
          ? `Stock: ${product.available_stock}` 
          : '❌ Out of Stock')
      : '';
    
    const isOutOfStock = product.available_stock !== undefined && product.available_stock <= 0;
    
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 12px;
      cursor: ${isOutOfStock ? 'not-allowed' : 'pointer'};
      border-bottom: 1px solid #f3f4f6;
      opacity: ${isOutOfStock ? '0.5' : '1'};
    `;
    item.innerHTML = `
      <strong>${product.name}</strong> ${isOutOfStock ? '<span style="color: #ef4444; font-size: 12px;">OUT OF STOCK</span>' : ''}<br>
      <small style="color: #6b7280;">SKU: ${product.sku} | ₹${product.unit_price || 0} ${stockStatus ? `| ${stockStatus}` : ''}</small>
    `;
    
    item.addEventListener('click', () => {
      if (isOutOfStock) {
        alert(`❌ ${product.name}\n\nOut of Stock!\nCurrent Stock: ${product.available_stock}`);
        return;
      }
      
      addProductToBill(product);
      dropdown.remove();
      searchInput.value = '';
    });
    
    if (!isOutOfStock) {
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f3f4f6';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });
    }
    
    dropdown.appendChild(item);
  });
  
  searchInput.parentElement.style.position = 'relative';
  searchInput.parentElement.appendChild(dropdown);
  
  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== searchInput) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 100);
}

// Add product to bill
function addProductToBill(product) {
  const itemsBody = document.getElementById('itemsBody');
  if (!itemsBody) return;
  
  // Check if product already exists in bill
  const existingRow = itemsBody.querySelector(`[data-product-id="${product.id}"]`);
  
  if (existingRow) {
    // Increment quantity
    const plusBtn = existingRow.querySelector('.plus');
    if (plusBtn) {
      plusBtn.click();
      highlightRow(existingRow, 'Updated');
    }
  } else {
    // Add new product via global function
    if (typeof window.addNewMedicine === 'function') {
      window.addNewMedicine(product);
      
      // Highlight the newly added row
      setTimeout(() => {
        const newRow = itemsBody.querySelector(`[data-product-id="${product.id}"]`);
        if (newRow) highlightRow(newRow, 'Added');
      }, 100);
    } else {
      console.error('addNewMedicine function not available');
    }
  }
}

// Highlight row when item is added/updated
function highlightRow(row, action) {
  // Create and show indicator
  const indicator = document.createElement('div');
  indicator.textContent = action;
  indicator.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: #10b981;
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10;
    animation: fadeInOut 2s ease;
  `;
  
  row.style.position = 'relative';
  row.appendChild(indicator);
  
  // Add highlight effect
  row.style.backgroundColor = '#dcfce7';
  row.style.transition = 'background-color 0.3s ease';
  
  setTimeout(() => {
    row.style.backgroundColor = '';
    indicator.remove();
  }, 2000);
}

// Expose for use in scripts.js
window.highlightBillingRow = highlightRow;

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize when billing page loads
if (typeof window.initBillingPage === 'function') {
  const originalInit = window.initBillingPage;
  window.initBillingPage = function() {
    originalInit();
    initBarcodeScanning();
  };
} else {
  window.addEventListener('DOMContentLoaded', initBarcodeScanning);
}

// Export for use in scripts.js
window.initBarcodeScanning = initBarcodeScanning;
