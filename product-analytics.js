document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
  });

  const statsContainer = document.getElementById('productStats');
  const lowStockList = document.getElementById('lowStockList');
  let categoryChart, stockChart;

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      firebase.auth().signOut().then(() => window.location.href = 'index.html');
    });
  }

  // Fetch and render (B10 — Chart.js replaces Flask)
  db.collection('products').onSnapshot(snapshot => {
    const products = [];
    const lowStock = [];
    const categoryMap = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      products.push(data);
      if ((parseInt(data.stock) || 0) <= 5) lowStock.push(data);
      if (data.category) categoryMap[data.category] = (categoryMap[data.category] || 0) + 1;
    });

    const categories = new Set(products.map(p => p.category).filter(Boolean));
    const totalValue = products.reduce((s, p) => s + ((parseFloat(p.price)||0) * (parseInt(p.stock)||0)), 0);

    // ===== Stats Cards =====
    if (statsContainer) {
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
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669);"><i data-lucide="trending-up"></i></div>
          <div class="stat-info"><h4>Inventory Value</h4><p>₹${totalValue.toLocaleString('en-IN')}</p></div>
        </div>
      `;
      lucide.createIcons();
    }

    // ===== Category Bar Chart =====
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
      if (categoryChart) categoryChart.destroy();
      const cats = Object.keys(categoryMap);
      const vals = cats.map(c => categoryMap[c]);
      const colors = cats.map((_, i) => `hsl(${(i * 47 + 200) % 360}, 65%, 55%)`);

      categoryChart = new Chart(catCtx, {
        type: 'bar',
        data: {
          labels: cats,
          datasets: [{
            label: 'Products',
            data: vals,
            backgroundColor: colors.map(c => c.replace('55%', '80%').replace('hsl(', 'hsla(').replace(')', ', 0.2)')),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Poppins', size: 11 } }, grid: { color: '#f1f5f9' } },
            x: { ticks: { font: { family: 'Poppins', size: 11 } }, grid: { display: false } }
          }
        }
      });
    }

    // ===== Stock Doughnut Chart =====
    const stockCtx = document.getElementById('stockChart');
    if (stockCtx) {
      if (stockChart) stockChart.destroy();
      const available    = products.filter(p => p.status === 'Available').length;
      const outOfStock   = products.filter(p => p.status === 'Out of Stock').length;
      const discontinued = products.filter(p => p.status === 'Discontinued').length;

      stockChart = new Chart(stockCtx, {
        type: 'doughnut',
        data: {
          labels: ['Available', 'Out of Stock', 'Discontinued'],
          datasets: [{
            data: [available, outOfStock, discontinued],
            backgroundColor: ['rgba(16,185,129,0.85)', 'rgba(239,68,68,0.85)', 'rgba(100,116,139,0.85)'],
            borderColor: ['#10b981', '#ef4444', '#64748b'],
            borderWidth: 2,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { family: 'Poppins', size: 12 }, padding: 16 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} products` } }
          },
          cutout: '65%',
        }
      });
    }

    // ===== Low Stock List =====
    if (lowStockList) {
      if (lowStock.length === 0) {
        lowStockList.innerHTML = '<p style="color:#64748b;padding:10px;">✅ All products are well stocked.</p>';
      } else {
        lowStockList.innerHTML = `<ul style="list-style:none;padding:0;">
          ${lowStock.sort((a,b) => a.stock - b.stock).map(p => `
            <li style="padding:12px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:600;color:#1e293b;">${p.name}</div>
                <div style="font-size:0.82rem;color:#94a3b8;">${p.category}</div>
              </div>
              <div style="text-align:right;">
                <span style="color:#ef4444;font-weight:700;font-size:1rem;">${p.stock}</span>
                <span style="color:#94a3b8;font-size:0.78rem;"> left</span>
              </div>
            </li>`).join('')}
        </ul>`;
      }
    }

  }, err => console.error("Error fetching products:", err));
});
