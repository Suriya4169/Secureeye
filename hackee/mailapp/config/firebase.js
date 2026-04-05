// config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase config removed for security. Do not store secrets in app code.
// Use secure backend endpoints to interact with Firebase or other services.
const firebaseConfig = null;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;