import React, { useSyncExternalStore } from "react";
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
  lastSyncedAt?: string;
  accounts: Account[];
  error?: string;
}

interface ConnectedInstitutionsOutput {
  institutions: Institution[];
  totalAccounts: number;
}

// Hook to subscribe to window.openai.toolOutput changes
// Matches the pattern from OpenAI's official examples
function useToolOutput(): ConnectedInstitutionsOutput | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      // ChatGPT fires "openai:set_globals" event when toolOutput changes
      const handleSetGlobals = (event: CustomEvent) => {
        if (event.detail?.globals?.toolOutput !== undefined) {
          onChange();
        }
      };

      window.addEventListener("openai:set_globals", handleSetGlobals as EventListener);
      return () => {
        window.removeEventListener("openai:set_globals", handleSetGlobals as EventListener);
      };
    },
    () => (window as any).openai?.toolOutput ?? null,
    () => null // Server-side rendering fallback
  );
}

function ConnectedInstitutionsWidget() {
  // Subscribe to toolOutput changes
  const toolOutput = useToolOutput();

  // DEBUG: Log everything
  console.log("=== Widget Render ===");
  console.log("toolOutput:", toolOutput);

  // While waiting for data, show a simple loading state
  // ChatGPT already shows "Loading your connected institutions..." via _meta
  if (toolOutput === null) {
    return (
      <div className="institutions-widget">
        <div className="loading-state" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Extract data - toolOutput is guaranteed to exist here
  const institutions = toolOutput.institutions || [];
  const totalAccounts = toolOutput.totalAccounts || 0;

  return (
    <div className="institutions-widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e0e0e0' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Connected Accounts</h3>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>{totalAccounts} total</div>
      </div>

      {institutions.length === 0 ? (
        <div className="empty-state">
          <p>No institutions connected</p>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            Use "Connect my bank account" to get started
          </p>
        </div>
      ) : (
        <div className="institutions-list">
          {institutions.map((institution, instIndex) => (
            <div key={institution.itemId}>
              {instIndex > 0 && <div style={{ height: '1px', background: '#e0e0e0', margin: '0.75rem 0' }} />}

              <div className="institution-section">
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#666', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{institution.institutionName}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>{institution.env}</span>
                </div>
                {institution.lastSyncedAt && (
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>
                    Last updated {new Date(institution.lastSyncedAt).toLocaleString()}
                  </div>
                )}

                {institution.error ? (
                  <div style={{ color: '#d32f2f', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                    ⚠️ {institution.error}
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      {institution.accounts.map((account, index) => (
                        <tr key={index} style={{ borderBottom: index < institution.accounts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          <td style={{ padding: '0.4rem 0', textAlign: 'left' }}>
                            {account.name}
                          </td>
                          <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: '500' }}>
                            ${account.balances.current?.toFixed(2) || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
