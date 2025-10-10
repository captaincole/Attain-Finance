import React from "react";
import { createRoot } from "react-dom/client";

// Types matching our tool output
interface Account {
  name: string;
  type: string;
  subtype?: string;
  balances: {
    current?: number;
  };
}

interface Institution {
  itemId: string;
  institutionName: string;
  env: string;
  connectedAt: Date;
  accounts: Account[];
  error?: string;
}

interface ConnectedInstitutionsOutput {
  institutions: Institution[];
  totalAccounts: number;
}

function ConnectedInstitutionsWidget() {
  // Read data from window.openai.toolOutput (this is what ChatGPT injects)
  const toolOutput = (window as any).openai?.toolOutput as ConnectedInstitutionsOutput | undefined;

  // DEBUG: Log everything
  console.log("=== Widget Mounted ===");
  console.log("window.openai:", (window as any).openai);
  console.log("toolOutput:", toolOutput);

  // Extract data with defaults
  const institutions = toolOutput?.institutions || [];
  const totalAccounts = toolOutput?.totalAccounts || 0;

  return (
    <div className="institutions-widget">
      <div className="widget-header">
        <h3>Connected Financial Institutions</h3>
        <div className="total-accounts">{totalAccounts} accounts</div>
      </div>

      {institutions.length === 0 ? (
        <div className="empty-state">
          <p>No institutions connected</p>
          <details style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
            <summary>Debug: Click to see raw data</summary>
            <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '300px' }}>
              {JSON.stringify({
                toolOutput,
                fullWindow: (window as any).openai
              }, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="institutions-list">
          {institutions.map((institution) => (
            <div key={institution.itemId} className="institution-card">
              <div className="institution-header">
                <div className="institution-name">
                  {institution.institutionName}
                  <span className="env-badge">{institution.env}</span>
                </div>
                {institution.error ? (
                  <div className="error-badge">⚠️ Error</div>
                ) : (
                  <div className="account-count">{institution.accounts.length} accounts</div>
                )}
              </div>

              {institution.error ? (
                <div className="institution-error">
                  <p>{institution.error}</p>
                </div>
              ) : (
                <div className="accounts-list">
                  {institution.accounts.map((account, index) => (
                    <div key={index} className="account-row">
                      <div className="account-info">
                        <div className="account-name">{account.name}</div>
                        <div className="account-type">{account.subtype || account.type}</div>
                      </div>
                      <div className="account-balance">
                        ${account.balances.current?.toFixed(2) || "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="institution-footer">
                <div className="connected-date">
                  Connected: {new Date(institution.connectedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mount component
const root = document.getElementById("connected-institutions-root");
if (root) {
  createRoot(root).render(<ConnectedInstitutionsWidget />);
}
