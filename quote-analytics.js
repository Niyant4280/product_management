document.addEventListener('DOMContentLoaded', () => {
  const statsContainer = document.getElementById('quoteStats');
  const recentList = document.getElementById('recentQuotesList');

  if (!db) {
    console.error("DB not initialized");
    return;
  }

  // Fetch Data
  db.collection('quotes').get()
    .then(snapshot => {
      const quotes = [];
      const statusCounts = { Pending: 0, Accepted: 0, Rejected: 0 };

      snapshot.forEach(doc => {
        const data = doc.data();
        quotes.push(data);

        const status = data.status || 'Pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // 1. Render Stat Cards
      if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
              <div class="stat-icon icon-indigo"><i data-lucide="file-text"></i></div>
              <div class="stat-info"><h4>Total Quotes</h4><p>${quotes.length}</p></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-emerald"><i data-lucide="check-circle"></i></div>
              <div class="stat-info"><h4>Accepted</h4><p>${statusCounts.Accepted}</p></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-rose"><i data-lucide="x-circle"></i></div>
              <div class="stat-info"><h4>Rejected</h4><p>${statusCounts.Rejected}</p></div>
            </div>
          `;
        lucide.createIcons();
      }

      // 2. Render Charts via Python Backend
      fetchAndRenderCharts(quotes);

      // 3. Render Recent Quotes List
      if (recentList) {
        renderRecentQuotes(quotes);
      }
    })
    .catch(err => {
      console.error("Error fetching quotes:", err);
    });

  async function fetchAndRenderCharts(quotes) {
    // 1. Status Breakdown
    try {
      const res = await fetch('/render/quote_status', {
        method: 'POST', body: JSON.stringify({ quotes }), headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const img = document.getElementById('statusChartReq');
        if (img) img.src = url;
      }
    } catch (err) { console.error("Status Chart Error:", err); }

    // 2. Revenue Trend
    try {
      const res = await fetch('/render/revenue_trend', {
        method: 'POST', body: JSON.stringify({ quotes }), headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const img = document.getElementById('revenueChartReq');
        if (img) img.src = url;
      }
    } catch (err) { console.error("Revenue Chart Error:", err); }

    // 3. Top Products
    try {
      const res = await fetch('/render/top_products', {
        method: 'POST', body: JSON.stringify({ quotes }), headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const img = document.getElementById('topProductsChartReq');
        if (img) img.src = url;
      }
    } catch (err) { console.error("Top Products Chart Error:", err); }
  }

  function renderRecentQuotes(quotes) {
    const sorted = [...quotes].reverse().slice(0, 10);

    let html = '<ul style="list-style: none; padding: 0;">';

    if (sorted.length === 0) {
      html = '<p class="text-muted" style="padding:10px;">No quotes found.</p>';
    } else {
      sorted.forEach(q => {
        const name = q.customer ? q.customer.name : 'Unknown Customer';
        let dateStr = 'No Date';
        if (q.createdAt) {
          dateStr = new Date(q.createdAt).toLocaleDateString();
        } else if (q.date) {
          dateStr = new Date(q.date).toLocaleDateString();
        }

        const amt = q.grandTotal ? '₹' + q.grandTotal : '-';

        let badgeColor = '#f59e0b'; // pending
        if (q.status === 'Accepted') badgeColor = '#10b981';
        if (q.status === 'Rejected') badgeColor = '#ef4444';

        html += `
            <li style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 600; color: var(--text-main);">${name}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; color: var(--primary);">${amt}</div>
                <span style="font-size: 0.75rem; color: ${badgeColor}; font-weight: 600;">${q.status || 'Pending'}</span>
              </div>
            </li>
          `;
      });
      html += '</ul>';
    }

    recentList.innerHTML = html;
  }
});
