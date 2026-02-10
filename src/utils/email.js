// Src/utils/email.js - ClockWork Email Service (SendGrid)
const { passwordResetTemplate } = require('../templates/emails/passwordReset');
const { welcomeTemplate } = require('../templates/emails/welcome');
const { influencerApprovalTemplate } = require('../templates/emails/influencerApproval');
const { influencerDenialTemplate } = require('../templates/emails/influencerDenial');
const { newInfluencerWelcomeTemplate } = require('../templates/emails/newInfluencerWelcome');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@clockwork.fit';

// Log email config on startup
if (SENDGRID_API_KEY) {
    console.log('✅ SendGrid email service ready');
} else {
    console.log('⚠️ SENDGRID_API_KEY not set - emails will be logged only');
}

/**
 * Send email via SendGrid API
 */
const sendEmail = async (to, subject, html) => {
    // Always log for debugging
    console.log(`📧 [EMAIL] To: ${to}, Subject: ${subject}`);

    if (!SENDGRID_API_KEY) {
        console.log('📧 [SENDGRID NOT CONFIGURED] Email logged but not sent');
        return true;
    }

    try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: FROM_EMAIL, name: 'ClockWork' },
                subject: subject,
                content: [{ type: 'text/html', value: html }]
            })
        });

        if (!res.ok && res.status !== 202) {
            const errorText = await res.text();
            throw new Error(errorText);
        }

        console.log(`✅ Email sent successfully to: ${to}`);
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
    const html = passwordResetTemplate(code);
    const subject = `Your ClockWork Verification Code: ${code}`;
    return sendEmail(email, subject, html);
};

/**
 * Send welcome email on registration
 */
const sendWelcomeEmail = async (email, name) => {
    const html = welcomeTemplate(name, 24);
    const subject = 'Welcome to ClockWork';
    return sendEmail(email, subject, html);
};

const sendInfluencerApprovalEmail = async (email, name, affiliateCode, accountSetupUrl) => {
    const html = influencerApprovalTemplate(name, affiliateCode, accountSetupUrl);
    const subject = `🎉 You're Approved to Join ClockWork as a Creator!`;
    return sendEmail(email, subject, html);
};

const sendInfluencerDenialEmail = async (email, name, reason) => {
    const html = influencerDenialTemplate(name, reason);
    const subject = `ClockWork Partner Application`;
    return sendEmail(email, subject, html);
};

const sendNewInfluencerWelcomeEmail = async (email, name, password) => {
    const html = newInfluencerWelcomeTemplate(name, email, password);
    const subject = `Welcome to the ClockWork Partner Program!`;
    return sendEmail(email, subject, html);
};

module.exports = {
    sendEmail,
    sendPasswordResetCode,
    sendVerificationCode,
    sendWelcomeEmail,
    sendInfluencerApprovalEmail,
    sendInfluencerDenialEmail,
    sendNewInfluencerWelcomeEmail
};
