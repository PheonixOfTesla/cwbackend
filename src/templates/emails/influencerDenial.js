// influencerDenial.js
const influencerDenialTemplate = (name, reason) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #e5e5e5; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #1a1a2e; border: 1px solid #3a3a5e; border-radius: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { color: #f97316; }
            .content { line-height: 1.6; }
            .footer { margin-top: 30px; text-align: center; color: #888888; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ClockWork Partner Application</h1>
            </div>
            <div class="content" style="color: #ffffff;">
                <p style="color: #ffffff;">Hey ${name},</p>
                <p style="color: #ffffff;">Thanks for your interest in partnering with ClockWork. We received a high volume of applications, and at this time, we're unable to move forward with your application.</p>
                <p style="color: #ffffff;">This is often due to our current focus on specific niches or audience engagement metrics. We encourage you to continue creating great content.</p>
                ${reason ? `<p style="color: #ffffff;"><strong style="color: #ffffff;">Reason:</strong> ${reason}</p>` : ''}
                <p style="color: #ffffff;">The door isn't closed forever. We welcome you to reapply in the future as our program evolves.</p>
                <p style="color: #ffffff;">Best regards,</p>
                <p style="color: #ffffff;">— The ClockWork Team</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ClockWork. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = { influencerDenialTemplate };
