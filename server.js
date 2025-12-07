import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dashboardRouter from './routes/dashboard-router.js';
import billingRouter from './routes/billing-router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const root = path.join(__dirname, 'public');

// Parse JSON bodies
app.use(express.json());

// Serve static assets from root directory (for css, js, pages folders)
app.use(express.static(__dirname));
app.use(express.static(root));

// Mount API router(s) BEFORE the SPA fallback
app.use('/api/dashboard', dashboardRouter);
app.use('/api/billing', billingRouter);

// SPA fallback: use a RegExp route to avoid path-to-regexp wildcard parsing issues.
// This matches any path that does NOT start with "/api"
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));