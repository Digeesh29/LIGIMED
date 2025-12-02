const menuItems = document.querySelectorAll('.menu-item');
const contentArea = document.getElementById('contentArea');

const headerTitle = document.querySelector('.header-title');
const headerSubtitle = document.querySelector('.header-subtitle');

/* Page-wise configuration */
const pageConfig = {
    dashboard: {
        title: 'LigiMed',
        subtitle: 'Pharmacy Portal Overview',
        file: 'pages/dashboard.html'
    },
    billing: {
        title: 'Smart Billing',
        subtitle: 'Generate invoices and manage customer bills',
        file: 'pages/billing.html'
    }
};

/* Load HTML file into content area */
async function loadPage(pageName) {
    try {
        const response = await fetch(pageConfig[pageName].file);
        const html = await response.text();
        contentArea.innerHTML = html;
    } catch (error) {
        contentArea.innerHTML = `<p style="padding:24px;">Error loading page.</p>`;
        console.error(error);
    }
}

/* Set active sidebar + update header + load page */
function setActivePage(pageName) {
    // Sidebar active state
    menuItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Header update
    const config = pageConfig[pageName];
    if (!config) return;

    headerTitle.textContent = config.title;
    headerSubtitle.textContent = config.subtitle;

    // Load actual HTML page
    loadPage(pageName);

    console.log('Navigated to:', pageName);
}

/* Sidebar click handling */
menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const pageName = item.dataset.page;
        setActivePage(pageName);
    });
});

/* Initial load */
document.addEventListener('DOMContentLoaded', () => {
    setActivePage('dashboard'); // default page
});
