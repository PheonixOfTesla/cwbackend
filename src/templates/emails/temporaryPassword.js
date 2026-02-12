// Src/templates/emails/temporaryPassword.js - Temporary Password Email

const temporaryPasswordTemplate = (name, tempPassword) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ClockWork Account</title>
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
                Welcome to ClockWork, ${name ? name.split(' ')[0] : 'there'}!
              </h2>
              <p style="margin:0;color:#888888;font-size:15px;line-height:1.6;">
                An admin has created an account for you. Use the temporary password below to log in.
              </p>
            </td>
          </tr>

          <!-- Temporary Password Box -->
          <tr>
            <td align="center" style="padding:0 40px 30px;">
              <div style="background:#0F0F1E;border:2px solid #00D4FF;border-radius:12px;padding:24px;">
                <p style="margin:0 0 8px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">TEMPORARY PASSWORD</p>
                <p style="margin:0;color:#00D4FF;font-size:32px;font-weight:700;font-family:monospace;letter-spacing:4px;">
                  ${tempPassword}
                </p>
              </div>
            </td>
          </tr>

          <!-- Important Notice -->
          <tr>
            <td style="padding:0 40px 30px;">
              <div style="background:#2A1A1A;border-left:4px solid #FF6B6B;padding:16px;border-radius:8px;">
                <p style="margin:0 0 8px;color:#FF6B6B;font-size:14px;font-weight:600;">
                  🔐 Security Notice
                </p>
                <p style="margin:0;color:#CCCCCC;font-size:13px;line-height:1.6;">
                  You will be required to reset this password on your first login. Keep this email secure and delete it after changing your password.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <a href="https://clockwork.fit" style="display:inline-block;background:#00D4FF;color:#0A0A0A;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:8px;">
                Log In to ClockWork →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px;border-top:1px solid #333333;background:#151525;">
              <p style="margin:0;color:#888888;font-size:13px;text-align:center;">
                If you didn't expect this email, please contact your administrator.
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

module.exports = { temporaryPasswordTemplate };
