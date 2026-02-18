import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import io
from flask import Flask, send_file, send_from_directory, request, jsonify
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# Use absolute path for robustness in different environments (like Vercel)
basedir = os.path.abspath(os.path.dirname(__file__))

@app.route('/')
def index():
    return send_from_directory(basedir, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Security check: prevent traversing up directories
    safe_path = os.path.normpath(os.path.join(basedir, path))
    if not safe_path.startswith(basedir):
         return "Access Denied", 403

    if os.path.exists(safe_path) and os.path.isfile(safe_path):
        return send_from_directory(basedir, path)
    return "File not found", 404

# --- Security: Dynamic Firebase Config ---
@app.route('/firebase-config.js')
def serve_firebase_config():
    # Load from env vars
    api_key = os.getenv("GOOGLE_API_KEY")
    project_id = os.getenv("PROJECT_ID")
    
    # Construct JS content
    config_js = f"""
    const firebaseConfig = {{
        apiKey: "{api_key}",
        authDomain: "{project_id}.firebaseapp.com",
        projectId: "{project_id}",
        storageBucket: "{project_id}.firebasestorage.app",
        messagingSenderId: "17978104214",
        appId: "1:17978104214:web:efeb529844156dee5ae5b7",
        measurementId: "G-EWW793K897"
    }};

    firebase.initializeApp(firebaseConfig);

    // Initialize Firebase Services
    const auth = firebase.auth();
    const db = firebase.firestore();
    """
    
    return config_js, 200, {'Content-Type': 'application/javascript'}

# --- Chart Endpoints (Corrected: Receive Data via POST) ---

@app.route('/render/product_category', methods=['POST'])
def render_product_category():
    data = request.json
    products = data.get('products', [])
    
    counts = {}
    for p in products:
        cat = p.get('category', 'Uncategorized')
        counts[cat] = counts.get(cat, 0) + 1
    
    if not counts:
        counts = {'No Data': 1}
        
    labels = list(counts.keys())
    sizes = list(counts.values())
    
    # Plot
    fig, ax = plt.subplots(figsize=(6, 6))
    colors = ['#6366f1', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
    wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors[:len(labels)])
    
    # Styling
    plt.setp(texts, size=10, weight="bold")
    plt.setp(autotexts, size=10, weight="bold", color="white")
    ax.axis('equal')
    
    img = io.BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight', transparent=True)
    img.seek(0)
    plt.close()
    return send_file(img, mimetype='image/png')

@app.route('/render/product_stock', methods=['POST'])
def render_product_stock():
    data = request.json
    products = data.get('products', [])
    
    # Sort by stock ascending
    products.sort(key=lambda x: int(x.get('stock', 0)))
    
    top_low = products[:10]
    names = [p.get('name', 'Unknown') for p in top_low]
    stocks = [int(p.get('stock', 0)) for p in top_low]
    
    if not names:
        names = ['No Products']
        stocks = [0]
    
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(names, stocks, color='#6366f1')
    
    # Styling
    ax.set_ylabel('Stock Level')
    ax.set_title('Lowest Stock Products')
    plt.xticks(rotation=45, ha='right')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    img = io.BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight', transparent=True)
    img.seek(0)
    plt.close()
    return send_file(img, mimetype='image/png')

@app.route('/render/quote_status', methods=['POST'])
def render_quote_status():
    data = request.json
    quotes = data.get('quotes', [])
    
    counts = {'Pending': 0, 'Accepted': 0, 'Rejected': 0}
    for q in quotes:
        status = q.get('status', 'Pending')
        counts[status] = counts.get(status, 0) + 1
        
    labels = list(counts.keys())
    sizes = list(counts.values())
    
    # Filter out zero values
    filtered_labels = []
    filtered_sizes = []
    filtered_colors = []
    color_map = {'Pending': '#f59e0b', 'Accepted': '#10b981', 'Rejected': '#ef4444'}
    
    for i, label in enumerate(labels):
        if sizes[i] > 0:
            filtered_labels.append(label)
            filtered_sizes.append(sizes[i])
            filtered_colors.append(color_map.get(label, '#ccc'))
            
    if not filtered_sizes:
        filtered_labels = ['No Data']
        filtered_sizes = [1]
        filtered_colors = ['#e2e8f0']

    fig, ax = plt.subplots(figsize=(6, 6))
    wedges, texts, autotexts = ax.pie(filtered_sizes, labels=filtered_labels, autopct='%1.1f%%', startangle=90, colors=filtered_colors)
    
    plt.setp(texts, size=10, weight="bold")
    plt.setp(autotexts, size=10, weight="bold", color="white")
    ax.axis('equal')
    
    img = io.BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight', transparent=True)
    img.seek(0)
    plt.close()
    return send_file(img, mimetype='image/png')

@app.route('/render/revenue_trend', methods=['POST'])
def render_revenue_trend():
    data = request.json
    quotes = data.get('quotes', [])
    
    # Process data: Group by Date -> Sum Total
    revenue_by_date = {}
    for q in quotes:
        # Use createdAt or date, slice to YYYY-MM-DD
        date_str = q.get('createdAt') or q.get('date')
        if date_str:
            date_key = date_str[:10] # YYYY-MM-DD
            # Calculate total if not present
            total = q.get('totalAmount') or q.get('grandTotal')
            if not total:
                 products = q.get('products', [])
                 total = sum(float(p.get('price', 0)) * int(p.get('quantity', 1)) for p in products)
            
            revenue_by_date[date_key] = revenue_by_date.get(date_key, 0) + float(total)
            
    # Sort by date
    sorted_dates = sorted(revenue_by_date.keys())
    revenues = [revenue_by_date[d] for d in sorted_dates]
    
    if not sorted_dates:
        sorted_dates = ['No Data']
        revenues = [0]

    # Plot
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(sorted_dates, revenues, marker='o', linestyle='-', color='#10b981', linewidth=2)
    ax.fill_between(sorted_dates, revenues, color='#10b981', alpha=0.1)
    
    ax.set_title('Revenue Trend (Daily)', fontsize=14, fontweight='bold', color='#333')
    ax.set_ylabel('Revenue (₹)')
    plt.xticks(rotation=45, ha='right')
    ax.grid(True, linestyle='--', alpha=0.5)
    
    # Remove spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    img = io.BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight', transparent=True)
    img.seek(0)
    plt.close()
    return send_file(img, mimetype='image/png')

@app.route('/render/top_products', methods=['POST'])
def render_top_products():
    data = request.json
    quotes = data.get('quotes', [])
    
    # Count product occurrences
    product_counts = {}
    for q in quotes:
        products = q.get('products', [])
        for p in products:
            name = p.get('name', 'Unknown')
            qty = int(p.get('quantity', 1))
            product_counts[name] = product_counts.get(name, 0) + qty
            
    # Sort and take top 5
    sorted_products = sorted(product_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    if not sorted_products:
        names = ['No Data']
        counts = [0]
    else:
        names = [item[0] for item in sorted_products]
        counts = [item[1] for item in sorted_products]
        
    # Plot Horizontal Bar
    fig, ax = plt.subplots(figsize=(8, 5))
    y_pos = range(len(names))
    ax.barh(y_pos, counts, color='#f59e0b')
    ax.set_yticks(y_pos)
    ax.set_yticklabels(names)
    ax.invert_yaxis()  # labels read top-to-bottom
    
    ax.set_title('Top Selling Products', fontsize=14, fontweight='bold', color='#333')
    ax.set_xlabel('Quantity Sold')
    
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    img = io.BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight', transparent=True)
    img.seek(0)
    plt.close()
    return send_file(img, mimetype='image/png')

if __name__ == '__main__':
    print("Starting Flask Server...")
    print("Access at http://127.0.0.1:5000")
    app.run(port=5000, debug=True)
