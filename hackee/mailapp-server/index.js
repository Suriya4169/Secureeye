// index.js
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,   // your Gmail address
    pass: process.env.GMAIL_PASS,   // your Gmail App Password
  },
});

// Health check route
app.get("/", (req, res) => {
  res.json({ status: "MailBox server is running ✅" });
});

// Send email route
app.post("/send-email", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Missing 'to' or 'message' field." });
  }

  try {
    await transporter.sendMail({
      from: `"MailBox App" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: "📬 New Message from MailBox App",
      text: message,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
          <h2 style="color: #6366f1;">📬 MailBox App</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">You sent yourself a message:</p>
          <div style="background: #fff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="color: #0f172a; font-size: 16px; margin: 0;">${message}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">Sent via MailBox App • ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (err) {
    console.error("Email error:", err.message);
    res.status(500).json({ error: "Failed to send email.", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // ...existing code...
});
