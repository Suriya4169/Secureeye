// config/emailjs.js
// 🔧 SETUP REQUIRED:
// 1. Go to https://www.emailjs.com → Create free account
// 2. Add an Email Service (Gmail, Outlook, etc.)
// 3. Create an Email Template with variables: {{to_email}}, {{message}}, {{from_name}}
// 4. Get your Public Key from Account → API Keys

export const EMAILJS_CONFIG = {
  SERVICE_ID: "YOUR_SERVICE_ID",     // e.g. "service_abc123"
  TEMPLATE_ID: "YOUR_TEMPLATE_ID",   // e.g. "template_xyz789"
  PUBLIC_KEY: "YOUR_PUBLIC_KEY",     // e.g. "abcDEFghiJKL123"
};

// EmailJS Template should look like this:
// Subject: Message from {{from_name}}
// Body: {{message}}
