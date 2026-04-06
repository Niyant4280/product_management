document.addEventListener('DOMContentLoaded', () => {
  // ========= Auth Guard (A10) =========
  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
  });

  const tableBody = document.querySelector('#productTable tbody');
  const quoteForm = document.getElementById('quoteForm');
  const searchInput = document.getElementById('productSearch');

  // Total display
  const totalPriceDisplay = document.createElement('div');
  totalPriceDisplay.id = 'totalPrice';
  totalPriceDisplay.style.cssText = 'margin:0 0 1rem 0; font-weight:700; font-size:1.1rem; color:var(--primary); padding:0.75rem 1rem; background:#ede9fe; border-radius:8px; border-left:4px solid var(--primary);';
  totalPriceDisplay.innerText = '💰 Total Quote Amount: ₹0.00';
  quoteForm.insertAdjacentElement('beforebegin', totalPriceDisplay);

  let allProducts = [];
  const cart = new Map();

  // Load products
  db.collection("products").get().then(snapshot => {
    allProducts = [];
    snapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
    renderTable(allProducts);
  });

  // ========= Customer Select (A6 — use phone field) =========
  const customerSelect = document.getElementById('customerSelect');
  const refreshCustBtn = document.getElementById('refreshCustomersBtn');
  let customersMap = new Map();

  const loadCustomers = () => {
    customerSelect.innerHTML = '<option value="">Loading...</option>';
    db.collection("customers").orderBy("name").get().then(snap => {
      customerSelect.innerHTML = '<option value="">-- Choose a Customer --</option>';
      customersMap.clear();
      snap.forEach(doc => {
        const data = doc.data();
        customersMap.set(doc.id, data);
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = `${data.name} (${data.email})`;
        customerSelect.appendChild(opt);
      });
    }).catch(err => {
      customerSelect.innerHTML = '<option value="">Error loading</option>';
      Toast.show('Error loading customers: ' + err.message, 'error');
    });
  };

  loadCustomers();
  if (refreshCustBtn) refreshCustBtn.addEventListener('click', loadCustomers);

  customerSelect.addEventListener('change', (e) => {
    const custId = e.target.value;
    if (custId && customersMap.has(custId)) {
      const cust = customersMap.get(custId);
      document.getElementById('cName').value    = cust.name    || '';
      document.getElementById('cEmail').value   = cust.email   || '';
      document.getElementById('cPhone').value   = cust.phone   || ''; // normalized to phone (A6)
      document.getElementById('cAddress').value = cust.address || '';
    }
  });

  // ========= Search =========
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      renderTable(allProducts.filter(p => p.name.toLowerCase().includes(term) || (p.category||'').toLowerCase().includes(term)));
    });
  }

  // ========= Render Table =========
  function renderTable(products) {
    tableBody.innerHTML = '';
    if (products.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:#94a3b8;">No products found</td></tr>';
      return;
    }
    products.forEach(product => {
      const row = document.createElement('tr');
      const isSelected = cart.has(product.id);
      const currentQty = isSelected ? cart.get(product.id).quantity : 1;
      const isOOS = product.status === 'Out of Stock';

      row.innerHTML = `
        <td>
          <input type="checkbox" class="select-product" data-id="${product.id}" ${isSelected ? 'checked' : ''} ${isOOS ? 'disabled' : ''}/>
        </td>
        <td>${product.name}${isOOS ? ' <span style="color:#ef4444;font-size:0.75rem;">(Out of Stock)</span>' : ''}</td>
        <td>₹${parseFloat(product.price).toLocaleString('en-IN')}</td>
        <td>${product.category}</td>
        <td style="${parseInt(product.stock) <= 5 ? 'color:#ef4444;font-weight:700;' : ''}">${product.stock}</td>
      `;

      const checkbox = row.querySelector('.select-product');
      if (isSelected) addQuantityInput(checkbox.parentElement, product, currentQty);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) { cart.set(product.id, { ...product, quantity: 1 }); addQuantityInput(checkbox.parentElement, product, 1); }
        else { cart.delete(product.id); checkbox.parentElement.querySelector('.quote-quantity')?.remove(); }
        updateTotal();
      });
      tableBody.appendChild(row);
    });
  }

  function addQuantityInput(container, product, value) {
    if (container.querySelector('.quote-quantity')) return;
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.value = value;
    qtyInput.classList.add('quote-quantity');
    qtyInput.style.cssText = 'margin-left:8px;width:60px;padding:4px;border:1px solid #cbd5e1;border-radius:4px;font-family:inherit;';
    if (product.stock) qtyInput.max = product.stock;
    qtyInput.addEventListener('input', (e) => {
      const qty = parseInt(e.target.value);
      if (qty > 0) { const item = cart.get(product.id); if (item) { item.quantity = qty; cart.set(product.id, item); updateTotal(); } }
    });
    container.appendChild(qtyInput);
  }

  function updateTotal() {
    let total = 0;
    cart.forEach(item => total += (item.price * item.quantity));
    totalPriceDisplay.innerText = `💰 Total Quote Amount: ₹${total.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
  }

  // ========= Quote Submit =========
  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cart.size === 0) { Toast.show('Please select at least one product.', 'warning'); return; }

    const customer = {
      name:    document.getElementById('cName').value.trim(),
      phone:   document.getElementById('cPhone').value.trim(),   // normalized (A6)
      email:   document.getElementById('cEmail').value.trim(),
      address: document.getElementById('cAddress').value.trim()
    };

    if (!customer.name || !customer.email) {
      Toast.show('Customer name and email are required.', 'warning');
      return;
    }

    const productsList = Array.from(cart.values());
    let customerId = customerSelect.value;

    try {
      if (!customerId) {
        const snap = await db.collection("customers").where("email", "==", customer.email).get();
        if (!snap.empty) { customerId = snap.docs[0].id; }
        else {
          const ref = await db.collection("customers").add(customer);
          customerId = ref.id;
          if (window.logActivity) logActivity('add_customer', `Auto-added customer ${customer.name}`);
        }
      }
    } catch (err) { console.warn("Customer auto-save warning:", err); }

    const quote = {
      customer: { ...customer, id: customerId },
      products: productsList,
      totalAmount: productsList.reduce((s, p) => s + (p.price * p.quantity), 0),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30-day expiry
    };

    try {
      await db.runTransaction(async (tx) => {
        const refs = productsList.map(p => db.collection('products').doc(p.id));
        const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
        const updates = [];

        snaps.forEach((snap, idx) => {
          if (!snap.exists) throw new Error(`Product not found: ${productsList[idx].name}`);
          const data = snap.data();
          const currentStock = parseInt(data.stock || 0);
          const reqQty = parseInt(productsList[idx].quantity || 0);
          if (currentStock < reqQty) throw new Error(`"${data.name}" only has ${currentStock} in stock.`);
          const newStock = currentStock - reqQty;
          updates.push({ ref: refs[idx], data: { stock: newStock, status: newStock === 0 ? 'Out of Stock' : data.status } });
        });

        updates.forEach(u => tx.update(u.ref, u.data));
        const quoteRef = db.collection('quotes').doc();
        tx.set(quoteRef, quote);
      });

      Toast.show('Quote created successfully!', 'success');
      if (window.logActivity) logActivity('create_quote', `Created quote for ${customer.name}`);
      setTimeout(() => window.location.href = 'view_quotes.html', 1200);

    } catch (err) {
      Toast.show('Error: ' + err.message, 'error');
    }
  });

  // ========= Logout =========
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const ok = await Toast.confirm('Are you sure you want to logout?', 'Logout');
      if (ok) firebase.auth().signOut().then(() => window.location.href = 'index.html');
    });
  }
});
