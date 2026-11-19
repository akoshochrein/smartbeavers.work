
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
    },{
      foreignKeyName: "adapter_events_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
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
    },{
      foreignKeyName: "adapter_states_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"colonies": {
                  Row: {
                    "created_at": string,"faction": string | null,"id": string,"is_public": boolean,"name": string,"owner_id": string,"webhook_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"faction"?: string | null,"id"?: string,"is_public"?: boolean,"name": string,"owner_id"?: string,"webhook_token"?: string
                  }
                  Update: {
                    "created_at"?: string,"faction"?: string | null,"id"?: string,"is_public"?: boolean,"name"?: string,"owner_id"?: string,"webhook_token"?: string
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
    },{
      foreignKeyName: "game_clocks_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
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
    },{
      foreignKeyName: "ladders_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"mod_requests": {
                  Row: {
                    "colony_id": string,"count": number,"hour": string | null,"minute": string,"readings": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"count": number,"hour"?: string | null,"minute": string,"readings"?: number
                  }
                  Update: {
                    "colony_id"?: string,"count"?: number,"hour"?: string | null,"minute"?: string,"readings"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mod_requests_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mod_requests_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"mod_sessions": {
                  Row: {
                    "colony_id": string,"ended_at": string | null,"id": number,"last_seen_at": string,"started_at": string,"session_end": string | null
                  }
                  ComputedFields: "session_end"
                  Insert: {
                    "colony_id": string,"ended_at"?: string | null,"id"?: never,"last_seen_at"?: string,"started_at"?: string
                  }
                  Update: {
                    "colony_id"?: string,"ended_at"?: string | null,"id"?: never,"last_seen_at"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mod_sessions_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mod_sessions_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"pinned_metrics": {
                  Row: {
                    "colony_id": string,"created_at": string,"metric": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"created_at"?: string,"metric": string
                  }
                  Update: {
                    "colony_id"?: string,"created_at"?: string,"metric"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pinned_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pinned_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"handle": string | null,"is_public": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"handle"?: string | null,"is_public"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"handle"?: string | null,"is_public"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reading_metrics": {
                  Row: {
                    "colony_id": string,"first_at": string,"metric": string,"received_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"first_at": string,"metric": string,"received_at": string,"value": number
                  }
                  Update: {
                    "colony_id"?: string,"first_at"?: string,"metric"?: string,"received_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reading_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reading_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"readings": {
                  Row: {
                    "colony_id": string,"id": number,"metric": string,"received_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colony_id": string,"id"?: never,"metric": string,"received_at"?: string,"value": number
                  }
                  Update: {
                    "colony_id"?: string,"id"?: never,"metric"?: string,"received_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "readings_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "readings_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                },"retention_settings": {
                  Row: {
                    "full_detail_hours": number | null,"hourly_days": number | null,"id": boolean,"keep_days": number | null,"reading_gap_seconds": number | null,"readings_per_hour": number | null,"silent_months": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "full_detail_hours"?: number | null,"hourly_days"?: number | null,"id"?: boolean,"keep_days"?: number | null,"reading_gap_seconds"?: number | null,"readings_per_hour"?: number | null,"silent_months"?: number | null
                  }
                  Update: {
                    "full_detail_hours"?: number | null,"hourly_days"?: number | null,"id"?: boolean,"keep_days"?: number | null,"reading_gap_seconds"?: number | null,"readings_per_hour"?: number | null,"silent_months"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"weather_totals": {
                  Row: {
                    "adapter_name": string,"colony_id": string,"starts": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adapter_name": string,"colony_id": string,"starts"?: number
                  }
                  Update: {
                    "adapter_name"?: string,"colony_id"?: string,"starts"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "weather_totals_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weather_totals_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
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
    },{
      foreignKeyName: "weather_trackers_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: true
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                }
          }
          Views: {
            "colony_addresses": {
                  Row: {
                    "colony_id": string,"owner_id": string,"slug": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"colony_signals": {
                  Row: {
                    "adapter_name": string | null,"colony_id": string | null,"id": number | null,"received_at": string | null,"state": boolean | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"latest_readings": {
                  Row: {
                    "colony_id": string,"metric": string,"received_at": string,"reporting": boolean | null,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                           "colony_id"?: string | null,"metric"?: string | null,"received_at"?: string | null,"reporting"?: never,"value"?: number | null
                         }
                        Update: {
                           "colony_id"?: string | null,"metric"?: string | null,"received_at"?: string | null,"reporting"?: never,"value"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "reading_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colonies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reading_metrics_colony_id_fkey"
      columns: ["colony_id"]
isOneToOne: false
      referencedRelation: "colony_addresses"
      referencedColumns: ["colony_id"]
    }
                  ]
                }
          }
          Functions: {
            "adapter_history":
{ Args: { "p_adapters": (string)[],"p_bucket_seconds"?: number,"p_colony": string,"p_since": string }; Returns: {
              "adapter_name": string,"carried": boolean,"received_at": string,"state": boolean
            }[]
                           },
"apply_retention":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"colony_ladder":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"colony_name": string,"cycle": number,"day": number,"faction": string,"handle": string,"is_public": boolean,"key": string,"last_signal_at": string,"pop_comparison": string,"pop_reading": number,"pop_steps": Json,"profile_updated_at": string,"slug": string,"weather": string,"weather_days": number
            }[]
                           },
"colony_slug":
{ Args: { "p_name": string }; Returns: string
                           },
"date_as_of":
{ Args: { "p_at": string,"p_colony": string }; Returns: {
              "cycle": number,"day": number
            }[]
                           },
"end_mod_session":
{ Args: { "p_token": string }; Returns: boolean
                           },
"game_date":
{ Args: { "p_colony": string }; Returns: {
              "cycle": number,"cycles_tracked": boolean,"day": number,"days_counted": number,"first_day_at": string,"last_day_at": string,"seconds_per_day": number
            }[]
                           },
"game_x":
{ Args: { "p_at": string,"p_day_seconds": number,"p_starts": (string)[] }; Returns: number
                           },
"is_public_avatar":
{ Args: { "p_name": string }; Returns: boolean
                           },
"mod_reporting_at":
{ Args: { "p_at": string,"p_colony": string,"p_metric": string }; Returns: boolean
                           },
"public_colony":
{ Args: { "p_handle": string,"p_slug": string }; Returns: {
              "avatar_path": string,"colony_name": string,"faction": string,"handle": string,"key": string,"last_signal_at": string,"profile_updated_at": string
            }[]
                           },
"public_colony_history":
{ Args: { "p_key": string,"p_metric": string }; Returns: {
              "source": string,"state": boolean,"threshold": number,"value": number,"x": number
            }[]
                           },
"public_colony_id":
{ Args: { "p_key": string }; Returns: string
                           },
"public_colony_overview":
{ Args: { "p_key": string }; Returns: Json
                           },
"recent_day_starts":
{ Args: { "p_colony": string,"p_days": number }; Returns: (string)[]
                           },
"record_adapter_event":
{ Args: { "p_adapter": string,"p_state": boolean,"p_token": string }; Returns: boolean
                           },
"record_readings":
{ Args: { "p_faction"?: string,"p_readings": Json,"p_token": string }; Returns: boolean
                           },
"retention_policy":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_detail_hours": number | null,
"hourly_days": number | null,
"id": boolean,
"keep_days": number | null,
"reading_gap_seconds": number | null,
"readings_per_hour": number | null,
"silent_months": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "retention_settings"
        isOneToOne: true
        isSetofReturn: false
      } },
"rotate_webhook_token":
{ Args: { "p_colony": string }; Returns: string
                           },
"session_end":
{ Args: { "s": Omit<Database["public"]['Tables']["mod_sessions"]['Row'], Database["public"]['Tables']["mod_sessions"]['ComputedFields']> }; Returns: string
                           },
"signal_counts":
{ Args: { "p_adapter": string,"p_bounds": (string)[],"p_colony": string }; Returns: {
              "idx": number,"n": number
            }[]
                           },
"store_reading":
{ Args: { "p_colony": string,"p_metric": string,"p_value": number }; Returns: undefined
                           },
"tracker_history":
{ Args: { "p_adapters": (string)[],"p_bucket_seconds"?: number,"p_colony": string,"p_metric": string,"p_since": string }; Returns: {
              "adapter_name": string,"at": string,"carried": boolean,"source": string,"state": boolean,"value": number
            }[]
                           },
"weather_adapter":
{ Args: { "p_value": number }; Returns: string
                           },
"weather_counts":
{ Args: { "p_colony": string }; Returns: {
              "adapter_name": string,"n": number
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
