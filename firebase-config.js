import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBrhhpGsDEIH46um9FS2j8uTleOwzPrHZ8",
    authDomain: "coda-tax.firebaseapp.com",
    projectId: "coda-tax",
    storageBucket: "coda-tax.firebasestorage.app",
    messagingSenderId: "788663710911",
    appId: "1:788663710911:web:33143712e512d6253c820a",
    measurementId: "G-LYGK290Y1Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
