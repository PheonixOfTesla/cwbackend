// influencerApproval.js
const influencerApprovalTemplate = (name, affiliateCode, stripeConnectLink) => {
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
            .button { display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; color: #888888; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>You're Approved to Partner with ClockWork ⚡</h1>
            </div>
            <div class="content">
                <p>Hey ${name},</p>
                <p>We reviewed your application. Your content + audience align perfectly with ClockWork's mission.</p>
                <p>We're selective about who represents our brand. <strong>You made the cut.</strong></p>
                <p>Here's what's next:</p>
                <ol>
                    <li><strong>Complete Stripe onboarding</strong> (link below) — takes 5 min</li>
                    <li>Once approved, you'll get access to your partner dashboard</li>
                    <li>Earn <strong>$4.99 recurring commission</strong> for every paid subscriber you refer</li>
                </ol>
                <p><strong>Your Code:</strong> ${affiliateCode}</p>
                <p><strong>Dashboard:</strong> <a href="https://clockwork.fit/influencer" style="color: #f97316;">https://clockwork.fit/influencer</a></p>
                <a href="${stripeConnectLink}" class="button">Set Up Payouts on Stripe</a>
                <p style="margin-top: 20px;">We'll get you assets + talking points by tomorrow.</p>
                <p>Let's build something great.</p>
                <p>— Josh & the ClockWork Team</p>
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
