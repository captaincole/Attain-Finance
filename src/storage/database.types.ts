export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_sync_state: {
        Row: {
          account_id: string
          created_at: string | null
          error_message: string | null
          last_synced_at: string | null
          sync_status: string
          total_transactions_synced: number | null
          transaction_cursor: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          error_message?: string | null
          last_synced_at?: string | null
          sync_status?: string
          total_transactions_synced?: number | null
          transaction_cursor?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          error_message?: string | null
          last_synced_at?: string | null
          sync_status?: string
          total_transactions_synced?: number | null
          transaction_cursor?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_sync_state_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_id: string
          available_balance: number | null
          created_at: string | null
          currency_code: string | null
          current_balance: number | null
          id: string
          item_id: string
          last_synced_at: string
          limit_amount: number | null
          name: string
          official_name: string | null
          subtype: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          available_balance?: number | null
          created_at?: string | null
          currency_code?: string | null
          current_balance?: number | null
          id?: string
          item_id: string
          last_synced_at: string
          limit_amount?: number | null
          name: string
          official_name?: string | null
          subtype?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          available_balance?: number | null
          created_at?: string | null
          currency_code?: string | null
          current_balance?: number | null
          id?: string
          item_id?: string
          last_synced_at?: string
          limit_amount?: number | null
          name?: string
          official_name?: string | null
          subtype?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "plaid_connections"
            referencedColumns: ["item_id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_amount: number
          created_at: string | null
          custom_period_days: number | null
          filter_prompt: string
          fixed_period_start_date: string | null
          id: string
          processing_completed_at: string | null
          processing_error: string | null
          processing_status: string
          time_period: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget_amount: number
          created_at?: string | null
          custom_period_days?: number | null
          filter_prompt: string
          fixed_period_start_date?: string | null
          id: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          time_period: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget_amount?: number
          created_at?: string | null
          custom_period_days?: number | null
          filter_prompt?: string
          fixed_period_start_date?: string | null
          id?: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          time_period?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categorization_prompts: {
        Row: {
          custom_rules: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          custom_rules?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          custom_rules?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      demo_credit_scores: {
        Row: {
          created_at: string | null
          provider: string | null
          score: number
          score_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          provider?: string | null
          score: number
          score_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          provider?: string | null
          score?: number
          score_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      demo_banking_accounts: {
        Row: {
          account_id: string
          balances_current: number
          created_at: string | null
          currency_code: string | null
          institution_name: string
          last_synced_at: string | null
          mask: string | null
          name: string
          subtype: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          balances_current: number
          created_at?: string | null
          currency_code?: string | null
          institution_name: string
          last_synced_at?: string | null
          mask?: string | null
          name: string
          subtype?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          balances_current?: number
          created_at?: string | null
          currency_code?: string | null
          institution_name?: string
          last_synced_at?: string | null
          mask?: string | null
          name?: string
          subtype?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      demo_banking_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string | null
          date: string
          description: string
          direction: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string | null
          date: string
          description: string
          direction: string
          id: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string
          direction?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_banking_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "demo_banking_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      demo_investment_accounts: {
        Row: {
          account_id: string
          balances_available: number | null
          balances_current: number | null
          created_at: string | null
          currency_code: string | null
          last_synced_at: string | null
          mask: string | null
          name: string
          subtype: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          balances_available?: number | null
          balances_current?: number | null
          created_at?: string | null
          currency_code?: string | null
          last_synced_at?: string | null
          mask?: string | null
          name: string
          subtype?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          balances_available?: number | null
          balances_current?: number | null
          created_at?: string | null
          currency_code?: string | null
          last_synced_at?: string | null
          mask?: string | null
          name?: string
          subtype?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      demo_investment_holdings: {
        Row: {
          account_id: string
          cost_basis: number | null
          created_at: string | null
          currency_code: string | null
          id: string
          institution_price: number | null
          institution_price_as_of: string | null
          institution_value: number | null
          quantity: number
          security_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          cost_basis?: number | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          institution_price?: number | null
          institution_price_as_of?: string | null
          institution_value?: number | null
          quantity: number
          security_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          cost_basis?: number | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          institution_price?: number | null
          institution_price_as_of?: string | null
          institution_value?: number | null
          quantity?: number
          security_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_investment_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "demo_investment_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "demo_investment_holdings_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "demo_investment_securities"
            referencedColumns: ["security_id"]
          },
        ]
      }
      demo_investment_securities: {
        Row: {
          close_price: number | null
          close_price_as_of: string | null
          created_at: string | null
          currency_code: string | null
          is_cash_equivalent: boolean | null
          name: string
          security_id: string
          subtype: string | null
          ticker_symbol: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          close_price?: number | null
          close_price_as_of?: string | null
          created_at?: string | null
          currency_code?: string | null
          is_cash_equivalent?: boolean | null
          name: string
          security_id: string
          subtype?: string | null
          ticker_symbol?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          close_price?: number | null
          close_price_as_of?: string | null
          created_at?: string | null
          currency_code?: string | null
          is_cash_equivalent?: boolean | null
          name?: string
          security_id?: string
          subtype?: string | null
          ticker_symbol?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      demo_liability_accounts: {
        Row: {
          account_id: string
          balances_available: number | null
          balances_current: number | null
          created_at: string | null
          currency_code: string | null
          last_synced_at: string | null
          limit_amount: number | null
          mask: string | null
          name: string
          subtype: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          balances_available?: number | null
          balances_current?: number | null
          created_at?: string | null
          currency_code?: string | null
          last_synced_at?: string | null
          limit_amount?: number | null
          mask?: string | null
          name: string
          subtype?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          balances_available?: number | null
          balances_current?: number | null
          created_at?: string | null
          currency_code?: string | null
          last_synced_at?: string | null
          limit_amount?: number | null
          mask?: string | null
          name?: string
          subtype?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      demo_liability_details: {
        Row: {
          account_id: string
          created_at: string | null
          details: Json | null
          escrow_balance: number | null
          id: string
          interest_rate: number | null
          interest_rate_type: string | null
          last_payment_amount: number | null
          last_payment_date: string | null
          lender_name: string | null
          liability_type: string
          minimum_payment_amount: number | null
          next_payment_due_date: string | null
          original_principal_amount: number | null
          outstanding_principal_amount: number | null
          past_due_amount: number | null
          payoff_date: string | null
          term_description: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          details?: Json | null
          escrow_balance?: number | null
          id?: string
          interest_rate?: number | null
          interest_rate_type?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          lender_name?: string | null
          liability_type: string
          minimum_payment_amount?: number | null
          next_payment_due_date?: string | null
          original_principal_amount?: number | null
          outstanding_principal_amount?: number | null
          past_due_amount?: number | null
          payoff_date?: string | null
          term_description?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          details?: Json | null
          escrow_balance?: number | null
          id?: string
          interest_rate?: number | null
          interest_rate_type?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          lender_name?: string | null
          liability_type?: string
          minimum_payment_amount?: number | null
          next_payment_due_date?: string | null
          original_principal_amount?: number | null
          outstanding_principal_amount?: number | null
          past_due_amount?: number | null
          payoff_date?: string | null
          term_description?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_liability_details_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "demo_liability_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      opinions: {
        Row: {
          author: string
          author_url: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          prompt: string
          tool_name: string
        }
        Insert: {
          author: string
          author_url?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          prompt: string
          tool_name: string
        }
        Update: {
          author?: string
          author_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          prompt?: string
          tool_name?: string
        }
        Relationships: []
      }
      plaid_connections: {
        Row: {
          access_token_encrypted: string
          connected_at: string | null
          error_code: string | null
          error_message: string | null
          institution_name: string | null
          item_id: string
          plaid_env: string
          status: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string | null
          error_code?: string | null
          error_message?: string | null
          institution_name?: string | null
          item_id: string
          plaid_env?: string
          status?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string | null
          error_code?: string | null
          error_message?: string | null
          institution_name?: string | null
          item_id?: string
          plaid_env?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      plaid_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          expires_at: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          expires_at?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          expires_at?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          account_name: string | null
          amount: number
          budget_ids: string[] | null
          budgets_updated_at: string | null
          categorized_at: string | null
          created_at: string | null
          custom_category: string | null
          date: string
          institution_name: string | null
          item_id: string
          name: string
          pending: boolean
          plaid_category: Json | null
          transaction_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          account_name?: string | null
          amount: number
          budget_ids?: string[] | null
          budgets_updated_at?: string | null
          categorized_at?: string | null
          created_at?: string | null
          custom_category?: string | null
          date: string
          institution_name?: string | null
          item_id: string
          name: string
          pending?: boolean
          plaid_category?: Json | null
          transaction_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          account_name?: string | null
          amount?: number
          budget_ids?: string[] | null
          budgets_updated_at?: string | null
          categorized_at?: string | null
          created_at?: string | null
          custom_category?: string | null
          date?: string
          institution_name?: string | null
          item_id?: string
          name?: string
          pending?: boolean
          plaid_category?: Json | null
          transaction_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "plaid_connections"
            referencedColumns: ["item_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
