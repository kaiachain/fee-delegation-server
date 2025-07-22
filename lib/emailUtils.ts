import nodemailer from 'nodemailer';

interface EmailAlertData {
  email: string;
  dappName: string;
  newBalance: string;
  threshold: string;
}

export const sendBalanceAlertEmail = async (data: EmailAlertData) => {
  try {
    // Create transporter (you'll need to configure this with your email service)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const newBalanceFormatted = (BigInt(data.newBalance) / BigInt(10 ** 18)).toString();
    const thresholdFormatted = (BigInt(data.threshold) / BigInt(10 ** 18)).toString();

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: data.email,
      subject: `⚠️ Low Balance Alert - ${data.dappName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>KAIA Fee Delegation Alert</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; line-height: 1.6;">
          
          <!-- Email Container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background-color: #374151; padding: 30px 40px; text-align: center;">
              <table style="display: inline-block; margin-bottom: 15px;">
                <tr>
                  <td style="background-color: #4b5563; border-radius: 50%; width: 60px; height: 60px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 24px; color: white; line-height: 60px;">🔔</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">
                KAIA Fee Delegation System
              </h1>
              <p style="color: #d1d5db; margin: 10px 0 0 0; font-size: 16px;">
                Balance Alert Notification
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px;">
              
              <!-- Greeting -->
              <div style="margin-bottom: 30px;">
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">
                  Hello there! 👋
                </h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px;">
                  This is an automated alert from the KAIA fee delegation system. Your DApp balance has fallen below the configured threshold.
                </p>
              </div>
              
              <!-- Alert Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 25px; margin: 30px 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <table style="display: inline-block; margin-right: 15px;">
                    <tr>
                      <td style="background-color: #ef4444; border-radius: 50%; width: 40px; height: 40px; text-align: center; vertical-align: middle;">
                        <span style="color: white; font-size: 16px; line-height: 40px;">⚠️</span>
                      </td>
                    </tr>
                  </table>
                  <h3 style="color: #b91c1c; margin: 0; font-size: 18px; font-weight: 600;">
                    Balance Alert
                  </h3>
                </div>
                
                <div style="background-color: white; border-radius: 6px; padding: 20px; margin-top: 15px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        DApp Name
                      </p>
                      <p style="color: #1f2937; margin: 0; font-size: 16px; font-weight: 600;">
                        ${data.dappName}
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Current Balance
                      </p>
                      <p style="color: #ef4444; margin: 0; font-size: 16px; font-weight: 600;">
                        ${newBalanceFormatted} KAIA
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Threshold
                      </p>
                      <p style="color: #1f2937; margin: 0; font-size: 16px; font-weight: 600;">
                        ${thresholdFormatted} KAIA
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Status
                      </p>
                      <span style="background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        CRITICAL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://fee-delegation.kaia.io/rank" target="_blank" style="display: inline-block; background-color: #374151; color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                  Check DApp Balance
                </a>
              </div>
              
              <!-- Message -->
              <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-top: 30px;">
                <h4 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
                  What you should do:
                </h4>
                <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Add more balance to your DApp to continue fee delegation services</li>
                  <li style="margin-bottom: 8px;">Monitor your balance regularly to avoid service interruption</li>
                  <li style="margin-bottom: 0;">Consider setting up automatic balance replenishment</li>
                </ul>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 25px 40px; text-align: center;">
              <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
                This is an automated alert from the KAIA Fee Delegation System.
              </p>
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                © 2024 KAIA Network. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email alert sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send email alert:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}; 