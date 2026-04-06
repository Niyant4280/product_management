document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
  });

  const statsContainer = document.getElementById('quoteStats');
  const recentList     = document.getElementById('recentQuotesList');
  let statusChart, revenueChart, forecastBarChart;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      firebase.auth().signOut().then(() => window.location.href = 'index.html');
    });
  }

  // =========================================
  // FEATURE #8 — REVENUE FORECASTING PANEL
  // =========================================
  const buildForecast = (quotes) => {
    const forecastPanel = document.getElementById('forecastPanel');
    if (!forecastPanel) return;

    const pending  = quotes.filter(q => (q.status || 'Pending') === 'Pending');
    const accepted = quotes.filter(q => q.status === 'Accepted');
    const rejected = quotes.filter(q => q.status === 'Rejected');
    const decided  = accepted.length + rejected.length;

    const pipelineValue    = pending.reduce((s, q) => s + (q.totalAmount || 0), 0);
    const wonRevenue       = accepted.reduce((s, q) => s + (q.totalAmount || 0), 0);
    const winRate          = decided > 0 ? (accepted.length / decided) : 0.5;
    const winRatePct       = Math.round(winRate * 100);
    const forecastedRevenue = pipelineValue * winRate;
    const avgDealSize      = accepted.length > 0 ? Math.round(wonRevenue / accepted.length) : 0;
    const pendingAvgDeal   = pending.length > 0 ? Math.round(pipelineValue / pending.length) : 0;

    // Win rate color
    const wColor = winRatePct >= 60 ? '#10b981' : winRatePct >= 35 ? '#f59e0b' : '#ef4444';

    forecastPanel.innerHTML = `
      <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;border-bottom:1px solid #f1f5f9;padding-bottom:1rem;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;">
            <i data-lucide="trending-up" style="width:18px;height:18px;color:white;"></i>
          </div>
          <div>
            <h3 style="margin:0;font-size:1.05rem;color:#1e293b;">Revenue Forecasting</h3>
            <p style="margin:0;font-size:0.8rem;color:#94a3b8;">Projected from current pipeline × historical win rate</p>
          </div>
        </div>

        <!-- KPI Row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">

          <div style="background:#f8fafc;border-radius:12px;padding:1rem;">
            <div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pipeline Value</div>
            <div style="font-size:1.5rem;font-weight:800;color:#1e293b;">₹${pipelineValue.toLocaleString('en-IN')}</div>
            <div style="font-size:0.78rem;color:#64748b;margin-top:4px;">${pending.length} open quote${pending.length !== 1 ? 's' : ''}</div>
          </div>

          <div style="background:#f8fafc;border-radius:12px;padding:1rem;">
            <div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Win Rate</div>
            <div style="font-size:1.5rem;font-weight:800;color:${wColor};">${winRatePct}%</div>
            <div style="font-size:0.78rem;color:#64748b;margin-top:4px;">${decided > 0 ? decided + ' decided quotes' : 'No decided quotes yet'}</div>
          </div>

          <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:12px;padding:1rem;border:1px solid #c4b5fd;">
            <div style="font-size:0.78rem;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Forecasted Revenue</div>
            <div style="font-size:1.5rem;font-weight:800;color:#6d28d9;">₹${forecastedRevenue.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
            <div style="font-size:0.78rem;color:#7c3aed;margin-top:4px;">From current pipeline</div>
          </div>

          <div style="background:#f8fafc;border-radius:12px;padding:1rem;">
            <div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Avg Deal Size</div>
            <div style="font-size:1.5rem;font-weight:800;color:#1e293b;">₹${avgDealSize.toLocaleString('en-IN')}</div>
            <div style="font-size:0.78rem;color:#64748b;margin-top:4px;">Accepted quotes</div>
          </div>

        </div>

        <!-- Win Rate Bar -->
        <div style="margin-bottom:1.25rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:0.83rem;font-weight:600;color:#475569;">Win Rate Progress</span>
            <span style="font-size:0.83rem;color:${wColor};font-weight:700;">${winRatePct}% (${accepted.length}W / ${rejected.length}L / ${pending.length}P)</span>
          </div>
          <div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden;position:relative;">
            <div style="height:100%;width:${winRatePct}%;background:linear-gradient(90deg,${wColor},${wColor}aa);border-radius:99px;transition:width 0.8s ease;"></div>
          </div>
        </div>

        <!-- Forecast Bar Chart -->
        <div style="position:relative;height:160px;margin-top:1rem;">
          <canvas id="forecastBarCanvas"></canvas>
        </div>
        <p style="font-size:0.75rem;color:#94a3b8;text-align:center;margin-top:0.5rem;">
          * Forecasted Revenue = Pipeline Value × Win Rate (${winRatePct}%). Based on ${quotes.length} total quotes.
        </p>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ nodes: forecastPanel.querySelectorAll('[data-lucide]') });

    // Forecast Bar Chart
    const fCtx = document.getElementById('forecastBarCanvas');
    if (fCtx) {
      if (forecastBarChart) forecastBarChart.destroy();
      forecastBarChart = new Chart(fCtx, {
        type: 'bar',
        data: {
          labels: [`Won Revenue`, `Pipeline`, `Forecasted`],
          datasets: [{
            data: [wonRevenue, pipelineValue, forecastedRevenue],
            backgroundColor: ['rgba(16,185,129,0.2)', 'rgba(99,102,241,0.2)', 'rgba(109,40,217,0.2)'],
            borderColor:     ['#10b981', '#6366f1', '#6d28d9'],
            borderWidth: 2, borderRadius: 8, borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => '  ₹' + ctx.parsed.x.toLocaleString('en-IN') } }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => '₹' + (v/1000).toFixed(0) + 'K', font: { family: 'Poppins', size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11, weight: '600' } } }
          }
        }
      });
    }
  };

  // Real-time onSnapshot (B10 — Chart.js replaces Flask)
  db.collection('quotes').onSnapshot(snapshot => {
    const quotes = [];
    const statusCounts = { Pending: 0, Accepted: 0, Rejected: 0 };
    const monthMap = {};
    let totalRevenue = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      quotes.push(data);
      const status = data.status || 'Pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Revenue from accepted
      if (status === 'Accepted') {
        const amt = data.totalAmount || (data.products || []).reduce((s, p) => s + ((p.price||0)*(p.quantity||1)), 0);
        totalRevenue += amt;
        const dateStr = data.acceptedAt || data.createdAt;
        if (dateStr) {
          const d = new Date(dateStr);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthMap[key] = (monthMap[key] || 0) + amt;
        }
      }
    });

    const conversionRate = quotes.length > 0 ? ((statusCounts.Accepted / quotes.length) * 100).toFixed(1) : 0;

    // ===== Stats Cards =====
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
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);"><i data-lucide="trending-up"></i></div>
          <div class="stat-info"><h4>Conversion Rate</h4><p>${conversionRate}%</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669);"><i data-lucide="dollar-sign"></i></div>
          <div class="stat-info"><h4>Total Revenue</h4><p>₹${totalRevenue.toLocaleString('en-IN')}</p></div>
        </div>
      `;
      lucide.createIcons();
    }

    // ===== Status Doughnut Chart =====
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
      if (statusChart) statusChart.destroy();
      statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Accepted', 'Rejected'],
          datasets: [{
            data: [statusCounts.Pending, statusCounts.Accepted, statusCounts.Rejected],
            backgroundColor: ['rgba(245,158,11,0.85)', 'rgba(16,185,129,0.85)', 'rgba(239,68,68,0.85)'],
            borderColor: ['#f59e0b', '#10b981', '#ef4444'],
            borderWidth: 2, hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { family: 'Poppins', size: 12 }, padding: 14 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} quotes` } }
          },
          cutout: '65%',
        }
      });
    }

    // ===== Revenue Trend Bar Chart (last 6 months) =====
    const revCtx = document.getElementById('revenueChart');
    if (revCtx) {
      if (revenueChart) revenueChart.destroy();
      const labels = [], values = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
        values.push(monthMap[key] || 0);
      }
      revenueChart = new Chart(revCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Revenue (₹)',
            data: values,
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderColor: '#6366f1',
            borderWidth: 2, borderRadius: 8, borderSkipped: false,
            hoverBackgroundColor: 'rgba(99,102,241,0.35)',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN') } } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => '₹' + v.toLocaleString('en-IN'), font: { family: 'Poppins', size: 11 } } },
            x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 } } }
          }
        }
      });
    }

    // ===== Recent Quotes List =====
    if (recentList) {
      const sorted = [...quotes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 10);
      if (sorted.length === 0) {
        recentList.innerHTML = '<p style="color:#94a3b8;padding:10px;">No quotes found.</p>';
        return;
      }
      const colorMap = { Accepted: '#10b981', Rejected: '#ef4444', Pending: '#f59e0b', Expired: '#64748b' };
      recentList.innerHTML = `<ul style="list-style:none;padding:0;">
        ${sorted.map(q => {
          const name = q.customer?.name || 'Unknown';
          const date = q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-IN') : '—';
          const amt  = q.totalAmount ? '₹' + q.totalAmount.toLocaleString('en-IN') : '—';
          const color = colorMap[q.status || 'Pending'];
          return `<li style="padding:12px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:600;color:#1e293b;">${name}</div>
              <div style="font-size:0.82rem;color:#94a3b8;">${date}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--primary);">${amt}</div>
              <span style="font-size:0.75rem;color:${color};font-weight:600;">${q.status || 'Pending'}</span>
            </div>
          </li>`;
        }).join('')}
      </ul>`;
    }

    // Feature #8 — Revenue Forecasting
    buildForecast(quotes);

  }, err => console.error("Quote analytics error:", err));
});
