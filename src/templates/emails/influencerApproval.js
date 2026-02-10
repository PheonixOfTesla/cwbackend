// influencerApproval.js
const influencerApprovalTemplate = (name, affiliateCode, accountSetupUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #1a1a2e; border: 1px solid #3a3a5e; border-radius: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { color: #f97316; }
            .content { line-height: 1.6; color: #ffffff; }
            .button { display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .code { background: #2a2a3e; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #f97316; }
            .footer { margin-top: 30px; text-align: center; color: #aaaaaa; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You're Approved to Join ClockWork as a Creator!</h1>
            </div>
            <div class="content">
                <p>Hey ${name},</p>
                <p>Congratulations! Your application to join ClockWork as a creator has been <strong>approved</strong>.</p>
                <p>We reviewed your content and audience — you're exactly the kind of creator we want representing ClockWork.</p>

                <h3>🎯 Your Affiliate Code:</h3>
                <div class="code">${affiliateCode}</div>

                <h3>✅ Next Steps:</h3>
                <ol>
                    <li><strong>Create your creator account</strong> (click the button below)</li>
                    <li>Access your Creator Studio dashboard</li>
                    <li>Connect your Stripe account to receive payouts</li>
                    <li>Start earning <strong>$4.99 recurring commission</strong> for every paid subscriber</li>
                </ol>

                <div style="text-align: center;">
                    <a href="${accountSetupUrl}" class="button">Create My Creator Account</a>
                </div>

                <p style="margin-top: 20px; font-size: 14px; color: #cccccc;">
                    <strong>Note:</strong> This link expires in 7 days. If it expires, contact support for a new invitation.
                </p>

                <p style="margin-top: 30px;">Once you're in, you'll have access to:</p>
                <ul>
                    <li>📊 Real-time analytics dashboard</li>
                    <li>💰 Earnings tracking & payout management</li>
                    <li>🎨 Marketing assets & content templates</li>
                    <li>🔗 Custom referral links</li>
                </ul>

                <p>Ready to get started? Click the button above to create your account.</p>

                <p>Let's build something great together.</p>
                <p>— The ClockWork Team</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ClockWork. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = { influencerApprovalTemplate };
