import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCFxnHjd3s4A3nK7yDq3Uts_dcycm4SZjw",
  authDomain: "swd-osp-app-921.firebaseapp.com",
  projectId: "swd-osp-app-921",
  storageBucket: "swd-osp-app-921.firebasestorage.app",
  messagingSenderId: "506477581128",
  appId: "1:506477581128:web:8bb62380d3b395d7d4d97d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
