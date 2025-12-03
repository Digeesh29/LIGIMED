// js/scripts.js

function initBillingPage() {
  const itemsBody = document.getElementById("itemsBody");
  if (!itemsBody) return;  // not on Billing page

  const mopdata = [
    { id: 1, name: "Paracetamol 500mg",  batch: "PCM2401", price: 4.5,  qty: 4 },
    { id: 2, name: "Azithromycin 500mg", batch: "AZT2402", price: 24.0, qty: 1 },
    { id: 3, name: "Amoxicillin 250mg",  batch: "AMX2403", price: 8.5,  qty: 1 },
    { id: 4, name: "Azithromycin 500mg", batch: "AZT2402", price: 24.0, qty: 1 }
  ];

  let medicines = mopdata.map((m) => ({ ...m }));
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

      row.innerHTML = `
        <div class="col-item">
          <div class="med-name">${item.name}</div>
          <div class="med-batch">Batch: ${item.batch}</div>
        </div>
        <div class="col-qty qty-control">
          <button class="qty-btn minus">-</button>
          <span class="qty-value">${item.qty}</span>
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
    const row = e.target.closest(".item-row");
    if (!row) return;

    const id = Number(row.dataset.id);
    const item = medicines.find((m) => m.id === id);
    if (!item) return;

    if (e.target.classList.contains("plus")) {
      item.qty += 1;
    } else if (e.target.classList.contains("minus")) {
      if (item.qty > 1) item.qty -= 1;
    } else if (e.target.classList.contains("delete-btn")) {
      item.qty = 0;
    }

    renderItems();
  });

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
    generateBillBtn.addEventListener("click", () => {
      const bill = getCurrentBillPayload();

      console.group("Generated Bill");
      console.log("Customer:", bill.customerName || "(anonymous)", bill.customerMobile);
      console.table(
        bill.items.map((it) => ({
          id: it.id,
          name: it.name,
          batch: it.batch,
          price: formatCurrency(it.price),
          qty: it.qty,
          lineTotal: formatCurrency(it.lineTotal)
        }))
      );
      console.log("Subtotal:", formatCurrency(bill.subtotal));
      console.log("GST:", formatCurrency(bill.gst));
      console.log("Grand Total:", formatCurrency(bill.grandTotal));
      console.log("Created At:", bill.createdAt);
      console.groupEnd();

      alert("Bill generated! Check console for JSON.");
    });
  }

  if (fetchCustomerBtn) {
    fetchCustomerBtn.addEventListener("click", () => {
      const mobile = customerMobileInput.value.trim();
      if (mobile === "9876543210") {
        customerNameInput.value = "Test Customer";
      } else {
        alert("No customer found (demo data only).");
      }
    });
  }

  renderItems();
}

// Make function visible to main.js
window.initBillingPage = initBillingPage;
