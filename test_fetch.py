import requests
import json

PROJECT_ID = "productmanagement-dd3d9"
API_KEY = "AIzaSyAhMolMoUpwOicmDlsVLI7iktI04tRuMh8"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def get_firestore_data(collection):
    url = f"{BASE_URL}/{collection}?key={API_KEY}&pageSize=100"
    print(f"Fetching: {url}")
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        documents = data.get('documents', [])
        print(f"Found {len(documents)} documents")
        
        # Transform Firestore format to clean dict
        clean_data = []
        for doc in documents:
            fields = doc.get('fields', {})
            item = {}
            for k, v in fields.items():
                # Extract value based on type (stringValue, integerValue, etc.)
                for type_key, val in v.items():
                    item[k] = val
            clean_data.append(item)
            print(f"Parsed item: {item}")
        return clean_data
    else:
        print("Error response:", response.text)
        return []

print("--- Products ---")
products = get_firestore_data('products')

print("\n--- Quotes ---")
quotes = get_firestore_data('quotes')
