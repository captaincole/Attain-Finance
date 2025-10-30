/**
 * Plaid Link UI Route Handler
 * Serves the HTML page that initializes Plaid Link for bank connection
 */

import { Request, Response } from "express";
import { getBaseUrl } from "../../utils/config.js";

/**
 * GET /plaid/link
 * Renders the Plaid Link UI page with embedded JavaScript
 */
export function plaidLinkHandler(req: Request, res: Response) {
  const { token, session } = req.query;

  if (!token) {
    return res.status(400).send("Missing token parameter");
  }

  // Session is optional - required for new connections, not needed for update mode
  const isUpdateMode = !session;
  const baseUrl = getBaseUrl();

  // Serve HTML page that initializes Plaid Link
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect Your Bank - Attain Finance</title>
      <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 3rem;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 400px;
        }
        h1 { margin-top: 0; color: #333; font-size: 1.5rem; }
        .status { margin: 2rem 0; color: #666; }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .accounts {
          text-align: left;
          margin: 1rem 0;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
        }
        .account {
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .account:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Connect Your Bank</h1>
        <div class="status" id="status">
          <div class="spinner"></div>
          <p>Opening secure connection...</p>
        </div>
      </div>

      <script>
        const linkToken = "${token}";
        const sessionId = "${session || ''}";
        const isUpdateMode = ${isUpdateMode};

        // Initialize Plaid Link
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: async (public_token, metadata) => {
            // Update mode: No callback needed (access_token stays the same)
            if (isUpdateMode) {
              document.getElementById('status').innerHTML =
                \`<h2 class="success">✓ Update Complete!</h2>
                 <p>Your account connection has been updated successfully.</p>
                 <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                   Return to ChatGPT and say: <strong>"I've updated it, please refresh my transactions"</strong>
                 </p>\`;
              return;
            }

            // New connection: Exchange public token via callback
            document.getElementById('status').innerHTML =
              '<div class="spinner"></div><p>Connecting your bank...</p>';

            try {
              const response = await fetch('${baseUrl}/plaid/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  public_token,
                  session: sessionId,
                  metadata
                }),
              });

              if (response.ok) {
                const data = await response.json();
                let accountsHtml = '';
                if (data.accounts && data.accounts.length > 0) {
                  accountsHtml = '<div class="accounts">' +
                    data.accounts.map(acc =>
                      \`<div class="account"><strong>\${acc.name}</strong> (\${acc.type})</div>\`
                    ).join('') +
                    '</div>';
                }

                document.getElementById('status').innerHTML =
                  \`<h2 class="success">✓ Connected!</h2>
                   <p>Successfully connected \${data.accounts.length} account(s)</p>
                   \${accountsHtml}
                   <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                     You can now return to Claude Desktop and continue.
                   </p>\`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Connection failed');
              }
            } catch (error) {
              console.error('Error:', error);
              document.getElementById('status').innerHTML =
                \`<h2 class="error">✗ Error</h2>
                 <p>Connection failed: \${error.message}</p>
                 <p style="font-size: 0.9rem; margin-top: 1rem;">Please return to Claude Desktop and try again.</p>\`;
            }
          },
          onExit: (err, metadata) => {
            if (err) {
              document.getElementById('status').innerHTML =
                '<h2 class="error">Connection Cancelled</h2><p>You can close this window and try again.</p>';
            } else {
              document.getElementById('status').innerHTML =
                '<p>Connection cancelled. You can close this window.</p>';
            }
          },
        });

        // Auto-open Plaid Link when page loads
        handler.open();
      </script>
    </body>
    </html>
  `);
}
