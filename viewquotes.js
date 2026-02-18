document.addEventListener('DOMContentLoaded', () => {
  const quoteList = document.getElementById('quoteList');
  const quoteSearch = document.getElementById('quoteSearch');
  const quoteDateFilter = document.getElementById('quoteDateFilter');
  // Removed status filter select

  // Tabs Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  let currentTab = 'Pending'; // Default to Pending as requested "approve/reject section"

  let allQuotes = [];

  // Setup Tab Click Listeners
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      tabBtns.forEach(b => b.classList.remove('active'));
      // Add to clicked
      btn.classList.add('active');
      // Update state
      currentTab = btn.dataset.tab;
      // Re-render
      filterAndRenderQuotes();
    });
  });

  function renderQuote(quoteData, quoteId) {
    const div = document.createElement('div');
    div.className = 'quote-box';

    // Safely access customer info with fallback
    const customerName = quoteData.customer?.name || 'N/A';
    const customerEmail = quoteData.customer?.email || 'N/A';
    const customerMobile = quoteData.customer?.mobile || 'N/A';
    const billingAddress = quoteData.customer?.address || 'N/A';
    const status = quoteData.status || 'Pending';
    const totalAmount = quoteData.totalAmount || 0;

    // Calculate total from products if not available
    const calculatedTotal = quoteData.products && Array.isArray(quoteData.products) ?
      quoteData.products.reduce((sum, product) => sum + (product.price * (product.quantity || 1)), 0) : 0;

    const finalTotal = totalAmount || calculatedTotal;

    // Render the quote HTML
    div.innerHTML = `
      <div class="quote-header">
        <div class="quote-id">Quote #${quoteId.slice(-8)}</div>
        <div class="quote-status status-${status.toLowerCase()}">${status}</div>
      </div>

      <div class="customer-info">
        <p><strong>Customer Name:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>
        <p><strong>Mobile:</strong> ${customerMobile}</p>
        <p><strong>Billing Address:</strong> ${billingAddress}</p>
      </div>

      <div class="quote-products">
        <h4>Products</h4>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price (₹)</th>
              <th>Quantity</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${quoteData.products && Array.isArray(quoteData.products) ?
        quoteData.products.map(product => `
                <tr>
                  <td>${product.name || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>₹${product.price ? product.price.toFixed(2) : '0.00'}</td>
                  <td>${product.quantity || 1}</td>
                  <td>₹${product.price ? (product.price * (product.quantity || 1)).toFixed(2) : '0.00'}</td>
                </tr>
              `).join('')
        : '<tr><td colspan="5">No products found</td></tr>'
      }
          </tbody>
        </table>
      </div>

      <div class="quote-total">
        Total Amount: ₹${finalTotal.toFixed(2)}
      </div>

      <div class="quote-actions">
        <button class="btn btn-primary" onclick="printQuote('${quoteId}')">
          <i data-lucide="printer" style="width:16px; margin-right:5px;"></i> Print
        </button>
        ${status === 'Pending' ? `
          <button class="btn btn-success" onclick="acceptQuote('${quoteId}')">
            <i data-lucide="check" style="width:16px; margin-right:5px;"></i> Accept
          </button>
          <button class="btn btn-danger" onclick="rejectQuote('${quoteId}')">
            <i data-lucide="x" style="width:16px; margin-right:5px;"></i> Reject
          </button>
        ` : ''}
        ${status === 'Accepted' ? '<span style="color:var(--success); font-weight:600; align-self:center;">Has been Accepted</span>' : ''}
        ${status === 'Rejected' ? '<span style="color:var(--danger); font-weight:600; align-self:center;">Has been Rejected</span>' : ''}
      </div>
    `;

    quoteList.appendChild(div);
  }

  function filterAndRenderQuotes() {
    let filtered = allQuotes;
    const search = quoteSearch ? quoteSearch.value.trim().toLowerCase() : '';
    const date = quoteDateFilter ? quoteDateFilter.value : '';

    // 1. Filter by Search
    if (search) {
      filtered = filtered.filter(q => (q.data.customer?.name || '').toLowerCase().includes(search));
    }
    // 2. Filter by Date
    if (date) {
      filtered = filtered.filter(q => q.data.createdAt && q.data.createdAt.startsWith(date));
    }
    // 3. Filter by Tab (Status)
    if (currentTab !== 'All') {
      filtered = filtered.filter(q => (q.data.status || 'Pending') === currentTab);
    }

    quoteList.innerHTML = '';
    if (filtered.length === 0) {
      quoteList.innerHTML = `<div class="no-quotes">No ${currentTab === 'All' ? '' : currentTab.toLowerCase()} quotes found.</div>`;
    } else {
      // Sort by date descending
      filtered.sort((a, b) => (b.data.createdAt || '').localeCompare(a.data.createdAt || ''));

      filtered.forEach(q => renderQuote(q.data, q.id));
      lucide.createIcons(); // Re-init icons for new buttons
    }
  }

  quoteSearch && quoteSearch.addEventListener('input', filterAndRenderQuotes);
  quoteDateFilter && quoteDateFilter.addEventListener('change', filterAndRenderQuotes);

  // --- Export CSV Logic ---
  const exportQuotesBtn = document.getElementById('exportQuotesBtn');
  if (exportQuotesBtn) {
    exportQuotesBtn.addEventListener('click', () => {
      // Use filtered quotes or all quotes? Usually visible quotes (filtered) are expected.
      // But let's export allQuotes for now for completeness, OR filtered if we had access to the filtered list variable globally.
      // Ideally, export what is visible. But `filtered` is local to filterAndRenderQuotes. 
      // Let's re-run filter logic or just export all. 
      // User likely wants "All" or "Current View". Let's export current filtered view by re-applying filter logic briefly or storing it.
      // For simplicity and performance, let's export ALL quotes in the current TAB.

      let quotesToExport = allQuotes;
      if (currentTab !== 'All') {
        quotesToExport = allQuotes.filter(q => (q.data.status || 'Pending') === currentTab);
      }

      if (quotesToExport.length === 0) {
        alert("No quotes to export in current tab.");
        return;
      }

      const headers = ["Quote ID", "Date", "Customer Name", "Email", "Mobile", "Status", "Total Amount", "Items Count"];

      const rows = quotesToExport.map(q => {
        const d = q.data;
        const total = d.totalAmount || (d.products || []).reduce((s, p) => s + (p.price * (p.quantity || 1)), 0);
        return [
          q.id,
          d.createdAt ? d.createdAt.slice(0, 10) : '',
          `"${(d.customer?.name || '').replace(/"/g, '""')}"`,
          `"${(d.customer?.email || '').replace(/"/g, '""')}"`,
          `"${(d.customer?.mobile || '').replace(/"/g, '""')}"`,
          d.status,
          total.toFixed(2),
          (d.products || []).length
        ];
      });

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `quotes_export_${currentTab}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Fetch quotes from Firestore and render
  db.collection("quotes").get()
    .then(snapshot => {
      allQuotes = [];
      snapshot.forEach(doc => {
        allQuotes.push({ id: doc.id, data: doc.data() });
      });
      filterAndRenderQuotes();
    })
    .catch(error => {
      quoteList.innerHTML = '<p>Error loading quotes: ' + error.message + '</p>';
    });
});

// Accept quote functionality
async function acceptQuote(quoteId) {
  if (!confirm('Are you sure you want to accept this quote?')) {
    return;
  }

  try {
    await db.collection('quotes').doc(quoteId).update({
      status: 'Accepted',
      acceptedAt: new Date().toISOString()
    });

    alert('✅ Quote accepted successfully!');
    location.reload();
  } catch (error) {
    alert('❌ Error accepting quote: ' + error.message);
  }
}

// Reject quote functionality
async function rejectQuote(quoteId) {
  const reason = prompt('Please provide a reason for rejection (optional):');

  if (!confirm('Are you sure you want to reject this quote?')) {
    return;
  }

  try {
    const updateData = {
      status: 'Rejected',
      rejectedAt: new Date().toISOString()
    };

    if (reason && reason.trim()) {
      updateData.rejectionReason = reason.trim();
    }

    await db.collection('quotes').doc(quoteId).update(updateData);

    alert('❌ Quote rejected successfully!');
    location.reload();
  } catch (error) {
    alert('❌ Error rejecting quote: ' + error.message);
  }
}

// Print functionality
function printQuote(quoteId) {
  const originalContent = document.body.innerHTML;
  const quoteBoxes = document.getElementsByClassName('quote-box');
  let printContent = '';

  for (let box of quoteBoxes) {
    if (box.innerHTML.includes(quoteId)) {
      printContent = box.outerHTML;
      break;
    }
  }

  if (printContent) {
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    location.reload();
  } else {
    alert('Quote not found for printing.');
  }
}
