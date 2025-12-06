// Src/utils/email.js - Simple email utility using Nodemailer
const nodemailer = require('nodemailer');

// Create transporter (configure via env vars)
let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    console.log('✅ Email transporter configured');
} else {
    console.log('⚠️ Email not configured - set SMTP_HOST, SMTP_USER, SMTP_PASS');
}

const sendEmail = async ({ to, subject, text, html }) => {
    if (!transporter) {
        console.log(`📧 [EMAIL NOT CONFIGURED] To: ${to}, Subject: ${subject}`);
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html
        });
        console.log(`📧 Email sent to: ${to}`);
        return true;
    } catch (error) {
        console.error('Email send error:', error.message);
        return false;
    }
};

const sendVerificationCode = async (email, code) => {
    return sendEmail({
        to: email,
        subject: 'ClockWork - Verify Your Login',
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f97316; text-align: center;">ClockWork</h2>
                <p style="text-align: center; color: #666;">Your verification code is:</p>
                <div style="background: #1a1a1a; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="text-align: center; color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
            </div>
        `
    });
};

const sendPasswordResetCode = async (email, code) => {
    return sendEmail({
        to: email,
        subject: 'ClockWork - Password Reset Code',
        text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f97316; text-align: center;">ClockWork</h2>
                <p style="text-align: center; color: #666;">Your password reset code is:</p>
                <div style="background: #1a1a1a; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="text-align: center; color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
                <p style="text-align: center; color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
            </div>
        `
    });
};

module.exports = { sendEmail, sendVerificationCode, sendPasswordResetCode };
