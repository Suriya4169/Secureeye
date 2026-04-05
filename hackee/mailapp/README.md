# ✉️ MailBox App — Setup Guide

A React Native (Expo) app that lets users sign up, verify their email, log in, and send messages to their own email.

---

## 📁 Project Structure

```
mailapp/
├── App.js                    # Root: navigation + auth listener
├── app.json                  # Expo config
├── package.json
├── babel.config.js
├── config/
│   ├── firebase.js           # 🔧 Firebase credentials go here
│   └── emailjs.js            # 🔧 EmailJS credentials go here
└── screens/
    ├── LoginScreen.js        # Login with email + password
    ├── SignupScreen.js       # Signup + email verification flow
    └── HomeScreen.js         # Compose & send email to self
```

---

## 🚀 Step-by-Step Setup

### Step 1 — Install Dependencies

```bash
cd mailapp
npm install
npx expo install @react-native-async-storage/async-storage
```

### Step 2 — Set Up Firebase

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → name it (e.g., "MailBox")
3. After creation, click **"Web"** icon (`</>`) to add a web app
4. Copy the `firebaseConfig` object
5. Paste it into **`config/firebase.js`**

Then enable Email/Password Auth:
- In Firebase Console → **Authentication** → **Sign-in method**
- Enable **Email/Password**

### Step 3 — Set Up EmailJS (Free)

1. Go to [https://www.emailjs.com](https://www.emailjs.com) → Create free account
2. **Add Email Service**: Connect your Gmail/Outlook
3. **Create Email Template**:
   - Click "Email Templates" → "Create New Template"
   - Set Subject: `Message from {{from_name}}`
   - Set Body: `{{message}}`
   - Add `{{to_email}}` in the "To Email" field
4. Copy your **Service ID**, **Template ID**, and **Public Key**
5. Paste them into **`config/emailjs.js`**

### Step 4 — Run the App

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone.

---

## 🔄 App Flow

```
Open App
   │
   ├── Not logged in → Login Screen
   │         │
   │         └── No account? → Signup Screen
   │                   │
   │                   └── Fill form → Account created
   │                             → Verification email sent 📬
   │                             → Click link in email
   │                             → Tap "I've Verified" button
   │                             → Redirected to Login
   │
   └── Logged in + Verified → Home Screen
               │
               └── Type message → Click "Send to My Email"
                         → Email arrives in your inbox ✅
```

---

## 💡 Features

| Feature | Status |
|---|---|
| Email + Password Signup | ✅ |
| Email Verification (link-based OTP) | ✅ |
| Login with credentials | ✅ |
| Auto-redirect based on auth state | ✅ |
| Send email to logged-in user | ✅ |
| Sent message history (session) | ✅ |
| Logout | ✅ |
| Dark UI theme | ✅ |

---

## 🔧 Troubleshooting

- **"Firebase app not initialized"** → Check your `config/firebase.js` credentials
- **"EmailJS 400 error"** → Double-check Service ID, Template ID, and Public Key
- **Verification email not arriving** → Check spam folder; resend from app
- **App crashes on start** → Run `npx expo install` to fix dependency mismatches
