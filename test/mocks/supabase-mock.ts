/**
 * Mock Supabase client for testing
 * Provides in-memory storage instead of hitting real database
 */

export class MockSupabaseClient {
  private sessions: Map<string, any> = new Map();
  private connections: Map<string, any> = new Map();
  private budgets: Map<string, any> = new Map();

  /**
   * Add budget support to the mock
   */
  addBudgetSupport() {
    // Method exists to make the mock extensible
    // Budgets are already supported via the budgets Map
  }

  /**
   * Clear all mock data (for test cleanup)
   */
  clear() {
    this.sessions.clear();
    this.connections.clear();
    this.budgets.clear();
  }

  from(table: string) {
    return {
      // INSERT operations
      insert: (data: any) => ({
        select: () => ({
          single: async () => {
            if (table === "plaid_sessions") {
              this.sessions.set(data.session_id, {
                ...data,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 1800000).toISOString(), // 30 min
              });
              return {
                data: this.sessions.get(data.session_id),
                error: null,
              };
            }
            if (table === "budgets") {
              const budget = {
                ...data,
                created_at: data.created_at || new Date().toISOString(),
                updated_at: data.updated_at || new Date().toISOString(),
              };
              this.budgets.set(data.id, budget);
              return {
                data: budget,
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
      }),

      // SELECT operations
      select: (columns: string = "*") => ({
        eq: (column: string, value: any) => ({
          eq: (column2: string, value2: any) => ({
            single: async () => {
              if (table === "budgets" && column === "user_id" && column2 === "id") {
                const budget = this.budgets.get(value2);
                if (!budget || budget.user_id !== value) {
                  return { data: null, error: { code: "PGRST116" } };
                }
                return { data: budget, error: null };
              }
              return { data: null, error: null };
            },
          }),
          gt: (column2: string, value2: any) => ({
            single: async () => {
              if (table === "plaid_sessions") {
                const session = this.sessions.get(value);
                if (!session) {
                  return { data: null, error: { code: "PGRST116" } };
                }
                return { data: session, error: null };
              }
              if (table === "budgets") {
                const budget = this.budgets.get(value);
                if (!budget) {
                  return { data: null, error: { code: "PGRST116" } };
                }
                return { data: budget, error: null };
              }
              return { data: null, error: null };
            },
          }),
          order: (column: string, options: any) => {
            // Return a promise that resolves to { data, error }
            const promise = (async () => {
              if (table === "plaid_connections") {
                const connections = Array.from(this.connections.values()).filter(
                  (c) => c.user_id === value
                );
                return { data: connections, error: null };
              }
              if (table === "budgets") {
                const budgets = Array.from(this.budgets.values()).filter(
                  (b) => b.user_id === value
                );
                // Sort by updated_at descending
                budgets.sort((a, b) =>
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                );
                return { data: budgets, error: null };
              }
              return { data: [], error: null };
            })();
            return promise;
          },
          single: async () => {
            if (table === "budgets" && column === "id") {
              const budget = this.budgets.get(value);
              if (!budget) {
                return { data: null, error: { code: "PGRST116" } };
              }
              return { data: budget, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),

      // UPSERT operations
      upsert: (data: any, options: any) => ({
        then: async (resolve: any) => {
          if (table === "plaid_connections") {
            this.connections.set(data.item_id, data);
            return resolve({ data: null, error: null });
          }
          return resolve({ data: null, error: null });
        },
      }),

      // UPDATE operations
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          eq: (column2: string, value2: any) => ({
            select: () => ({
              single: async () => {
                if (table === "budgets" && column === "user_id" && column2 === "id") {
                  const budget = this.budgets.get(value2);
                  if (budget && budget.user_id === value) {
                    Object.assign(budget, data);
                    return { data: budget, error: null };
                  }
                  return { data: null, error: { code: "PGRST116" } };
                }
                return { data: null, error: null };
              },
            }),
          }),
          then: async (resolve: any) => {
            if (table === "plaid_sessions") {
              const session = this.sessions.get(value);
              if (session) {
                Object.assign(session, data);
              }
            }
            return resolve({ data: null, error: null });
          },
        }),
      }),

      // DELETE operations
      delete: () => ({
        eq: (column: string, value: any) => ({
          then: async (resolve: any) => {
            if (table === "plaid_connections") {
              this.connections.delete(value);
            }
            return resolve({ data: null, error: null });
          },
        }),
        lt: (column: string, value: any) => ({
          select: () => ({
            then: async (resolve: any) => {
              // Cleanup expired sessions
              return resolve({ data: [], error: null });
            },
          }),
        }),
      }),
    };
  }
}
