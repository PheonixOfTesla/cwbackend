// Src/templates/emails/welcome.js - ClockWork Welcome Email

const welcomeTemplate = (name, trialHours = 24) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ClockWork</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#1A1A2E;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 20px;">
              <h1 style="margin:0;color:#00D4FF;font-size:32px;font-weight:800;letter-spacing:-1px;">ClockWork</h1>
            </td>
          </tr>

          <!-- Welcome Message -->
          <tr>
            <td align="center" style="padding:0 40px 30px;">
              <h2 style="margin:0 0 16px;color:#FFFFFF;font-size:24px;font-weight:600;">
                ${name ? name.split(' ')[0] : 'Welcome'}, you're in.
              </h2>
              <p style="margin:0;color:#888888;font-size:15px;line-height:1.6;">
                Your ${trialHours}-hour Pro trial starts now.
              </p>
            </td>
          </tr>

          <!-- Trial Badge -->
          <tr>
            <td align="center" style="padding:0 40px 30px;">
              <div style="background:linear-gradient(135deg, #00D4FF 0%, #00FF88 100%);border-radius:8px;padding:16px 32px;display:inline-block;">
                <span style="color:#0A0A0A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">PRO ACCESS UNLOCKED</span>
              </div>
            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding:0 40px 30px;">
              <p style="margin:0 0 16px;color:#FFFFFF;font-size:14px;font-weight:600;">What's next:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#888888;font-size:14px;">
                    <span style="color:#00D4FF;margin-right:12px;">1.</span>Complete your profile
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#888888;font-size:14px;">
                    <span style="color:#00D4FF;margin-right:12px;">2.</span>Set your training goals
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#888888;font-size:14px;">
                    <span style="color:#00D4FF;margin-right:12px;">3.</span>Let FORGE build your first program
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <a href="https://clockwork.fit" style="display:inline-block;background:#00D4FF;color:#0A0A0A;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:8px;">
                Open ClockWork →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px;border-top:1px solid #333333;background:#151525;">
              <p style="margin:0;color:#888888;font-size:13px;text-align:center;font-style:italic;">
                — FORGE, your AI coach
              </p>
            </td>
          </tr>
        </table>

        <!-- Sub-footer -->
        <table width="100%" style="max-width:480px;padding:20px 0;">
          <tr>
            <td align="center">
              <p style="margin:0;color:#444444;font-size:11px;">
                © ${new Date().getFullYear()} ClockWork. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { welcomeTemplate };
