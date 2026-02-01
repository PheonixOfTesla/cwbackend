// newInfluencerWelcome.js
const newInfluencerWelcomeTemplate = (name, email, password) => {
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
                <h1>Welcome to the ClockWork Partner Program!</h1>
            </div>
            <div class="content">
                <p>Hey ${name},</p>
                <p>We're excited to have you on board! Your influencer account has been created.</p>
                <p>You can now log in to your dashboard to get your affiliate code and track your performance.</p>
                <p><strong>Login Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> ${password}</p>
                <p>We recommend changing your password after you log in for the first time.</p>
                <p><a href="https://clockwork.fit/influencer" style="color: #f97316;">Go to your Dashboard</a></p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ClockWork. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = { newInfluencerWelcomeTemplate };
