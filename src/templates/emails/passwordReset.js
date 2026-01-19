// Src/templates/emails/passwordReset.js - ClockWork Password Reset Email

const passwordResetTemplate = (code) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - ClockWork</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#1A1A2E;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 30px;">
              <h1 style="margin:0;color:#00D4FF;font-size:32px;font-weight:800;letter-spacing:-1px;">ClockWork</h1>
            </td>
          </tr>

          <!-- Code Section -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <p style="margin:0 0 24px;color:#888888;font-size:15px;line-height:1.5;">Your password reset code:</p>
              <div style="background:#0A0A0A;border:2px solid #00D4FF;border-radius:12px;padding:28px 48px;display:inline-block;">
                <span style="color:#FFFFFF;font-size:36px;font-weight:700;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</span>
              </div>
              <p style="margin:24px 0 0;color:#666666;font-size:13px;">Valid for 10 minutes</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px;border-top:1px solid #333333;background:#151525;">
              <p style="margin:0;color:#555555;font-size:12px;text-align:center;line-height:1.6;">
                If you didn't request this password reset, you can safely ignore this email.
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

module.exports = { passwordResetTemplate };
