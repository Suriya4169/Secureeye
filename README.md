# SecureEye & Hackee Workspace

Welcome to the SecureEye and Hackee repository! This workspace contains two key projects.

## 📂 Projects Overview

### 1. SecureEye
**SecureEye** is a robust, Shinobi-inspired security and surveillance system. 
- **Backend:** A Node.js server that handles real-time data, JWT-based OTP authentication, and integrates with Supabase.
- **Laptop CCTV Dashboard:** A web-based dashboard and live camera streaming setup that performs object/person detection. It supports automated email alerts, webhooks, and Twilio voice calls when threats are detected.
- **Mobile/Web App:** A cross-platform frontend (Expo/React Native) for remote monitoring, live-view access, and push notifications.

### 2. Hackee
**Hackee** is an Expo React Native application focusing on secure communication features, email dispatching features, and premium UI experiences.

---

## 🚀 Getting Started

*Note: For security reasons, environment variables (`.env`) and API Keys are intentionally excluded from this repository.*

To run the repositories locally, you must create `.env` files in their respective roots (you can use `.env.example` as a template). 

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

For either project, simply navigate to the respective directory and install the dependencies.

```bash
# Example for SecureEye Backend
cd secureeye/backend
npm install
npm run dev
```

```bash
# Example for Hackee App
cd hackee/mailapp
npm install
npx expo start
```

## 🔒 Security
All sensitive tokens (Supabase Anon Keys, Twilio Account SIDs, Gmail App Passwords, etc.) must be stored securely locally and are never committed to version control.
