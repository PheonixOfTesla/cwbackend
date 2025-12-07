// Src/utils/email.js - Send codes via Twilio SMS
const twilio = require('twilio');

let twilioClient = null;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio SMS ready');
}

// Send SMS with code
const sendSMS = async (to, message) => {
    if (!twilioClient || !twilioPhone) {
        console.log(`📱 [SMS NOT CONFIGURED] To: ${to}, Message: ${message}`);
        return false;
    }
    try {
        await twilioClient.messages.create({
            body: message,
            from: twilioPhone,
            to: to
        });
        console.log(`📱 SMS sent to: ${to}`);
        return true;
    } catch (error) {
        console.error('SMS error:', error.message);
        return false;
    }
};

// For password reset - we'll log code since we don't have user phone numbers
const sendPasswordResetCode = async (email, code) => {
    // Just log the code - could integrate with email service later
    console.log(`🔐 PASSWORD RESET CODE for ${email}: ${code}`);
    return true; // Return true so the flow continues
};

const sendVerificationCode = async (email, code) => {
    console.log(`🔐 VERIFICATION CODE for ${email}: ${code}`);
    return true;
};

module.exports = { sendSMS, sendPasswordResetCode, sendVerificationCode };
