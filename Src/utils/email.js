// Src/utils/email.js - ClockWork Email Service (Resend)
const { passwordResetTemplate } = require('../templates/emails/passwordReset');
const { welcomeTemplate } = require('../templates/emails/welcome');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'ClockWork <onboarding@resend.dev>';

// Log email config on startup
if (RESEND_API_KEY) {
    console.log('✅ Resend email service ready');
} else {
    console.log('⚠️ RESEND_API_KEY not set - emails will be logged only');
}

/**
 * Send email via Resend API
 */
const sendEmail = async (to, subject, html) => {
    // Always log for debugging
    console.log(`📧 [EMAIL] To: ${to}, Subject: ${subject}`);

    if (!RESEND_API_KEY) {
        console.log('📧 [RESEND NOT CONFIGURED] Email logged but not sent');
        return true;
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: to,
                subject: subject,
                html: html
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText);
        }

        const data = await res.json();
        console.log(`✅ Email sent successfully: ${data.id}`);
        return true;

    } catch (error) {
        console.error('❌ Email send error:', error.message);
        return false;
    }
};

/**
 * Send password reset code email
 */
const sendPasswordResetCode = async (email, code) => {
    const html = passwordResetTemplate(code);
    const subject = `Your ClockWork Reset Code: ${code}`;
    return sendEmail(email, subject, html);
};

/**
 * Send verification code email (for login 2FA if enabled)
 */
const sendVerificationCode = async (email, code) => {
    const html = passwordResetTemplate(code); // Reuse template
    const subject = `Your ClockWork Verification Code: ${code}`;
    return sendEmail(email, subject, html);
};

/**
 * Send welcome email on registration
 */
const sendWelcomeEmail = async (email, name) => {
    const html = welcomeTemplate(name, 24); // 24-hour trial
    const subject = 'Welcome to ClockWork';
    return sendEmail(email, subject, html);
};

module.exports = {
    sendEmail,
    sendPasswordResetCode,
    sendVerificationCode,
    sendWelcomeEmail
};
