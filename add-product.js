document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const form = document.getElementById('addProductForm');
    const msg = document.getElementById('formMsg');
    const cancelBtn = document.getElementById('cancelBtn');

    // Logout Logic
    document.getElementById('logoutBtn').addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    cancelBtn.addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    // Auto-manage status based on stock
    document.getElementById('stock').addEventListener('input', () => {
        const stock = parseInt(document.getElementById('stock').value);
        const statusSelect = document.getElementById('status');

        if (stock === 0) {
            statusSelect.value = 'Out of Stock';
            // Optional: disable if you want to force it
        } else {
            if (statusSelect.value === 'Out of Stock') {
                statusSelect.value = 'Available';
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const price = parseFloat(document.getElementById('price').value);
        const category = document.getElementById('category').value.trim();
        const stock = parseInt(document.getElementById('stock').value);
        let status = document.getElementById('status').value;

        if (stock === 0) status = 'Out of Stock';

        if (!name || isNaN(price) || !category || isNaN(stock)) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Please fill in all fields correctly.';
            return;
        }

        try {
            await db.collection('products').add({ name, price, category, stock, status });
            // Log Activity
            if (window.logActivity) {
                // Note: logActivity might not be available if dashboard.js isn't loaded. 
                // We should probably define logActivity globally or import it.
                // For now, let's just log if available or manually add to collection.
                const user = firebase.auth().currentUser;
                db.collection("activity_log").add({
                    action: 'add_product',
                    description: `Added product ${name}`,
                    user: user ? (user.displayName || user.email) : 'Unknown',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(console.error);
            } else {
                // Fallback if logActivity is not global (it is in dashboard.js but not here)
                const user = firebase.auth().currentUser;
                db.collection("activity_log").add({
                    action: 'add_product',
                    description: `Added product ${name}`,
                    user: user ? (user.displayName || user.email) : 'Unknown',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(console.error);
            }

            msg.style.color = '#10b981';
            msg.textContent = 'Product added successfully!';
            setTimeout(() => window.location.href = 'dashboard.html', 900);
        } catch (err) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Error adding product: ' + err.message;
        }
    });
});
