document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#productTable tbody');
  const quoteForm = document.getElementById('quoteForm');
  const searchInput = document.getElementById('productSearch');
  const totalPriceDisplay = document.createElement('div');

  // Insert total price display
  totalPriceDisplay.id = 'totalPrice';
  totalPriceDisplay.style.marginTop = '10px';
  totalPriceDisplay.style.fontWeight = 'bold';
  totalPriceDisplay.style.fontSize = '1.1rem';
  totalPriceDisplay.style.color = 'var(--primary)';
  totalPriceDisplay.innerText = '💰 Total Quote Amount: ₹0.00';
  quoteForm.insertAdjacentElement('beforebegin', totalPriceDisplay);

  let allProducts = [];
  // Use a Map to store selected items: ID -> { ...productData, quantity }
  const cart = new Map();

  // Load products
  db.collection("products").get().then(snapshot => {
    allProducts = [];
    snapshot.forEach(doc => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });
    renderTable(allProducts);
  });

  // --- Customer Selection Logic ---
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
      console.error("Error loading customers:", err);
      customerSelect.innerHTML = '<option value="">Error loading customers</option>';
    });
  };

  loadCustomers();
  if (refreshCustBtn) refreshCustBtn.addEventListener('click', loadCustomers);

  customerSelect.addEventListener('change', (e) => {
    const custId = e.target.value;
    if (custId && customersMap.has(custId)) {
      const cust = customersMap.get(custId);
      document.getElementById('cName').value = cust.name || '';
      document.getElementById('cEmail').value = cust.email || '';
      document.getElementById('cPhone').value = cust.phone || '';
      document.getElementById('cAddress').value = cust.address || '';
    } else {
      // Clear fields if no customer selected? Or keep them? 
      // Let's clear to avoid confusion, or user can type manually.
      // document.getElementById('cName').value = '';
      // document.getElementById('cEmail').value = ''; 
      // User might want to use this as a template, so maybe don't clear explicitly unless requested.
    }
  });

  // Search Logic
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allProducts.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
      renderTable(filtered);
    });
  }

  function renderTable(products) {
    tableBody.innerHTML = '';

    if (products.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem;">No products found</td></tr>';
      return;
    }

    products.forEach(product => {
      const row = document.createElement('tr');
      const isSelected = cart.has(product.id);
      const currentQty = isSelected ? cart.get(product.id).quantity : 1;

      row.innerHTML = `
        <td>
          <input type="checkbox" class="select-product" data-id="${product.id}" ${isSelected ? 'checked' : ''} />
        </td>
        <td>${product.name}</td>
        <td>₹${product.price}</td>
        <td>${product.category}</td>
        <td>${product.stock}</td>
      `;

      const checkbox = row.querySelector('.select-product');

      // If selected, show quantity input immediately
      if (isSelected) {
        addQuantityInput(checkbox.parentElement, product, currentQty);
      }

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          // Add to cart with default qty 1
          cart.set(product.id, { ...product, quantity: 1 });
          addQuantityInput(checkbox.parentElement, product, 1);
        } else {
          // Remove from cart
          cart.delete(product.id);
          const input = checkbox.parentElement.querySelector('.quote-quantity');
          if (input) input.remove();
        }
        updateTotal();
      });

      tableBody.appendChild(row);
    });
  }

  function addQuantityInput(container, product, value) {
    // Avoid duplicates
    if (container.querySelector('.quote-quantity')) return;

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.value = value;
    qtyInput.classList.add('quote-quantity');
    qtyInput.style.marginLeft = '10px';
    qtyInput.style.width = '60px';
    qtyInput.style.padding = '4px';
    qtyInput.style.border = '1px solid #cbd5e1';
    qtyInput.style.borderRadius = '4px';

    if (product.stock) {
      qtyInput.max = product.stock;
    }

    qtyInput.addEventListener('input', (e) => {
      const newQty = parseInt(e.target.value);
      if (newQty > 0) {
        // Update cart
        const item = cart.get(product.id);
        if (item) {
          item.quantity = newQty;
          cart.set(product.id, item);
          updateTotal();
        }
      }
    });

    container.appendChild(qtyInput);
  }

  function updateTotal() {
    let total = 0;
    cart.forEach(item => {
      total += (item.price * item.quantity);
    });
    totalPriceDisplay.innerText = `💰 Total Quote Amount: ₹${total.toFixed(2)}`;
  }

  // Handle quote submission
  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cart.size === 0) {
      alert("Please select at least one product.");
      return;
    }

    const customer = {
      name: document.getElementById('cName').value.trim(),
      mobile: document.getElementById('cPhone').value.trim(),
      email: document.getElementById('cEmail').value.trim(),
      address: document.getElementById('cAddress').value.trim()
    };

    if (!customer.name || !customer.mobile || !customer.email || !customer.address) {
      alert("Please fill all customer fields.");
      return;
    }

    // Convert Map to Array
    const productsList = Array.from(cart.values());

    // --- Auto-Save Customer Logic ---
    let customerId = customerSelect.value; // Use selected ID if available

    try {
      // If no customer selected (manual entry), check/create customer
      if (!customerId) {
        // Check if customer exists by email
        const snapshot = await db.collection("customers").where("email", "==", customer.email).get();

        if (!snapshot.empty) {
          // Customer exists, use their ID and update details if needed (optional, here we just use ID)
          customerId = snapshot.docs[0].id;
          // Optional: Update their details with latest form data?
          // await db.collection("customers").doc(customerId).update(customer);
        } else {
          // Create new customer
          const newCustRef = await db.collection("customers").add(customer);
          customerId = newCustRef.id;
          console.log("New customer created with ID:", customerId);
          if (window.logActivity) window.logActivity('add_customer', `Auto-added customer ${customer.name} from Quote`);
        }
      } else {
        // Update existing customer with new details if changed? 
        // For now, let's assume we just link them.
      }
    } catch (err) {
      console.error("Error handling customer auto-save:", err);
      // Proceed even if auto-save fails? Or block?
      // Let's alert but proceed with quote creation to not block user.
      // alert("Warning: Could not auto-save customer to list.");
    }

    const quote = {
      customer: { ...customer, id: customerId }, // Include ID
      products: productsList,
      totalAmount: productsList.reduce((acc, p) => acc + (p.price * p.quantity), 0),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    try {
      await db.runTransaction(async (tx) => {
        // 1. Read all product docs to get current stock
        const refs = productsList.map(p => db.collection('products').doc(p.id));
        const snaps = await Promise.all(refs.map(ref => tx.get(ref)));

        const updates = [];

        // 2. Validate and Prepare Updates
        snaps.forEach((snap, idx) => {
          if (!snap.exists) throw new Error(`Product not found: ${productsList[idx].name}`);

          const data = snap.data();
          const currentStock = parseInt(data.stock || 0);
          const requestQty = parseInt(productsList[idx].quantity || 0);

          if (currentStock < requestQty) {
            throw new Error(`${data.name} is out of stock. Available: ${currentStock}`);
          }

          const newStock = currentStock - requestQty;
          const newStatus = newStock === 0 ? 'Out of Stock' : (data.status || 'Available');

          updates.push({ ref: refs[idx], data: { stock: newStock, status: newStatus } });
        });

        // 3. Commit Updates
        updates.forEach(u => tx.update(u.ref, u.data));

        // 4. Save Quote
        const quoteRef = db.collection('quotes').doc();
        tx.set(quoteRef, quote);
      });

      alert("✅ Quote Created Successfully!");
      if (window.logActivity) window.logActivity('create_quote', `Created quote for ${customer.name}`);
      window.location.href = "view_quotes.html";

    } catch (err) {
      console.error("Transaction failed:", err);
      alert("❌ Error: " + err.message);
    }
  });

});
