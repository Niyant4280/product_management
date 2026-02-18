document.addEventListener('DOMContentLoaded', () => {
  const statsContainer = document.getElementById('productStats');
  const lowStockList = document.getElementById('lowStockList');

  if (!db) {
    console.error("Firebase DB not initialized");
    return;
  }

  // Fetch Data
  db.collection('products').get()
    .then(snapshot => {
      const products = [];
      let lowStock = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        products.push(data);

        if ((parseInt(data.stock) || 0) <= 5) {
          lowStock.push(data);
        }
      });

      // 1. Render Stats Cards (Client-side)
      const categories = new Set(products.map(p => p.category));

      statsContainer.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon icon-purple"><i data-lucide="package"></i></div>
            <div class="stat-info"><h4>Total Products</h4><p>${products.length}</p></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon icon-blue"><i data-lucide="layers"></i></div>
            <div class="stat-info"><h4>Categories</h4><p>${categories.size}</p></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon icon-amber"><i data-lucide="alert-triangle"></i></div>
            <div class="stat-info"><h4>Low Stock</h4><p>${lowStock.length}</p></div>
          </div>
        `;
      lucide.createIcons();

      // 2. Render Charts via Python Backend
      fetchAndRenderCharts(products);

      // 3. Render Low Stock List
      if (lowStock.length === 0) {
        lowStockList.innerHTML = '<p style="color: #64748b; padding: 10px;">All products are well stocked.</p>';
      } else {
        let html = '<ul style="list-style: none; padding: 0;">';
        lowStock.forEach(p => {
          html += `
              <li style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <span>${p.name}</span>
                <span style="color: #ef4444; font-weight: 700;">${p.stock} left</span>
              </li>`;
        });
        html += '</ul>';
        lowStockList.innerHTML = html;
      }
    })
    .catch(error => {
      console.error("Error fetching products:", error);
    });

  async function fetchAndRenderCharts(products) {
    try {
      // Category Chart
      const catRes = await fetch('/render/product_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
      if (catRes.ok) {
        const blob = await catRes.blob();
        const url = URL.createObjectURL(blob);
        const img = document.querySelector('img[alt="Products by Category Chart"]');
        if (img) img.src = url;
      }

      // Stock Chart
      const stockRes = await fetch('/render/product_stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
      if (stockRes.ok) {
        const blob = await stockRes.blob();
        const url = URL.createObjectURL(blob);
        const img = document.querySelector('img[alt="Stock Distribution Chart"]');
        if (img) img.src = url;
      }

    } catch (err) {
      console.error("Error rendering charts via Python:", err);
    }
  }
});
