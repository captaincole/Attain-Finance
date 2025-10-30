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

// Helper function to format currency with commas and dollar sign
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "N/A";
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to get account type label
function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'credit': 'Credit Cards',
    'depository': 'Bank Accounts',
    'investment': 'Investment Accounts',
    'loan': 'Loans',
    'other': 'Other Accounts'
  };
  return labels[type] || 'Other Accounts';
}

// Enhanced account interface with institution info
interface AccountWithInstitution extends Account {
  institutionName: string;
}

// Flatten all accounts across institutions and group by type
function groupAllAccountsByType(institutions: Institution[]): Map<string, AccountWithInstitution[]> {
  const grouped = new Map<string, AccountWithInstitution[]>();

  institutions.forEach(institution => {
    // Skip institutions with errors
    if (institution.error) return;

    institution.accounts.forEach(account => {
      const type = account.type;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push({
        ...account,
        institutionName: institution.institutionName
      });
    });
  });

  return grouped;
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

  // Check for any institutions with errors
  const errorInstitutions = institutions.filter(inst => inst.error);

  // Group all accounts by type (ignoring institution boundaries)
  const accountsByType = groupAllAccountsByType(institutions);

  // Find the most recent sync time across all institutions
  const lastSyncedAt = institutions
    .filter(inst => inst.lastSyncedAt)
    .map(inst => new Date(inst.lastSyncedAt!))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="institutions-widget">
      <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Connected Accounts</h3>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>{totalAccounts} total</div>
        </div>
        {lastSyncedAt && (
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
            Last updated {lastSyncedAt.toLocaleString()}
          </div>
        )}
      </div>

      {/* Show error institutions first */}
      {errorInstitutions.map((institution) => (
        <div key={institution.itemId} style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#666', marginBottom: '0.25rem' }}>
            {institution.institutionName}
          </div>
          <div style={{ color: '#d32f2f', fontSize: '0.85rem', padding: '0.5rem 0' }}>
            ⚠️ {institution.error}
          </div>
        </div>
      ))}

      {accountsByType.size === 0 ? (
        <div className="empty-state">
          <p>No institutions connected</p>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            Use "Connect my bank account" to get started
          </p>
        </div>
      ) : (
        <div className="accounts-by-type">
          {Array.from(accountsByType).map(([accountType, accounts], typeIndex) => (
            <div key={accountType}>
              {typeIndex > 0 && <div style={{ height: '1px', background: '#e0e0e0', margin: '0.75rem 0' }} />}

              <div style={{ marginTop: typeIndex > 0 ? '1rem' : '0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#888', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {getAccountTypeLabel(accountType)}
                </div>
                <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                  <tbody>
                    {accounts.map((account, index) => (
                      <tr key={index} style={{ borderBottom: index < accounts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                        <td style={{ padding: '0.4rem 0', textAlign: 'left' }}>
                          <div>{account.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.1rem' }}>
                            {account.institutionName}
                          </div>
                        </td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: '500', verticalAlign: 'top' }}>
                          {formatCurrency(account.balances.current)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
