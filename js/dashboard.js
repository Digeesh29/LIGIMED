// js/dashboard.js

function initDashboardPage() {
  /* --- Ensure elements exist --- */
  const dashboardPage = document.querySelector(".dashboard-page");
  if (!dashboardPage) return;

  /*---------------- 1. QUICK ACTION BUTTONS---------------------*/

  const quickBtns = document.querySelectorAll(".action-card");

  quickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.textContent.trim();

      switch (action) {
        case "Place Order":
          alert("Redirecting to Vendor Order Page… (coming soon)");
          break;

        case "Generate Bill":
          // Use your existing router
          console.log("Navigating to Billing page from Quick Action");
          setActivePage("billing");
          break;

        case "View Inventory":
          alert("Opening Inventory Page… (coming soon)");
          break;

        case "Order History":
          alert("Opening Order History… (coming soon)");
          break;

        default:
          console.log("Unknown action:", action);
      }
    });
  });

  /*----------------2. LOW STOCK – RESTOCK BUTTONS---------------------*/

  const restockBtns = document.querySelectorAll(".stock-item");

  restockBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const medicine = btn.parentElement.querySelector("strong")?.textContent.trim();

      alert(`Restock request created for: ${medicine}`);
    });
  });

  /*----------------3. RECENT ORDERS – CLICK TO VIEW---------------------*/

  const orderCards = dashboardPage.querySelectorAll(".order-item");

  orderCards.forEach((card) => {
    card.addEventListener("click", () => {
      const orderId = card.querySelector(".order-id")?.textContent.trim();
      alert(`Opening order details for: ${orderId}`);
    });
  });

  /*----------------4. Live-updating Stats (DEMO)---------------------*/

  const statOrders = dashboardPage.querySelector(".stat-card:nth-child(1) .stat-value");
  const statPending = dashboardPage.querySelector(".stat-card:nth-child(2) .stat-value");

  // Fake growth every 5 seconds
  setInterval(() => {
    if (statOrders) statOrders.textContent = Number(statOrders.textContent) + 1;
    if (statPending) statPending.textContent = 15 + Math.floor(Math.random() * 3);
  }, 5000);

  console.log("Dashboard page initialised successfully.");
}

// Expose to main.js router
window.initDashboardPage = initDashboardPage;
