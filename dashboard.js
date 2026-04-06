document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) window.location.href = 'index.html';
  });

  const tableBody = document.querySelector('#productTable tbody');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const searchInput = document.getElementById('productSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const sortBy = document.getElementById('sortBy');
  let allProducts = [];

  // =========================================
  // ANIMATED NUMBER COUNTER (B3)
  // =========================================
  const animateCount = (el, targetValue, prefix = '', suffix = '', duration = 900) => {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    el.classList.add('counting');

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * targetValue);
      el.innerText = prefix + current.toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else {
        el.innerText = prefix + targetValue.toLocaleString('en-IN') + suffix;
        el.classList.remove('counting');
      }
    };
    requestAnimationFrame(step);
  };

  // =========================================
  // STATS UPDATE WITH ANIMATION
  // =========================================
  const updateProductStats = (products) => {
    let lowStockCount = 0;
    let inventoryValue = 0;
    const lowStockItems = [];

    products.forEach(doc => {
      const data = doc.data ? doc.data() : doc;
      const stock = parseInt(data.stock) || 0;
      const price = parseFloat(data.price) || 0;
      if (stock <= 5) {
        lowStockCount++;
        lowStockItems.push({ name: data.name, stock });
      }
      inventoryValue += price * stock;
    });

    const elTotal = document.getElementById('statTotalProducts');
    const elLow   = document.getElementById('statLowStock');
    const elValue = document.getElementById('statInventoryValue');

    animateCount(elTotal, products.length);
    animateCount(elLow,   lowStockCount);
    // For currency, animate the number only
    if (elValue) {
      const numEl = elValue;
      const startTime = performance.now();
      numEl.classList.add('counting');
      const step = (t) => {
        const p = Math.min((t - startTime) / 900, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        numEl.innerText = '₹' + Math.floor(eased * inventoryValue).toLocaleString('en-IN');
        if (p < 1) requestAnimationFrame(step);
        else { numEl.innerText = '₹' + inventoryValue.toLocaleString('en-IN'); numEl.classList.remove('counting'); }
      };
      requestAnimationFrame(step);
    }

    // Update low-stock banner (B4)
    updateLowStockBanner(lowStockItems);
  };

  // =========================================
  // LOW-STOCK ALERT BANNER (B4)
  // =========================================
  const updateLowStockBanner = (lowStockItems) => {
    const banner = document.getElementById('lowStockBanner');
    if (!banner) return;

    if (lowStockItems.length === 0) {
      banner.style.display = 'none';
      return;
    }

    // Check if user already dismissed this session
    const dismissedKey = 'lowstock-dismissed-' + new Date().toDateString();
    if (sessionStorage.getItem(dismissedKey)) {
      banner.style.display = 'none';
      return;
    }

    const names = lowStockItems.slice(0, 4).map(p => `<strong>${p.name}</strong> (${p.stock} left)`).join(', ');
    const extra = lowStockItems.length > 4 ? ` and ${lowStockItems.length - 4} more...` : '';

    banner.innerHTML = `
      <div class="low-stock-banner">
        <i data-lucide="alert-triangle"></i>
        <div class="low-stock-banner-text">
          <strong>⚠️ Low Stock Alert — ${lowStockItems.length} product${lowStockItems.length > 1 ? 's' : ''} running low</strong>
          <p>${names}${extra}</p>
        </div>
        <button class="low-stock-dismiss" title="Dismiss" onclick="
          sessionStorage.setItem('lowstock-dismissed-${new Date().toDateString()}', '1');
          this.closest('#lowStockBanner').style.display='none';
        ">&times;</button>
      </div>
    `;
    banner.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  };

  // =========================================
  // PENDING QUOTES COUNT
  // =========================================
  const fetchPendingQuotesStats = () => {
    db.collection("quotes").where("status", "==", "Pending").get()
      .then(snap => {
        const elPending = document.getElementById('statPendingQuotes');
        if (elPending) animateCount(elPending, snap.size);
      })
      .catch(err => console.error("Error fetching quotes stats:", err));
  };

  // =========================================
  // RECENT ACTIVITY
  // =========================================
  const fetchRecentActivity = () => {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer) return;

    db.collection("activity_log")
      .orderBy("timestamp", "desc")
      .limit(10)
      .onSnapshot(snap => {
        logContainer.innerHTML = '';
        if (snap.empty) {
          logContainer.innerHTML = '<p class="text-muted text-sm">No recent activity.</p>';
          return;
        }
        snap.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp ? data.timestamp.toDate() : new Date();
          const timeAgo = window.timeSince ? timeSince(date) : '—';
          const icon = window.getActionIcon ? getActionIcon(data.action) : 'activity';

          const div = document.createElement('div');
          div.className = 'activity-item';
          div.innerHTML = `
            <div class="activity-icon">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="activity-details">
              <p><strong>${data.user || 'User'}</strong> ${data.description}</p>
              <span class="activity-time">${timeAgo} ago</span>
            </div>
          `;
          logContainer.appendChild(div);
        });
        lucide.createIcons();
      });
  };

  // =========================================
  // REVENUE TREND CHART (B7 — Chart.js)
  // =========================================
  const buildRevenueChart = () => {
    db.collection("quotes").where("status", "==", "Accepted").get()
      .then(snap => {
        const monthMap = {};

        snap.forEach(doc => {
          const data = doc.data();
          const dateStr = data.acceptedAt || data.createdAt;
          if (!dateStr) return;
          const date = new Date(dateStr);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const amount = data.totalAmount || (data.products || []).reduce((s, p) => s + (p.price * (p.quantity || 1)), 0);
          monthMap[key] = (monthMap[key] || 0) + amount;
        });

        // Build last 6 months
        const labels = [];
        const values = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
          values.push(monthMap[key] || 0);
        }

        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Revenue (₹)',
              data: values,
              backgroundColor: 'rgba(99,102,241,0.15)',
              borderColor: '#6366f1',
              borderWidth: 2,
              borderRadius: 8,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(99,102,241,0.35)',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN')
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: {
                  callback: val => '₹' + val.toLocaleString('en-IN'),
                  font: { family: 'Poppins', size: 11 }
                }
              },
              x: {
                grid: { display: false },
                ticks: { font: { family: 'Poppins', size: 11 } }
              }
            }
          }
        });
      })
      .catch(err => console.error("Revenue chart error:", err));
  };

  // =========================================
  // RENDER PRODUCTS WITH STATUS BADGES (A5)
  // =========================================
  const getStatusBadge = (status) => {
    const map = {
      'Available':    'status-available',
      'Out of Stock': 'status-out-of-stock',
      'Discontinued': 'status-discontinued',
    };
    const cls = map[status] || 'status-discontinued';
    return `<span class="status-badge ${cls}">${status}</span>`;
  };

  const renderProducts = (products) => {
    tableBody.innerHTML = "";
    products.forEach(doc => {
      const data = doc.data ? doc.data() : doc;
      const id = doc.id || data.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="rowCheckbox" data-id="${id}"></td>
        <td class="product-name" data-id="${id}" style="cursor:pointer; color:var(--primary); font-weight:500;">${data.name}</td>
        <td class="product-price">₹${parseFloat(data.price).toLocaleString('en-IN')}</td>
        <td class="product-category">${data.category}</td>
        <td class="product-stock" style="${parseInt(data.stock) <= 5 ? 'color:#ef4444;font-weight:700;' : ''}">${data.stock}</td>
        <td class="product-status">${getStatusBadge(data.status)}</td>
        <td class="actions">
          <button class="edit-btn btn btn-outline btn-sm" data-id="${id}">Edit</button>
          <button class="delete-btn btn btn-danger btn-sm" data-id="${id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    updateProductStats(products);
  };

  // =========================================
  // CSV EXPORT
  // =========================================
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!allProducts || allProducts.length === 0) {
        Toast.show('No products to export.', 'warning');
        return;
      }
      const headers = ["ID", "Name", "Category", "Price", "Stock", "Status"];
      const rows = allProducts.map(doc => {
        const data = doc.data ? doc.data() : doc;
        return [doc.id, `"${(data.name || '').replace(/"/g, '""')}"`,
          `"${(data.category || '').replace(/"/g, '""')}"`,
          data.price, data.stock, `"${data.status || ''}"`];
      });
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Toast.show('Products exported to CSV!', 'success');
    });
  }

  // =========================================
  // FILTER & RENDER
  // =========================================
  const filterAndRender = () => {
    let filtered = allProducts;
    const search = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;
    const sort = sortBy ? sortBy.value : '';

    if (search)    filtered = filtered.filter(d => (d.data ? d.data().name : d.name).toLowerCase().includes(search));
    if (category)  filtered = filtered.filter(d => (d.data ? d.data().category : d.category) === category);
    if (status)    filtered = filtered.filter(d => (d.data ? d.data().status : d.status) === status);
    if (sort) {
      filtered = [...filtered].sort((a, b) => {
        const get = (doc, key) => doc.data ? doc.data()[key] : doc[key];
        if (sort === 'name-asc')   return get(a,'name').localeCompare(get(b,'name'));
        if (sort === 'name-desc')  return get(b,'name').localeCompare(get(a,'name'));
        if (sort === 'price-asc')  return get(a,'price') - get(b,'price');
        if (sort === 'price-desc') return get(b,'price') - get(a,'price');
        if (sort === 'stock-asc')  return get(a,'stock') - get(b,'stock');
        if (sort === 'stock-desc') return get(b,'stock') - get(a,'stock');
        return 0;
      });
    }
    renderProducts(filtered);
  };

  searchInput    && searchInput.addEventListener('input', filterAndRender);
  categoryFilter && categoryFilter.addEventListener('change', filterAndRender);
  statusFilter   && statusFilter.addEventListener('change', filterAndRender);
  sortBy         && sortBy.addEventListener('change', filterAndRender);

  // =========================================
  // INLINE EDIT
  // =========================================
  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const id = target.dataset.id;
    const row = target.closest('tr');
    if (!row) return;

    if (target.classList.contains('edit-btn')) {
      if (target.innerText === "Edit") {
        const nameEl = row.querySelector('.product-name');
        const priceEl = row.querySelector('.product-price');
        const catEl = row.querySelector('.product-category');
        const stockEl = row.querySelector('.product-stock');
        const statusEl = row.querySelector('.product-status');

        nameEl.innerHTML   = `<input type="text" class="edit-name" value="${nameEl.innerText}">`;
        priceEl.innerHTML  = `<input type="number" class="edit-price" value="${parseFloat(priceEl.innerText.replace('₹','').replace(/,/g,''))}">`;
        catEl.innerHTML    = `<input type="text" class="edit-category" value="${catEl.innerText}">`;
        stockEl.innerHTML  = `<input type="number" class="edit-stock" value="${stockEl.innerText}">`;
        statusEl.innerHTML = `
          <select class="edit-status">
            <option value="Available">Available</option>
            <option value="Out of Stock">Out of Stock</option>
            <option value="Discontinued">Discontinued</option>
          </select>`;

        // Set current status
        const currentStatus = statusEl.querySelector('.edit-status');
        const allStatuses = ['Available','Out of Stock','Discontinued'];
        const found = allStatuses.find(s => row.querySelector('.status-badge')?.className.includes(s.toLowerCase().replace(/ /g,'-')));
        if (found) currentStatus.value = found;

        target.innerText = "Save";
        if (!row.querySelector('.cancel-btn')) {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'cancel-btn btn btn-outline btn-sm';
          cancelBtn.innerText = 'Cancel';
          cancelBtn.dataset.id = id;
          row.querySelector('.actions').appendChild(cancelBtn);
        }

        // Auto-set out of stock when stock = 0
        setTimeout(() => {
          const stockInput = row.querySelector('.edit-stock');
          const statusSelect = row.querySelector('.edit-status');
          if (stockInput && statusSelect) {
            stockInput.addEventListener('input', () => {
              if (parseInt(stockInput.value) === 0) { statusSelect.value = 'Out of Stock'; statusSelect.disabled = true; }
              else statusSelect.disabled = false;
            });
            if (parseInt(stockInput.value) === 0) { statusSelect.value = 'Out of Stock'; statusSelect.disabled = true; }
          }
        }, 0);

      } else if (target.innerText === "Save") {
        const newName     = row.querySelector('.edit-name').value.trim();
        const newPrice    = parseFloat(row.querySelector('.edit-price').value);
        const newCategory = row.querySelector('.edit-category').value.trim();
        const newStock    = parseInt(row.querySelector('.edit-stock').value);
        let newStatus     = row.querySelector('.edit-status').value;
        if (newStock === 0) newStatus = 'Out of Stock';

        if (newName && !isNaN(newPrice) && newCategory && !isNaN(newStock)) {
          try {
            await db.collection("products").doc(id).update({ name: newName, price: newPrice, category: newCategory, stock: newStock, status: newStatus });
            Toast.show(`"${newName}" updated successfully!`, 'success');
            if (window.logActivity) logActivity('update_product', `Updated product ${newName}`);
          } catch (err) {
            Toast.show('Error updating product: ' + err.message, 'error');
          }
        } else {
          Toast.show('Please fill all fields correctly.', 'warning');
        }
      }
    }

    if (target.classList.contains('cancel-btn')) {
      const docSnap = await db.collection("products").doc(id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const nameEl = row.querySelector('.product-name');
        nameEl.innerHTML   = data.name;
        row.querySelector('.product-price').innerHTML    = '₹' + parseFloat(data.price).toLocaleString('en-IN');
        row.querySelector('.product-category').innerHTML = data.category;
        row.querySelector('.product-stock').innerHTML    = data.stock;
        row.querySelector('.product-status').innerHTML   = getStatusBadge(data.status);
        target.remove();
        row.querySelector('.edit-btn').innerText = "Edit";
      }
    }

    if (target.classList.contains('delete-btn')) {
      const confirmed = await Toast.confirm('Are you sure you want to delete this product?', 'Delete');
      if (confirmed) {
        try {
          await db.collection("products").doc(id).delete();
          Toast.show('Product deleted.', 'success');
          if (window.logActivity) logActivity('delete_product', `Deleted product`);
        } catch (err) {
          Toast.show('Error deleting: ' + err.message, 'error');
        }
      }
    }

    // Product detail modal
    if (target.classList.contains('product-name')) {
      const docSnap = await db.collection("products").doc(id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
          <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
            <tr><td style="padding:8px; color:#64748b; font-weight:600;">Name</td><td style="padding:8px;">${data.name}</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:8px; color:#64748b; font-weight:600;">Price</td><td style="padding:8px;">₹${parseFloat(data.price).toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding:8px; color:#64748b; font-weight:600;">Category</td><td style="padding:8px;">${data.category}</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:8px; color:#64748b; font-weight:600;">Stock</td><td style="padding:8px;">${data.stock}</td></tr>
            <tr><td style="padding:8px; color:#64748b; font-weight:600;">Status</td><td style="padding:8px;">${getStatusBadge(data.status)}</td></tr>
          </table>
        `;
        document.getElementById('productModal').style.display = 'flex';
        lucide.createIcons();
      }
    }
  });

  // Modal close
  document.querySelector('#productModal .close').addEventListener('click', () => {
    document.getElementById('productModal').style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (e.target === modal) modal.style.display = 'none';
  });

  // =========================================
  // BULK DELETE
  // =========================================
  bulkDeleteBtn.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.rowCheckbox:checked');
    if (selected.length === 0) { Toast.show('Please select at least one product.', 'warning'); return; }
    const confirmed = await Toast.confirm(`Delete ${selected.length} selected product(s)?`, 'Delete All');
    if (confirmed) {
      let failed = 0;
      for (const box of selected) {
        try { await db.collection("products").doc(box.dataset.id).delete(); }
        catch { failed++; }
      }
      if (failed === 0) Toast.show(`${selected.length} product(s) deleted.`, 'success');
      else Toast.show(`${failed} item(s) failed to delete.`, 'error');
      if (window.logActivity) logActivity('delete_product', `Bulk deleted ${selected.length} products`);
    }
  });

  selectAllCheckbox.addEventListener('change', (e) => {
    document.querySelectorAll('.rowCheckbox').forEach(cb => cb.checked = e.target.checked);
  });

  // =========================================
  // LOAD PRODUCTS
  // =========================================
  const loadProducts = () => {
    db.collection("products").onSnapshot(snapshot => {
      allProducts = [];
      const categories = new Set();
      snapshot.forEach(doc => {
        allProducts.push(doc);
        const data = doc.data();
        if (data && data.category) categories.add(data.category);
      });
      if (categoryFilter) {
        const current = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        Array.from(categories).sort().forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat; opt.textContent = cat;
          categoryFilter.appendChild(opt);
        });
        if (current && Array.from(categories).includes(current)) categoryFilter.value = current;
      }
      filterAndRender();
    }, err => console.error('Failed to load products:', err));
  };

  // =========================================
  // INIT
  // =========================================
  fetchPendingQuotesStats();
  fetchRecentActivity();
  buildRevenueChart();
  loadProducts();
});

// ===================== NAVIGATION =====================
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const confirmed = await Toast.confirm('Are you sure you want to logout?', 'Logout');
  if (confirmed) {
    firebase.auth().signOut()
      .then(() => window.location.href = "index.html")
      .catch(err => Toast.show("Logout Failed: " + err.message, 'error'));
  }
});

document.getElementById('createQuoteBtn').addEventListener('click', () => window.location.href = "quote.html");

const profileBtn = document.getElementById('profileBtn');
if (profileBtn) profileBtn.addEventListener('click', () => window.location.href = 'profile.html');

const productAnalyticsBtn = document.getElementById('productAnalyticsBtn');
if (productAnalyticsBtn) productAnalyticsBtn.addEventListener('click', () => window.location.href = 'product-analytics.html');

const quoteAnalyticsBtn = document.getElementById('quoteAnalyticsBtn');
if (quoteAnalyticsBtn) quoteAnalyticsBtn.addEventListener('click', () => window.location.href = 'quote-analytics.html');

const addProductBtn = document.getElementById('addProductBtn');
if (addProductBtn) addProductBtn.addEventListener('click', () => window.location.href = 'add-product.html');
