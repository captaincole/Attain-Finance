/**
 * Mock Supabase client for testing
 * Provides in-memory storage instead of hitting real database
 */

export class MockSupabaseClient {
  private sessions: Map<string, any> = new Map();
  private connections: Map<string, any> = new Map();

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
            return { data: null, error: null };
          },
        }),
      }),

      // SELECT operations
      select: (columns: string = "*") => ({
        eq: (column: string, value: any) => ({
          gt: (column2: string, value2: any) => ({
            single: async () => {
              if (table === "plaid_sessions") {
                const session = this.sessions.get(value);
                if (!session) {
                  return { data: null, error: { code: "PGRST116" } };
                }
                return { data: session, error: null };
              }
              return { data: null, error: null };
            },
          }),
          order: (column: string, options: any) => ({
            then: async (resolve: any) => {
              if (table === "plaid_connections") {
                const connections = Array.from(this.connections.values()).filter(
                  (c) => c.user_id === value
                );
                return resolve({ data: connections, error: null });
              }
              return resolve({ data: [], error: null });
            },
          }),
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
