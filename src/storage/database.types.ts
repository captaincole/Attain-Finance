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
          item_id: string
          plaid_env: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string | null
          item_id: string
          plaid_env?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string | null
          item_id?: string
          plaid_env?: string
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
      user_visualizations: {
        Row: {
          script_content: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          script_content: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          script_content?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
