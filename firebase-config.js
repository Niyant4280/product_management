const firebaseConfig = {
  apiKey: "AIzaSyCCsci5fLx88FrvUETPcGwFRWcQ8vo2zQg",
  authDomain: "productmanagement-dd3d9.firebaseapp.com",
  projectId: "productmanagement-dd3d9",
  storageBucket: "productmanagement-dd3d9.firebasestorage.app",
  messagingSenderId: "17978104214",
  appId: "1:17978104214:web:efeb529844156dee5ae5b7",
  measurementId: "G-EWW793K897"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();

// Removed modular initializeApp/getAnalytics to avoid ReferenceError with compat SDK
