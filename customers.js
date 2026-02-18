document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    const tableBody = document.querySelector('#customerTable tbody');
    const searchInput = document.getElementById('customerSearch');
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    const addBtn = document.getElementById('addCustomerBtn');
    const closeBtn = document.getElementById('closeCustomerModal');
    const modalTitle = document.getElementById('modalTitle');
    const logoutBtn = document.getElementById('logoutBtn');

    let allCustomers = [];

    // --- Fetch Customers ---
    const loadCustomers = () => {
        db.collection("customers").orderBy("name").onSnapshot(snapshot => {
            allCustomers = [];
            snapshot.forEach(doc => {
                allCustomers.push({ id: doc.id, ...doc.data() });
            });
            renderCustomers(allCustomers);
        }, err => console.error(err));
    };

    // --- Render ---
    const renderCustomers = (customers) => {
        tableBody.innerHTML = "";
        if (customers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No customers found.</td></tr>';
            return;
        }
        customers.forEach(cust => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td style="font-weight: 500;">${cust.name}</td>
        <td>${cust.email}</td>
        <td>${cust.phone || '-'}</td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cust.address || '-'}</td>
        <td class="actions">
          <button class="edit-btn btn btn-outline btn-sm" data-id="${cust.id}">Edit</button>
          <button class="delete-btn btn btn-outline btn-sm" style="color: #ef4444; border-color: #ef4444;" data-id="${cust.id}">Delete</button>
        </td>
      `;
            tableBody.appendChild(tr);
        });
    };

    // --- Search ---
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allCustomers.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term)
        );
        renderCustomers(filtered);
    });

    // --- Modal Logic ---
    const openModal = (editMode = false, data = {}) => {
        modal.style.display = 'flex';
        if (editMode) {
            modalTitle.innerText = "Edit Customer";
            document.getElementById('customerId').value = data.id;
            document.getElementById('custName').value = data.name;
            document.getElementById('custEmail').value = data.email;
            document.getElementById('custPhone').value = data.phone || '';
            document.getElementById('custAddress').value = data.address || '';
        } else {
            modalTitle.innerText = "Add Customer";
            form.reset();
            document.getElementById('customerId').value = '';
        }
    };

    addBtn.addEventListener('click', () => openModal(false));
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // --- Form Submit ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('customerId').value;
        const name = document.getElementById('custName').value.trim();
        const email = document.getElementById('custEmail').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const address = document.getElementById('custAddress').value.trim();

        if (!name || !email) return alert("Name and Email are required.");

        try {
            if (id) {
                // Update
                await db.collection("customers").doc(id).update({ name, email, phone, address });
                if (window.logActivity) window.logActivity('update_customer', `Updated customer ${name}`);
            } else {
                // Add
                await db.collection("customers").add({ name, email, phone, address });
                if (window.logActivity) window.logActivity('add_customer', `Added customer ${name}`);
            }
            modal.style.display = 'none';
            form.reset();
        } catch (err) {
            alert("Error saving customer: " + err.message);
        }
    });

    // --- Actions (Edit/Delete) ---
    tableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;

        if (btn.classList.contains('edit-btn')) {
            const cust = allCustomers.find(c => c.id === id);
            if (cust) openModal(true, cust);
        }

        if (btn.classList.contains('delete-btn')) {
            if (confirm("Are you sure you want to delete this customer?")) {
                try {
                    await db.collection("customers").doc(id).delete();
                    if (window.logActivity) window.logActivity('delete_customer', `Deleted a customer`);
                } catch (err) {
                    alert("Error deleting: " + err.message);
                }
            }
        }
    });

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => window.location.href = 'index.html');
        });
    }

    // Init
    loadCustomers();
});
