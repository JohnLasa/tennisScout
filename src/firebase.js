import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBHUtqvV9s-wLSoA0p_uBW1xBIBj5tBnS8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "tennisscout-9e2ac.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "tennisscout-9e2ac",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "tennisscout-9e2ac.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "696089785565",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:696089785565:web:dc81f31d7e390fbe861734",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-8N82TN06EN"
};

let app;
let db;

try {
  console.log('Initializing Firebase...');
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized');
  
  db = getFirestore(app);
  console.log('Firestore initialized');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

// Test Firebase connection
const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    const testCollection = collection(db, 'matches');
    const querySnapshot = await getDocs(testCollection);
    console.log('Successfully connected to Firestore. Found', querySnapshot.size, 'documents in matches collection');
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};

// Run the test
testFirebaseConnection();

export { db }; 