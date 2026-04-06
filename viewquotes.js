document.addEventListener('DOMContentLoaded', () => {
  // ========= Auth Guard =========
  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
  });

  const quoteList      = document.getElementById('quoteList');
  const quoteSearch    = document.getElementById('quoteSearch');
  const quoteDateFilter = document.getElementById('quoteDateFilter');
  const tabBtns        = document.querySelectorAll('.tab-btn');
  let currentTab = 'Pending';
  let allQuotes  = [];
  let countdownTimer = null;

  // ========= Tab Logic =========
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      filterAndRenderQuotes();
    });
  });

  // ========= Status Badge =========
  const statusBadge = (status) => {
    const cls = {
      Pending:  'status-pending',
      Accepted: 'status-accepted',
      Rejected: 'status-rejected',
      Expired:  'status-out-of-stock',
    };
    return `<span class="status-badge ${cls[status] || 'status-pending'}">${status}</span>`;
  };

  // ========= Countdown Helper =========
  const formatCountdown = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return { text: 'Expired', color: '#ef4444', urgent: true };
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000)  / 60000);
    const secs  = Math.floor((diff % 60000)    / 1000);
    const text  = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m ${secs}s`;
    const color = days <= 2 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#10b981';
    return { text, color, urgent: days <= 2 };
  };

  const startCountdowns = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      document.querySelectorAll('.quote-countdown').forEach(el => {
        const exp = el.dataset.expires;
        if (!exp) { el.textContent = 'No expiry'; return; }
        const info = formatCountdown(exp);
        if (info) {
          el.textContent = info.text;
          el.style.color  = info.color;
          if (info.urgent) el.style.fontWeight = '700';
        }
      });
    }, 1000);
  };

  // ========= Auto-Expire Quotes (A7) =========
  const checkAndExpireQuotes = async (quotes) => {
    const now = new Date();
    for (const q of quotes) {
      if ((q.data.status || 'Pending') === 'Pending' && q.data.expiresAt && new Date(q.data.expiresAt) < now) {
        try {
          await db.collection('quotes').doc(q.id).update({ status: 'Expired', expiredAt: now.toISOString() });
        } catch (e) { console.warn('Failed to expire quote:', e); }
      }
    }
  };

  // ========= Render Quote Card =========
  function renderQuote(quoteData, quoteId) {
    const div = document.createElement('div');
    div.className = 'quote-card';
    div.dataset.id = quoteId;

    const cust     = quoteData.customer || {};
    const status   = quoteData.status || 'Pending';
    const products = quoteData.products || [];
    const total    = quoteData.totalAmount || products.reduce((s, p) => s + ((p.price||0) * (p.quantity||1)), 0);
    const createdDate = quoteData.createdAt
      ? new Date(quoteData.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      : 'N/A';

    // Countdown data
    const countdownInfo = (status === 'Pending') ? formatCountdown(quoteData.expiresAt) : null;
    const expiresLabel  = quoteData.expiresAt
      ? `Expires: ${new Date(quoteData.expiresAt).toLocaleDateString('en-IN')}`
      : 'No expiry set';

    div.innerHTML = `
      <div class="quote-header-row">
        <div>
          <div class="quote-id">Quote #${quoteId.slice(-8).toUpperCase()}</div>
          <div style="font-size:0.8rem;color:#94a3b8;margin-top:2px;">${createdDate}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
          ${statusBadge(status)}
          ${status === 'Pending' ? `
            <div style="display:flex;align-items:center;gap:4px;background:${countdownInfo?.urgent ? '#fee2e2' : '#f0fdf4'};padding:4px 10px;border-radius:20px;font-size:0.78rem;">
              <i data-lucide="clock" style="width:12px;height:12px;color:${countdownInfo?.color || '#10b981'};"></i>
              <span class="quote-countdown"
                data-expires="${quoteData.expiresAt || ''}"
                style="color:${countdownInfo?.color || '#10b981'};font-weight:600;">
                ${countdownInfo ? countdownInfo.text : expiresLabel}
              </span>
            </div>` : ''}
        </div>
      </div>

      <div class="customer-grid">
        <div class="customer-item"><span>Client</span><strong>${cust.name || 'N/A'}</strong></div>
        <div class="customer-item"><span>Email</span><strong>${cust.email || 'N/A'}</strong></div>
        <div class="customer-item"><span>Phone</span><strong>${cust.phone || cust.mobile || 'N/A'}</strong></div>
        <div class="customer-item"><span>Address</span><strong>${cust.address || 'N/A'}</strong></div>
      </div>

      <table class="quote-items-table">
        <thead>
          <tr><th>Product</th><th>Category</th><th>Price (₹)</th><th>Qty</th><th>Total (₹)</th></tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.name || 'N/A'}</td>
              <td>${p.category || 'N/A'}</td>
              <td>₹${(p.price || 0).toLocaleString('en-IN')}</td>
              <td>${p.quantity || 1}</td>
              <td>₹${((p.price || 0) * (p.quantity || 1)).toLocaleString('en-IN')}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No products</td></tr>'}
        </tbody>
      </table>

      <div class="quote-footer">
        <strong>Total: ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
      </div>

      <div class="action-row">
        <button class="btn btn-outline btn-sm pdf-btn" data-id="${quoteId}">
          <i data-lucide="file-text" style="width:15px;height:15px;"></i> PDF
        </button>
        <button class="btn btn-outline btn-sm email-btn" data-id="${quoteId}" title="Email this quote to customer">
          <i data-lucide="mail" style="width:15px;height:15px;"></i> Email
        </button>
        ${status === 'Pending' ? `
          <button class="btn btn-success btn-sm accept-btn" data-id="${quoteId}">
            <i data-lucide="check" style="width:15px;height:15px;"></i> Accept
          </button>
          <button class="btn btn-danger btn-sm reject-btn" data-id="${quoteId}">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Reject
          </button>
        ` : ''}
        ${status === 'Accepted' ? `<span style="color:#10b981;font-weight:600;align-self:center;font-size:0.9rem;">✓ Accepted</span>` : ''}
        ${status === 'Rejected' ? `<span style="color:#ef4444;font-weight:600;align-self:center;font-size:0.9rem;">✗ Rejected${quoteData.rejectionReason ? ` — "${quoteData.rejectionReason}"` : ''}</span>` : ''}
        ${status === 'Expired'  ? `<span style="color:#64748b;font-weight:600;align-self:center;font-size:0.9rem;">⌛ Expired</span>` : ''}
      </div>
    `;
    quoteList.appendChild(div);
  }

  // ========= Filter & Render =========
  function filterAndRenderQuotes() {
    let filtered = allQuotes;
    const search = quoteSearch    ? quoteSearch.value.trim().toLowerCase() : '';
    const date   = quoteDateFilter ? quoteDateFilter.value : '';

    if (search) filtered = filtered.filter(q => (q.data.customer?.name || '').toLowerCase().includes(search));
    if (date)   filtered = filtered.filter(q => q.data.createdAt && q.data.createdAt.startsWith(date));
    if (currentTab !== 'All') filtered = filtered.filter(q => (q.data.status || 'Pending') === currentTab);

    filtered.sort((a, b) => (b.data.createdAt || '').localeCompare(a.data.createdAt || ''));

    quoteList.innerHTML = '';
    if (filtered.length === 0) {
      quoteList.innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;">
        <i data-lucide="inbox" style="width:48px;height:48px;margin-bottom:1rem;"></i>
        <p>No ${currentTab === 'All' ? '' : currentTab.toLowerCase()} quotes found.</p>
      </div>`;
    } else {
      filtered.forEach(q => renderQuote(q.data, q.id));
    }
    lucide.createIcons();
    attachActionListeners();
    startCountdowns();
  }

  // ========= Real-time onSnapshot =========
  db.collection('quotes').onSnapshot(snapshot => {
    allQuotes = [];
    snapshot.forEach(doc => allQuotes.push({ id: doc.id, data: doc.data() }));
    checkAndExpireQuotes(allQuotes);
    filterAndRenderQuotes();
  }, err => {
    quoteList.innerHTML = `<p style="color:#ef4444;">Error loading quotes: ${err.message}</p>`;
  });

  quoteSearch     && quoteSearch.addEventListener('input', filterAndRenderQuotes);
  quoteDateFilter && quoteDateFilter.addEventListener('change', filterAndRenderQuotes);

  // ========= Action Listeners =========
  function attachActionListeners() {
    document.querySelectorAll('.accept-btn').forEach(btn => { btn.onclick = () => acceptQuote(btn.dataset.id); });
    document.querySelectorAll('.reject-btn').forEach(btn => { btn.onclick = () => rejectQuote(btn.dataset.id); });
    document.querySelectorAll('.pdf-btn').forEach(btn    => { btn.onclick = () => downloadQuotePDF(btn.dataset.id); });
    document.querySelectorAll('.email-btn').forEach(btn  => { btn.onclick = () => emailQuote(btn.dataset.id); });
  }

  // ========= Accept =========
  window.acceptQuote = async (quoteId) => {
    const confirmed = await Toast.confirm('Accept this quote?', 'Accept');
    if (!confirmed) return;
    try {
      await db.collection('quotes').doc(quoteId).update({ status: 'Accepted', acceptedAt: new Date().toISOString() });
      Toast.show('Quote accepted!', 'success');
      if (window.logActivity) logActivity('update_quote', `Accepted quote #${quoteId.slice(-8)}`);
    } catch (err) { Toast.show('Error: ' + err.message, 'error'); }
  };

  // ========= Reject (with reason modal) =========
  window.rejectQuote = async (quoteId) => {
    const reason    = await Toast.prompt('Provide a rejection reason (optional):', 'e.g. Price too high...', 'Reject Quote');
    const confirmed = await Toast.confirm('Permanently reject this quote?', 'Reject');
    if (!confirmed) return;
    try {
      const data = { status: 'Rejected', rejectedAt: new Date().toISOString() };
      if (reason) data.rejectionReason = reason;
      await db.collection('quotes').doc(quoteId).update(data);
      Toast.show('Quote rejected.', 'info');
      if (window.logActivity) logActivity('update_quote', `Rejected quote #${quoteId.slice(-8)}`);
    } catch (err) { Toast.show('Error: ' + err.message, 'error'); }
  };

  // ========= Email Quote (Feature #1 — EmailJS) =========
  window.emailQuote = async (quoteId) => {
    const quote = allQuotes.find(q => q.id === quoteId);
    if (!quote) { Toast.show('Quote not found.', 'error'); return; }

    // Check setup
    const cfg = window.EMAILJS_CONFIG;
    const isConfigured = cfg && cfg.publicKey && cfg.publicKey !== 'YOUR_PUBLIC_KEY';

    if (!isConfigured) {
      showEmailSetupModal();
      return;
    }

    const d    = quote.data;
    const cust = d.customer || {};
    if (!cust.email) { Toast.show('This quote has no customer email address.', 'warning'); return; }

    const confirmed = await Toast.confirm(`Send this quote to ${cust.email}?`, 'Send Email');
    if (!confirmed) return;

    // Find the email button and show loading state
    const emailBtn = document.querySelector(`.email-btn[data-id="${quoteId}"]`);
    if (emailBtn) { emailBtn.disabled = true; emailBtn.innerHTML = '<i data-lucide="loader"></i> Sending...'; lucide.createIcons(); }

    const products = d.products || [];
    const total    = d.totalAmount || products.reduce((s, p) => s + ((p.price||0)*(p.quantity||1)), 0);
    const itemsList = products.map(p => `• ${p.name} × ${p.quantity || 1} = ₹${((p.price||0)*(p.quantity||1)).toLocaleString('en-IN')}`).join('\n');

    try {
      await emailjs.send(cfg.serviceId, cfg.templateId, {
        to_name:      cust.name    || 'Valued Customer',
        to_email:     cust.email,
        company:      cfg.companyName || 'Product Manager',
        quote_id:     quoteId.slice(-8).toUpperCase(),
        created_date: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : 'N/A',
        expires_date: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-IN') : 'N/A',
        items:        itemsList,
        total:        '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      });
      Toast.show(`Quote emailed to ${cust.email} successfully!`, 'success');
      if (window.logActivity) logActivity('email_quote', `Emailed quote #${quoteId.slice(-8)} to ${cust.email}`);
    } catch (err) {
      Toast.show('Email failed: ' + (err.text || err.message || 'Unknown error'), 'error');
    } finally {
      if (emailBtn) { emailBtn.disabled = false; emailBtn.innerHTML = '<i data-lucide="mail" style="width:15px;height:15px;"></i> Email'; lucide.createIcons(); }
    }
  };

  // ========= EmailJS Setup Modal =========
  const showEmailSetupModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal" style="max-width:500px;text-align:left;">
        <div class="confirm-icon" style="background:#e0e7ff;color:#4f46e5;margin-bottom:1rem;">
          <i data-lucide="mail"></i>
        </div>
        <h3 style="margin:0 0 0.75rem;font-size:1.1rem;color:#1e293b;">Setup Email Sending</h3>
        <p style="font-size:0.9rem;color:#64748b;line-height:1.6;margin-bottom:1rem;">
          To send quotes by email, configure <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">emailjs-config.js</code> with your EmailJS credentials:
        </p>
        <ol style="font-size:0.88rem;color:#475569;line-height:1.9;padding-left:1.25rem;margin-bottom:1.25rem;">
          <li>Create a free account at <strong>emailjs.com</strong></li>
          <li>Add an Email Service (Gmail works great)</li>
          <li>Create a Template with variables: <code>{{to_name}}</code>, <code>{{to_email}}</code>, <code>{{items}}</code>, <code>{{total}}</code></li>
          <li>Copy your Public Key, Service ID, and Template ID</li>
          <li>Paste them into <strong>emailjs-config.js</strong> in your project folder</li>
        </ol>
        <div style="display:flex;justify-content:flex-end;gap:0.75rem;">
          <a href="https://www.emailjs.com" target="_blank" class="btn btn-primary btn-sm">Open EmailJS →</a>
          <button class="btn btn-outline btn-sm close-setup">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons({ nodes: overlay.querySelectorAll('[data-lucide]') });
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('confirm-visible')));
    overlay.querySelector('.close-setup').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  };

  // ========= PDF Download (jsPDF) =========
  window.downloadQuotePDF = (quoteId) => {
    const quote = allQuotes.find(q => q.id === quoteId);
    if (!quote) { Toast.show('Quote not found.', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const d   = quote.data;
    const cust = d.customer || {};
    const products = d.products || [];
    const total = d.totalAmount || products.reduce((s, p) => s + ((p.price||0)*(p.quantity||1)), 0);
    const createdDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : 'N/A';
    const expiresDate = d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-IN') : 'N/A';

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('Product Manager', 15, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Business Quote', 150, 18);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(`Quote #${quoteId.slice(-8).toUpperCase()}`, 15, 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${createdDate}`, 15, 50);
    doc.text(`Expires: ${expiresDate}`, 15, 57);
    doc.text(`Status: ${d.status || 'Pending'}`, 15, 64);

    doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Customer Details', 15, 77);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
    doc.text(`Name: ${cust.name || 'N/A'}`, 15, 85);
    doc.text(`Email: ${cust.email || 'N/A'}`, 15, 92);
    doc.text(`Phone: ${cust.phone || cust.mobile || 'N/A'}`, 15, 99);
    doc.text(`Address: ${cust.address || 'N/A'}`, 15, 106);

    doc.autoTable({
      startY: 118,
      head: [['Product', 'Category', 'Price (₹)', 'Qty', 'Total (₹)']],
      body: products.map(p => [p.name||'N/A', p.category||'N/A', '₹'+(p.price||0).toLocaleString('en-IN'), p.quantity||1, '₹'+((p.price||0)*(p.quantity||1)).toLocaleString('en-IN')]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(241, 245, 249);
    doc.rect(110, finalY - 4, 85, 14, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 102, 241);
    doc.text(`Grand Total: ₹${total.toLocaleString('en-IN', {minimumFractionDigits:2})}`, 115, finalY + 6);

    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text('Generated by Product Manager', 15, 285);
    doc.text(new Date().toLocaleString(), 140, 285);
    doc.save(`Quote_${quoteId.slice(-8).toUpperCase()}_${createdDate.replace(/\//g,'-')}.pdf`);
    Toast.show('PDF downloaded!', 'success');
  };

  // ========= Export CSV =========
  const exportBtn = document.getElementById('exportQuotesBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      let quotesToExport = currentTab !== 'All' ? allQuotes.filter(q => (q.data.status||'Pending') === currentTab) : allQuotes;
      if (quotesToExport.length === 0) { Toast.show('No quotes to export.', 'warning'); return; }
      const headers = ['Quote ID','Date','Customer Name','Email','Phone','Status','Total Amount','Expires','Items'];
      const rows = quotesToExport.map(q => {
        const d = q.data;
        const t = d.totalAmount || (d.products||[]).reduce((s,p) => s+((p.price||0)*(p.quantity||1)), 0);
        return [q.id, d.createdAt?.slice(0,10)||'', `"${d.customer?.name||''}"`, `"${d.customer?.email||''}"`, `"${d.customer?.phone||d.customer?.mobile||''}"`, d.status, t.toFixed(2), d.expiresAt?.slice(0,10)||'', (d.products||[]).length];
      });
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
      link.download = `quotes_${currentTab}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      Toast.show('Exported!', 'success');
    });
  }

  // ========= Logout =========
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const ok = await Toast.confirm('Logout?', 'Logout');
      if (ok) firebase.auth().signOut().then(() => window.location.href = 'index.html');
    });
  }
});
