document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) window.location.href = 'index.html';
  });

  const tableBody   = document.querySelector('#customerTable tbody');
  const searchInput = document.getElementById('customerSearch');
  const modal       = document.getElementById('customerModal');
  const form        = document.getElementById('customerForm');
  const addBtn      = document.getElementById('addCustomerBtn');
  const closeBtn    = document.getElementById('closeCustomerModal');
  const modalTitle  = document.getElementById('modalTitle');
  const logoutBtn   = document.getElementById('logoutBtn');
  let allCustomers  = [];
  let allQuotes     = [];

  // =========================================
  // RFM CALCULATION (Feature #5)
  // =========================================
  const calculateRFM = (customerEmail) => {
    const custQuotes = allQuotes.filter(q => (q.customer?.email || '') === customerEmail);
    if (custQuotes.length === 0) return { segment: 'No Activity', color: '#94a3b8', emoji: '○', totalQuotes: 0, totalValue: 0, daysSinceLast: null };

    const now = Date.now();
    const lastDate = custQuotes.reduce((latest, q) => {
      const d = q.createdAt ? new Date(q.createdAt).getTime() : 0;
      return d > latest ? d : latest;
    }, 0);

    const daysSinceLast  = Math.floor((now - lastDate) / 86400000);
    const totalQuotes    = custQuotes.length;
    const totalValue     = custQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0);
    const acceptedValue  = custQuotes.filter(q => q.status === 'Accepted').reduce((s, q) => s + (q.totalAmount || 0), 0);

    // RFM Scores (1-5)
    const rScore = daysSinceLast <= 7 ? 5 : daysSinceLast <= 30 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1;
    const fScore = totalQuotes >= 10 ? 5 : totalQuotes >= 5 ? 4 : totalQuotes >= 3 ? 3 : totalQuotes >= 2 ? 2 : 1;
    const mScore = acceptedValue >= 100000 ? 5 : acceptedValue >= 50000 ? 4 : acceptedValue >= 20000 ? 3 : acceptedValue >= 5000 ? 2 : acceptedValue > 0 ? 1 : 0;
    const avg = (rScore + fScore + (mScore || 1)) / 3;

    // Segment Rules
    let segment, color, emoji, tooltip;
    if (avg >= 4.2 && rScore >= 4 && fScore >= 4) {
      segment = 'Champion'; color = '#6366f1'; emoji = '🏆';
      tooltip = 'High value, frequent, and recent customer';
    } else if (avg >= 3.5) {
      segment = 'Loyal'; color = '#10b981'; emoji = '⭐';
      tooltip = 'Consistent customer with strong engagement';
    } else if (rScore >= 4 && fScore <= 2) {
      segment = 'New'; color = '#3b82f6'; emoji = '🆕';
      tooltip = 'Recently acquired, still exploring';
    } else if (rScore <= 2 && fScore >= 3) {
      segment = 'At Risk'; color = '#f59e0b'; emoji = '⚠️';
      tooltip = 'Was engaged but has gone quiet — follow up!';
    } else if (daysSinceLast > 180) {
      segment = 'Dormant'; color = '#64748b'; emoji = '💤';
      tooltip = 'No activity for 6+ months';
    } else {
      segment = 'Promising'; color = '#8b5cf6'; emoji = '🌱';
      tooltip = 'Growing relationship, nurture this one';
    }

    return { segment, color, emoji, tooltip, totalQuotes, totalValue, acceptedValue, daysSinceLast, rScore, fScore, mScore };
  };

  // =========================================
  // LOAD DATA (customers + quotes in parallel)
  // =========================================
  const loadAll = () => {
    Promise.all([
      new Promise(resolve => {
        db.collection('customers').orderBy('name').onSnapshot(snap => {
          allCustomers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          resolve();
          renderCustomers(allCustomers);
        }, err => { Toast.show('Error loading customers: ' + err.message, 'error'); resolve(); });
      }),
      db.collection('quotes').get()
    ]).then(([_, quoteSnap]) => {
      allQuotes = quoteSnap.docs.map(doc => doc.data());
      renderCustomers(allCustomers); // Re-render with RFM data
    }).catch(err => console.error('Error loading data:', err));
  };

  // =========================================
  // RENDER (with RFM badges)
  // =========================================
  const renderCustomers = (customers) => {
    tableBody.innerHTML = '';
    if (customers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#94a3b8;">No customers found.</td></tr>';
      return;
    }
    customers.forEach(cust => {
      const rfm = allQuotes.length > 0 ? calculateRFM(cust.email) : null;
      const tr  = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500;">${cust.name}</td>
        <td><a href="mailto:${cust.email}" style="color:var(--primary);text-decoration:none;">${cust.email}</a></td>
        <td>${cust.phone || '-'}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cust.address || '-'}</td>
        <td>
          ${rfm && rfm.totalQuotes > 0
            ? `<span class="rfm-badge" style="
                display:inline-flex;align-items:center;gap:5px;
                background:${rfm.color}18;border:1px solid ${rfm.color}40;
                color:${rfm.color};font-size:0.75rem;font-weight:700;
                padding:4px 10px;border-radius:20px;cursor:help;"
                title="${rfm.tooltip || ''} | Quotes: ${rfm.totalQuotes} | R:${rfm.rScore} F:${rfm.fScore} M:${rfm.mScore}">
                ${rfm.emoji} ${rfm.segment}
              </span>`
            : `<span style="color:#94a3b8;font-size:0.8rem;">No quotes</span>`}
        </td>
        <td class="actions" style="display:flex;gap:0.4rem;">
          <button class="edit-btn btn btn-outline btn-sm" data-id="${cust.id}">
            <i data-lucide="edit-2" style="width:13px;"></i> Edit
          </button>
          <button class="delete-btn btn btn-danger btn-sm" data-id="${cust.id}">
            <i data-lucide="trash-2" style="width:13px;"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    lucide.createIcons();
  };

  // =========================================
  // RFM LEGEND (injected into page)
  // =========================================
  const rfmLegend = document.getElementById('rfmLegend');
  if (rfmLegend) {
    const segments = [
      { emoji: '🏆', label: 'Champion', color: '#6366f1', desc: 'High value, frequent, recent' },
      { emoji: '⭐', label: 'Loyal',    color: '#10b981', desc: 'Consistent and engaged' },
      { emoji: '🆕', label: 'New',      color: '#3b82f6', desc: 'Recent, still early stage' },
      { emoji: '🌱', label: 'Promising',color: '#8b5cf6', desc: 'Growing relationship' },
      { emoji: '⚠️', label: 'At Risk',  color: '#f59e0b', desc: 'Was active, now quiet' },
      { emoji: '💤', label: 'Dormant',  color: '#64748b', desc: '6+ months no activity' },
    ];
    rfmLegend.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.75rem 1rem;background:#f8fafc;border-radius:var(--radius-md);margin-bottom:1rem;border:1px solid #e2e8f0;">
        <span style="font-size:0.78rem;font-weight:700;color:#64748b;align-self:center;margin-right:0.25rem;">RFM Segments:</span>
        ${segments.map(s => `
          <span title="${s.desc}" style="font-size:0.75rem;font-weight:600;padding:3px 8px;border-radius:12px;cursor:help;
            background:${s.color}15;border:1px solid ${s.color}30;color:${s.color};">
            ${s.emoji} ${s.label}
          </span>`).join('')}
      </div>
    `;
  }

  // =========================================
  // SEARCH
  // =========================================
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderCustomers(allCustomers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone || '').includes(term)
    ));
  });

  // =========================================
  // MODAL
  // =========================================
  const openModal = (editMode = false, data = {}) => {
    modal.style.display = 'flex';
    if (editMode) {
      modalTitle.innerText = 'Edit Customer';
      document.getElementById('customerId').value  = data.id;
      document.getElementById('custName').value    = data.name;
      document.getElementById('custEmail').value   = data.email;
      document.getElementById('custPhone').value   = data.phone || '';
      document.getElementById('custAddress').value = data.address || '';
    } else {
      modalTitle.innerText = 'Add Customer';
      form.reset();
      document.getElementById('customerId').value = '';
    }
  };

  addBtn.addEventListener('click', () => openModal(false));
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  // =========================================
  // FORM SUBMIT
  // =========================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id      = document.getElementById('customerId').value;
    const name    = document.getElementById('custName').value.trim();
    const email   = document.getElementById('custEmail').value.trim();
    const phone   = document.getElementById('custPhone').value.trim();
    const address = document.getElementById('custAddress').value.trim();

    if (!name || !email) { Toast.show('Name and Email are required.', 'warning'); return; }

    try {
      if (id) {
        await db.collection('customers').doc(id).update({ name, email, phone, address });
        Toast.show(`Customer "${name}" updated.`, 'success');
        if (window.logActivity) logActivity('update_customer', `Updated customer ${name}`);
      } else {
        await db.collection('customers').add({ name, email, phone, address });
        Toast.show(`Customer "${name}" added.`, 'success');
        if (window.logActivity) logActivity('add_customer', `Added customer ${name}`);
      }
      modal.style.display = 'none';
      form.reset();
    } catch (err) { Toast.show('Error: ' + err.message, 'error'); }
  });

  // =========================================
  // EDIT / DELETE
  // =========================================
  tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('edit-btn')) {
      const cust = allCustomers.find(c => c.id === id);
      if (cust) openModal(true, cust);
    }

    if (btn.classList.contains('delete-btn')) {
      const cust = allCustomers.find(c => c.id === id);
      const ok   = await Toast.confirm(`Delete "${cust?.name || 'this customer'}"?`, 'Delete');
      if (ok) {
        try {
          await db.collection('customers').doc(id).delete();
          Toast.show('Customer deleted.', 'success');
          if (window.logActivity) logActivity('delete_customer', `Deleted ${cust?.name || ''}`);
        } catch (err) { Toast.show('Error: ' + err.message, 'error'); }
      }
    }
  });

  // =========================================
  // LOGOUT
  // =========================================
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const ok = await Toast.confirm('Logout?', 'Logout');
      if (ok) firebase.auth().signOut().then(() => window.location.href = 'index.html');
    });
  }

  loadAll();
});
