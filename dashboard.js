document.addEventListener('DOMContentLoaded', () => {
  // Auth guard: redirect unauthenticated users to login
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = 'index.html';
    }
  });
  const addForm = document.getElementById('addProductForm');
  const tableBody = document.querySelector('#productTable tbody');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const modal = document.createElement('div');

  modal.id = 'productModal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content">
      <span id="closeModal" class="close">&times;</span>
      <h2>Product Details</h2>
      <p id="modalProductName"></p>
      <p id="modalProductPrice"></p>
      <p id="modalProductCategory"></p>
      <p id="modalProductStock"></p>
      <p id="modalProductStatus"></p>
    </div>
  `;
  document.body.appendChild(modal);

  // --- Dashboard Stats & Activity Logic --- 

  // 1. Calculate and Display Product Stats
  const updateProductStats = (products) => {
    const totalProducts = products.length;
    let lowStockCount = 0;
    let inventoryValue = 0;

    products.forEach(doc => {
      const data = doc.data();
      // Low Stock < 10
      if (data.stock < 10) {
        lowStockCount++;
      }
      // Inventory Value
      inventoryValue += (parseFloat(data.price) || 0) * (parseInt(data.stock) || 0);
    });

    // Update UI
    const elTotal = document.getElementById('statTotalProducts');
    const elLow = document.getElementById('statLowStock');
    const elValue = document.getElementById('statInventoryValue');

    if (elTotal) elTotal.innerText = totalProducts;
    if (elLow) elLow.innerText = lowStockCount;
    if (elValue) elValue.innerText = '₹' + inventoryValue.toLocaleString('en-IN');
  };

  // 2. Fetch Pending Quotes Count
  const fetchPendingQuotesStats = () => {
    db.collection("quotes").where("status", "==", "Pending").get()
      .then(snap => {
        const count = snap.size;
        const elPending = document.getElementById('statPendingQuotes');
        if (elPending) elPending.innerText = count;
      })
      .catch(err => console.error("Error fetching quotes stats:", err));
  };

  // 3. Fetch Recent Activity
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
          const timeAgo = timeSince(date);

          const div = document.createElement('div');
          div.className = 'activity-item';
          div.innerHTML = `
            <div class="activity-icon">
              <i data-lucide="${getActionIcon(data.action)}"></i>
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

  // Helper: Get Icon based on action
  const getActionIcon = (action) => {
    if (action === 'add_product') return 'plus-circle';
    if (action === 'delete_product') return 'trash-2';
    if (action === 'create_quote') return 'file-plus';
    if (action === 'update_quote') return 'file-text';
    return 'activity';
  };

  // Helper: Time Since
  const timeSince = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes";
    return Math.floor(seconds) + " seconds";
  };

  // Helper: Log Activity (Global function)
  window.logActivity = (action, description) => {
    const user = firebase.auth().currentUser;
    db.collection("activity_log").add({
      action: action,
      description: description,
      user: user ? (user.displayName || user.email) : 'Unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error("Failed to log activity", err));
  };


  // --- Existing Logic ---

  const searchInput = document.getElementById('productSearch');
  // ... (rest of search/filter variables)
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const sortBy = document.getElementById('sortBy');
  let allProducts = [];

  const renderProducts = (products) => {
    // ... (existing implementation)
    tableBody.innerHTML = "";
    products.forEach(doc => {
      const data = doc.data ? doc.data() : doc;
      const tr = document.createElement('tr');
      tr.innerHTML = `
          <td><input type="checkbox" class="rowCheckbox" data-id="${doc.id || data.id}"></td>
          <td class="product-name" data-id="${doc.id || data.id}" style="cursor:pointer; color:#3b82f6; text-decoration: underline;">${data.name}</td>
          <td class="product-price">${data.price}</td>
          <td class="product-category">${data.category}</td>
          <td class="product-stock">${data.stock}</td>
          <td class="product-status">${data.status}</td>
          <td class="actions">
            <button class="edit-btn" data-id="${doc.id || data.id}">Edit</button>
            <button class="delete-btn" data-id="${doc.id || data.id}">Delete</button>
          </td>
        `;
      tableBody.appendChild(tr);
    });

    // Update Stats whenever products are rendered
    updateProductStats(products);
  };

  // --- CSV Export Logic ---
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!allProducts || allProducts.length === 0) {
        alert("No products to export.");
        return;
      }

      // 1. Define CSV Headers
      const headers = ["ID", "Name", "Category", "Price", "Stock", "Status"];

      // 2. Map Data to Rows
      const rows = allProducts.map(doc => {
        const data = doc.data ? doc.data() : doc;
        return [
          doc.id,
          `"${(data.name || '').replace(/"/g, '""')}"`, // Escape quotes
          `"${(data.category || '').replace(/"/g, '""')}"`,
          data.price,
          data.stock,
          `"${(data.status || '')}"`
        ];
      });

      // 3. Combine Headers and Rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // 4. Create Download Link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Note: loadProducts() calls filterAndRender() which calls renderProducts().
  // So stats will update automatically when products load/filter.

  // Call init stats
  fetchPendingQuotesStats();
  fetchRecentActivity();


  const filterAndRender = () => {
    // ... (existing implementation)
    let filtered = allProducts;
    const search = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;
    const sort = sortBy ? sortBy.value : '';
    if (search) {
      filtered = filtered.filter(doc => (doc.data ? doc.data().name : doc.name).toLowerCase().includes(search));
    }
    if (category) {
      filtered = filtered.filter(doc => (doc.data ? doc.data().category : doc.category) === category);
    }
    if (status) {
      filtered = filtered.filter(doc => (doc.data ? doc.data().status : doc.status) === status);
    }
    if (sort) {
      filtered = filtered.slice();
      filtered.sort((a, b) => {
        const get = (doc, key) => doc.data ? doc.data()[key] : doc[key];
        if (sort === 'name-asc') return get(a, 'name').localeCompare(get(b, 'name'));
        if (sort === 'name-desc') return get(b, 'name').localeCompare(get(a, 'name'));
        if (sort === 'price-asc') return get(a, 'price') - get(b, 'price');
        if (sort === 'price-desc') return get(b, 'price') - get(a, 'price');
        if (sort === 'stock-asc') return get(a, 'stock') - get(b, 'stock');
        if (sort === 'stock-desc') return get(b, 'stock') - get(a, 'stock');
        return 0;
      });
    }
    renderProducts(filtered);
  };

  searchInput && searchInput.addEventListener('input', filterAndRender);
  categoryFilter && categoryFilter.addEventListener('change', filterAndRender);
  statusFilter && statusFilter.addEventListener('change', filterAndRender);
  sortBy && sortBy.addEventListener('change', filterAndRender);

  // --- End of new logic ---



  // --- Edit product: force status to 'Out of Stock' if stock is zero ---
  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const id = target.dataset.id;
    const row = target.closest('tr');

    if (target.classList.contains('edit-btn')) {
      if (target.innerText === "Edit") {
        row.querySelector('.product-name').innerHTML = `<input type="text" class="edit-name" value="${row.querySelector('.product-name').innerText}">`;
        row.querySelector('.product-price').innerHTML = `<input type="number" class="edit-price" value="${row.querySelector('.product-price').innerText}">`;
        row.querySelector('.product-category').innerHTML = `<input type="text" class="edit-category" value="${row.querySelector('.product-category').innerText}">`;
        row.querySelector('.product-stock').innerHTML = `<input type="number" class="edit-stock" value="${row.querySelector('.product-stock').innerText}">`;
        row.querySelector('.product-status').innerHTML = `
          <select class="edit-status">
            <option value="Available" ${row.querySelector('.product-status').innerText === "Available" ? "selected" : ""}>Available</option>
            <option value="Out of Stock" ${row.querySelector('.product-status').innerText === "Out of Stock" ? "selected" : ""}>Out of Stock</option>
            <option value="Discontinued" ${row.querySelector('.product-status').innerText === "Discontinued" ? "selected" : ""}>Discontinued</option>
          </select>
        `;
        target.innerText = "Save";

        if (!row.querySelector('.cancel-btn')) {
          const cancelBtn = document.createElement('button');
          cancelBtn.classList.add('cancel-btn');
          cancelBtn.innerText = 'Cancel';
          cancelBtn.dataset.id = id;
          row.querySelector('.actions').appendChild(cancelBtn);
        }

        // Add event listener to stock input to auto-set status
        setTimeout(() => {
          const stockInput = row.querySelector('.edit-stock');
          const statusSelect = row.querySelector('.edit-status');
          if (stockInput && statusSelect) {
            stockInput.addEventListener('input', () => {
              if (parseInt(stockInput.value) === 0) {
                statusSelect.value = 'Out of Stock';
                statusSelect.disabled = true;
              } else {
                statusSelect.disabled = false;
              }
            });
            // Initial check
            if (parseInt(stockInput.value) === 0) {
              statusSelect.value = 'Out of Stock';
              statusSelect.disabled = true;
            } else {
              statusSelect.disabled = false;
            }
          }
        }, 0);

      } else if (target.innerText === "Save") {
        const newName = row.querySelector('.edit-name').value.trim();
        const newPrice = parseFloat(row.querySelector('.edit-price').value);
        const newCategory = row.querySelector('.edit-category').value.trim();
        const newStock = parseInt(row.querySelector('.edit-stock').value);
        let newStatus = row.querySelector('.edit-status').value;
        if (newStock === 0) {
          newStatus = 'Out of Stock';
        }
        if (newName && !isNaN(newPrice) && newCategory && !isNaN(newStock) && newStatus) {
          try {
            await db.collection("products").doc(id).update({
              name: newName,
              price: newPrice,
              category: newCategory,
              stock: newStock,
              status: newStatus
            });

            row.querySelector('.product-name').innerText = newName;
            row.querySelector('.product-price').innerText = newPrice;
            row.querySelector('.product-category').innerText = newCategory;
            row.querySelector('.product-stock').innerText = newStock;
            row.querySelector('.product-status').innerText = newStatus;

            target.innerText = "Edit";
            row.querySelector('.cancel-btn')?.remove();
          } catch (err) {
            alert("Error updating product: " + err.message);
          }
        } else {
          alert("Please fill all fields correctly.");
        }
      }
    }

    if (target.classList.contains('cancel-btn')) {
      const docSnap = await db.collection("products").doc(id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        row.querySelector('.product-name').innerText = data.name;
        row.querySelector('.product-price').innerText = data.price;
        row.querySelector('.product-category').innerText = data.category;
        row.querySelector('.product-stock').innerText = data.stock;
        row.querySelector('.product-status').innerText = data.status;
        target.remove();
        row.querySelector('.edit-btn').innerText = "Edit";
      }
    }

    if (target.classList.contains('delete-btn')) {
      if (confirm("Are you sure you want to delete this product?")) {
        try {
          await db.collection("products").doc(id).delete();
        } catch (err) {
          alert("Error deleting: " + err.message);
        }
      }
    }

    if (target.classList.contains('product-name')) {
      const docSnap = await db.collection("products").doc(id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        document.getElementById('modalProductName').innerText = `Name: ${data.name}`;
        document.getElementById('modalProductPrice').innerText = `Price: ₹${data.price}`;
        document.getElementById('modalProductCategory').innerText = `Category: ${data.category}`;
        document.getElementById('modalProductStock').innerText = `Stock: ${data.stock}`;
        document.getElementById('modalProductStatus').innerText = `Status: ${data.status}`;
        modal.style.display = 'flex';
      }
    }
  });

  document.getElementById('closeModal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  bulkDeleteBtn.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.rowCheckbox:checked');
    if (selected.length === 0) {
      alert("Please select at least one product to delete.");
      return;
    }

    if (confirm(`Delete ${selected.length} selected product(s)?`)) {
      for (const box of selected) {
        const id = box.dataset.id;
        try {
          await db.collection("products").doc(id).delete();
        } catch (err) {
          alert(`Failed to delete one or more items: ${err.message}`);
        }
      }
    }
  });

  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.rowCheckbox').forEach(cb => cb.checked = isChecked);
  });

  const loadProducts = async () => {
    db.collection("products").onSnapshot(snapshot => {
      allProducts = [];
      const categories = new Set();
      snapshot.forEach(doc => {
        allProducts.push(doc);
        const data = doc.data();
        if (data && data.category) categories.add(data.category);
      });
      // Populate category filter options
      if (categoryFilter) {
        const current = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        Array.from(categories).sort().forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          categoryFilter.appendChild(opt);
        });
        // Preserve selection if still present
        if (current && Array.from(categories).includes(current)) {
          categoryFilter.value = current;
        }
      }
      // Render
      filterAndRender();
    }, err => {
      console.error('Failed to load products:', err);
    });
  };

  loadProducts();

  // Attach submit handler only if the inline form exists (after moving creation to a separate page)
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('productName').value.trim();
      const price = parseFloat(document.getElementById('productPrice').value);
      const category = document.getElementById('productCategory').value.trim();
      const stock = parseInt(document.getElementById('productStock').value);
      let status = document.getElementById('productStatus').value.trim();

      // If stock is zero, force status to 'Out of Stock'
      if (stock === 0) {
        status = 'Out of Stock';
        document.getElementById('productStatus').value = 'Out of Stock';
      }

      if (name && !isNaN(price) && category && !isNaN(stock) && status) {
        try {
          await db.collection("products").add({ name, price, category, stock, status });
          addForm.reset();
        } catch (err) {
          alert("Error adding product: " + err.message);
        }
      } else {
        alert("Please fill in all fields correctly.");
      }
    });
  }
});

// 🔐 Logout Button
document.getElementById('logoutBtn').addEventListener('click', () => {
  firebase.auth().signOut()
    .then(() => window.location.href = "index.html")
    .catch(error => alert("Logout Failed: " + error.message));
});

// ➕ Create Quote Navigation
document.getElementById('createQuoteBtn').addEventListener('click', () => {
  window.location.href = "quote.html";
});

// ➡️ Profile Navigation
const profileBtn = document.getElementById('profileBtn');
if (profileBtn) {
  profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
}

// ➡️ Analytics Navigation
const productAnalyticsBtn = document.getElementById('productAnalyticsBtn');
if (productAnalyticsBtn) {
  productAnalyticsBtn.addEventListener('click', () => {
    window.location.href = 'product-analytics.html';
  });
}
const quoteAnalyticsBtn = document.getElementById('quoteAnalyticsBtn');
if (quoteAnalyticsBtn) {
  quoteAnalyticsBtn.addEventListener('click', () => {
    window.location.href = 'quote-analytics.html';
  });
}

// ➡️ Add Product Navigation
const addProductBtn = document.getElementById('addProductBtn');
if (addProductBtn) {
  addProductBtn.addEventListener('click', () => {
    window.location.href = 'add-product.html';
  });
}
