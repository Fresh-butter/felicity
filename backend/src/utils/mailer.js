// mailer.js — Email + Discord utilities

import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fetch from "node-fetch"; // safe for all Node versions

dotenv.config();

// -------------------- ENV CHECK --------------------
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("⚠️ EMAIL_USER or EMAIL_PASS missing in .env");
}

// -------------------- EMAIL SETUP --------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email service connection failed:", error.message);
  } else {
    console.log("✅ Email service connected successfully");
  }
});

// -------------------- EMAIL FUNCTION --------------------
export const sendTicketEmail = async (recipientEmail, ticketData) => {
  if (!recipientEmail) {
    console.warn("⚠️ No recipient email provided");
    return;
  }

  const {
    eventName,
    participantName,
    ticketId,
    qrCode,
    eventDate,
  } = ticketData;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleString()
    : "N/A";

  // Build inline attachment and HTML reference for the QR code.
  // Email clients block base64 data: URLs in <img src>, so we attach the
  // PNG as an inline CID attachment and reference it via cid: instead.
  let qrCodeHtml = "";
  const attachments = [];

  if (qrCode) {
    // qrCode is "data:image/png;base64,<data>" — strip the prefix
    const base64Data = qrCode.replace(/^data:image\/png;base64,/, "");
    attachments.push({
      filename: "ticket-qr.png",
      content: base64Data,
      encoding: "base64",
      cid: "ticketqr@felicity", // unique content ID
    });
    qrCodeHtml = `<p><strong>QR Code:</strong></p><img src="cid:ticketqr@felicity" width="200" alt="Ticket QR Code" />`;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `Felicity — Ticket for ${eventName}`,
    html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto;">
        <h2 style="color: #4CAF50;">🎉 Registration Confirmed!</h2>
        <p>Hi <strong>${participantName}</strong>,</p>
        <p>You are registered for <strong>${eventName}</strong>.</p>
        <hr />
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p><strong>Event Date:</strong> ${formattedDate}</p>
        ${qrCodeHtml}
        <hr />
        <p style="color: #888;">Felicity Event System</p>
      </div>
    `,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Ticket email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
  }
};

// -------------------- DISCORD WEBHOOK --------------------


// Post a new event notification to a Discord channel via webhook
export const sendDiscordWebhook = async (webhookUrl, eventData) => {
    if (!webhookUrl) {
        return;
    }

    // Format dates for the message
    const startDateFormatted = new Date(eventData.startDate).toLocaleDateString();
    const endDateFormatted = new Date(eventData.endDate).toLocaleDateString();

    // Build comma-separated tags or fallback text
    const tagsText = eventData.tags && eventData.tags.length > 0
        ? eventData.tags.join(", ")
        : "No tags";

    // Build the Discord message content
    const messageContent = `📢 **New Event Published!**\n**${eventData.name}**\n${eventData.description}\n📅 ${startDateFormatted} — ${endDateFormatted}\n🎯 ${eventData.eligibility}\n🏷️ ${tagsText}`;

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: messageContent }),
        });
        console.log("Discord webhook sent");
    } catch (error) {
        console.error("Discord webhook failed:", error.message);
    }
};
