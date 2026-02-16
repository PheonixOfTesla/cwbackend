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
            <div class="content" style="color: #ffffff;">
                <p style="color: #ffffff;">Hey ${name},</p>
                <p style="color: #ffffff;">Congratulations! Your application to join ClockWork as a creator has been <strong style="color: #ffffff;">approved</strong>.</p>
                <p style="color: #ffffff;">We reviewed your content and audience — you're exactly the kind of creator we want representing ClockWork.</p>

                <h3 style="color: #ffffff;">🎯 Your Affiliate Code:</h3>
                <div class="code" style="background: #2a2a3e; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #f97316;">${affiliateCode}</div>

                <h3 style="color: #ffffff;">✅ How It Works:</h3>
                <p style="color: #ffffff;">Here's everything you need to know to start earning with ClockWork. First, click the button below to create your creator account using this email address. Once logged in, you'll be taken directly to your Creator Studio dashboard where you can manage your content, track earnings, and access marketing materials.</p>

                <p style="color: #ffffff;">As a ClockWork creator, you earn <strong style="color: #f97316;">90% of all revenue</strong> from subscribers who sign up using your unique affiliate code or referral link. This means when someone subscribes through your link, you keep $26.99 of every $29.99 monthly subscription (or 90% of any plan they choose). Your earnings are tracked in real-time and displayed on your dashboard.</p>

                <p style="color: #ffffff;">To receive payments, you'll need to connect your Stripe account from the Creator Studio settings. Once connected, payouts are processed automatically on the 1st and 15th of each month, with a minimum payout threshold of $50. You can track all pending and completed payouts in your earnings dashboard.</p>

                <p style="color: #ffffff;">Your Creator Studio gives you everything you need to succeed: shareable referral links, downloadable marketing assets, content templates, and detailed analytics showing clicks, conversions, and revenue. You can also create exclusive content for your audience and manage your public creator profile.</p>

                <h3 style="color: #ffffff;">🚀 Quick Start Steps:</h3>
                <ol style="color: #ffffff;">
                    <li style="color: #ffffff;"><strong style="color: #ffffff;">Create your account</strong> using the button below (link expires in 7 days)</li>
                    <li style="color: #ffffff;"><strong style="color: #ffffff;">Connect Stripe</strong> in Settings to enable payouts</li>
                    <li style="color: #ffffff;"><strong style="color: #ffffff;">Share your link</strong> with your audience and start earning 90%</li>
                </ol>

                <div style="text-align: center;">
                    <a href="${accountSetupUrl}" class="button" style="display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Create My Creator Account</a>
                </div>

                <p style="margin-top: 20px; font-size: 14px; color: #cccccc;">
                    <strong style="color: #cccccc;">Note:</strong> This link expires in 7 days. If it expires, contact support for a new invitation.
                </p>

                <p style="margin-top: 30px; color: #ffffff;">Once you're in, you'll have access to:</p>
                <ul style="color: #ffffff;">
                    <li style="color: #ffffff;">📊 Real-time analytics dashboard</li>
                    <li style="color: #ffffff;">💰 Earnings tracking & payout management</li>
                    <li style="color: #ffffff;">🎨 Marketing assets & content templates</li>
                    <li style="color: #ffffff;">🔗 Custom referral links</li>
                </ul>

                <p style="color: #ffffff;">Ready to get started? Click the button above to create your account.</p>

                <p style="color: #ffffff;">Let's build something great together.</p>
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

module.exports = { influencerApprovalTemplate };
