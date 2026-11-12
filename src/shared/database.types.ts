
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adapter_events": {
                  Row: {
                    "adapter_name": string,"colony_id": string,"id": number,"received_at": string,"state": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "adapter_name": string,"colony_id": string,"id"?: never,"received_at"?: string,"state": boolean
                  }
                  Update: {
                    "adapter_name"?: string,"colony_id"?: string,"id"?: never,"received_at"?: string,"state"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "adapter_events_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    }
                  ]
                },"adapter_states": {
                  Row: {
                    "colony_id": string,"name": string,"state": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"name": string,"state": boolean,"updated_at"?: string
                  }
                  Update: {
                    "colony_id"?: string,"name"?: string,"state"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adapter_states_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    }
                  ]
                },"colonies": {
                  Row: {
                    "api_base_url": string,"created_at": string,"faction": string | null,"id": string,"name": string,"owner_id": string,"webhook_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "api_base_url"?: string,"created_at"?: string,"faction"?: string | null,"id"?: string,"name": string,"owner_id"?: string,"webhook_token"?: string
                  }
                  Update: {
                    "api_base_url"?: string,"created_at"?: string,"faction"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"webhook_token"?: string
                  }
                  Relationships: [
                    
                  ]
                },"game_clocks": {
                  Row: {
                    "anchor_at": string,"anchor_cycle": number,"anchor_day": number,"colony_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_at"?: string,"anchor_cycle": number,"anchor_day": number,"colony_id": string,"created_at"?: string
                  }
                  Update: {
                    "anchor_at"?: string,"anchor_cycle"?: number,"anchor_day"?: number,"colony_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_clocks_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    }
                  ]
                },"ladders": {
                  Row: {
                    "colony_id": string,"comparison": string,"created_at": string,"id": string,"metric": string,"thresholds": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"comparison"?: string,"created_at"?: string,"id"?: string,"metric": string,"thresholds"?: (number)[]
                  }
                  Update: {
                    "colony_id"?: string,"comparison"?: string,"created_at"?: string,"id"?: string,"metric"?: string,"thresholds"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ladders_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_trackers": {
                  Row: {
                    "colony_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"created_at"?: string
                  }
                  Update: {
                    "colony_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weather_trackers_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "adapter_history":
{ Args: { "p_adapters": (string)[],"p_bucket_seconds"?: number,"p_colony": string,"p_since": string }; Returns: {
              "adapter_name": string,"carried": boolean,"received_at": string,"state": boolean
            }[]
                           },
"game_date":
{ Args: { "p_colony": string }; Returns: {
              "cycle": number,"cycles_tracked": boolean,"day": number,"days_counted": number,"first_day_at": string,"last_day_at": string,"seconds_per_day": number
            }[]
                           },
"record_adapter_event":
{ Args: { "p_adapter": string,"p_state": boolean,"p_token": string }; Returns: boolean
                           },
"rotate_webhook_token":
{ Args: { "p_colony": string }; Returns: string
                           },
"signal_counts":
{ Args: { "p_adapter": string,"p_bounds": (string)[],"p_colony": string }; Returns: {
              "idx": number,"n": number
            }[]
                           },
"weather_history":
{ Args: { "p_adapters": (string)[],"p_bucket_seconds": number,"p_colony": string,"p_since": string }; Returns: {
              "adapter_name": string,"share": number,"slot_start": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
