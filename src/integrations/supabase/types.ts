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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          description: string | null
          earned_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          earned_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          earned_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_date: string
          category: Database["public"]["Enums"]["activity_category"]
          created_at: string
          duration_minutes: number
          id: string
          name: string
          normalized_name: string
          raw_text: string | null
          score: number
          sub_activity: string | null
          user_id: string
        }
        Insert: {
          activity_date?: string
          category: Database["public"]["Enums"]["activity_category"]
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          normalized_name: string
          raw_text?: string | null
          score: number
          sub_activity?: string | null
          user_id: string
        }
        Update: {
          activity_date?: string
          category?: Database["public"]["Enums"]["activity_category"]
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          normalized_name?: string
          raw_text?: string | null
          score?: number
          sub_activity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_dataset: {
        Row: {
          activity_name: string
          category: Database["public"]["Enums"]["activity_category"]
          confidence: number
          created_at: string
          id: string
          keywords: string[]
          score: number
        }
        Insert: {
          activity_name: string
          category: Database["public"]["Enums"]["activity_category"]
          confidence?: number
          created_at?: string
          id?: string
          keywords?: string[]
          score: number
        }
        Update: {
          activity_name?: string
          category?: Database["public"]["Enums"]["activity_category"]
          confidence?: number
          created_at?: string
          id?: string
          keywords?: string[]
          score?: number
        }
        Relationships: []
      }
      activity_knowledge_base: {
        Row: {
          activity_name: string
          category: Database["public"]["Enums"]["activity_category"]
          confidence: number
          created_at: string
          id: string
          score: number
          source: string
        }
        Insert: {
          activity_name: string
          category: Database["public"]["Enums"]["activity_category"]
          confidence?: number
          created_at?: string
          id?: string
          score: number
          source?: string
        }
        Update: {
          activity_name?: string
          category?: Database["public"]["Enums"]["activity_category"]
          confidence?: number
          created_at?: string
          id?: string
          score?: number
          source?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          content: Json
          created_at: string
          id: string
          period: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          period: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          period?: string
          user_id?: string
        }
        Relationships: []
      }
      dna_history: {
        Row: {
          created_at: string
          id: string
          month_key: string
          profile: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_key: string
          profile: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month_key?: string
          profile?: string
          user_id?: string
        }
        Relationships: []
      }
      emotion_entries: {
        Row: {
          created_at: string
          emotion: string
          id: string
          note_encrypted: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emotion: string
          id?: string
          note_encrypted?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emotion?: string
          id?: string
          note_encrypted?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          active: boolean
          activity_name: string | null
          category: Database["public"]["Enums"]["activity_category"] | null
          created_at: string
          id: string
          period: string
          target_minutes: number
          title: string
          user_id: string
        }
        Insert: {
          active?: boolean
          activity_name?: string | null
          category?: Database["public"]["Enums"]["activity_category"] | null
          created_at?: string
          id?: string
          period?: string
          target_minutes: number
          title: string
          user_id: string
        }
        Update: {
          active?: boolean
          activity_name?: string | null
          category?: Database["public"]["Enums"]["activity_category"] | null
          created_at?: string
          id?: string
          period?: string
          target_minutes?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          frequency: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completion_date: string
          created_at: string
          id: string
          user_habit_id: string
          user_id: string
        }
        Insert: {
          completion_date?: string
          created_at?: string
          id?: string
          user_habit_id: string
          user_id: string
        }
        Update: {
          completion_date?: string
          created_at?: string
          id?: string
          user_habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_user_habit_id_fkey"
            columns: ["user_habit_id"]
            isOneToOne: false
            referencedRelation: "user_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      life_stories: {
        Row: {
          created_at: string
          id: string
          narrative: string
          period_key: string
          period_type: string
          stats: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          narrative: string
          period_key: string
          period_type: string
          stats?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          narrative?: string
          period_key?: string
          period_type?: string
          stats?: Json
          user_id?: string
        }
        Relationships: []
      }
      productivity_dna: {
        Row: {
          breakdown: Json
          description: string
          growth_areas: Json
          primary_profile: string
          strengths: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          description?: string
          growth_areas?: Json
          primary_profile?: string
          strengths?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          description?: string
          growth_areas?: Json
          primary_profile?: string
          strengths?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          persona: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          persona?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          persona?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      streaks: {
        Row: {
          best_count: number
          current_count: number
          id: string
          last_date: string | null
          streak_type: string
          user_id: string
        }
        Insert: {
          best_count?: number
          current_count?: number
          id?: string
          last_date?: string | null
          streak_type: string
          user_id: string
        }
        Update: {
          best_count?: number
          current_count?: number
          id?: string
          last_date?: string | null
          streak_type?: string
          user_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_habits: {
        Row: {
          archived: boolean
          catalog_id: string | null
          category: string
          created_at: string
          description: string | null
          end_date: string | null
          frequency: string | null
          icon: string | null
          id: string
          name: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          catalog_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          icon?: string | null
          id?: string
          name: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          catalog_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          icon?: string | null
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_habits_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "habit_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_focusflow_score: { Args: { target: string }; Returns: number }
      current_streak: { Args: { target: string }; Returns: number }
      decrypt_note: { Args: { cipher: string; key: string }; Returns: string }
      encrypt_note: { Args: { key: string; plain: string }; Returns: string }
    }
    Enums: {
      activity_category:
        | "learning"
        | "work"
        | "fitness"
        | "wellness"
        | "entertainment"
        | "personal"
        | "social"
        | "sleep"
        | "other"
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
  public: {
    Enums: {
      activity_category: [
        "learning",
        "work",
        "fitness",
        "wellness",
        "entertainment",
        "personal",
        "social",
        "sleep",
        "other",
      ],
    },
  },
} as const
