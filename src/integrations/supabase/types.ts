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
  public: {
    Tables: {
      claims: {
        Row: {
          arranged_services: Json | null
          conversation_history: Json | null
          coverage_details: string | null
          created_at: string | null
          driver_email: string | null
          driver_name: string
          driver_phone: string
          id: string
          incident_description: string
          is_covered: boolean | null
          location: string
          nearest_garage: string | null
          policy_number: string
          progress_message: string | null
          rental_car_coverage: boolean | null
          roadside_assistance: boolean | null
          status: Database["public"]["Enums"]["claim_status"] | null
          towing_coverage: boolean | null
          transport_coverage: boolean | null
          updated_at: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: number | null
        }
        Insert: {
          arranged_services?: Json | null
          conversation_history?: Json | null
          coverage_details?: string | null
          created_at?: string | null
          driver_email?: string | null
          driver_name: string
          driver_phone: string
          id?: string
          incident_description: string
          is_covered?: boolean | null
          location: string
          nearest_garage?: string | null
          policy_number: string
          progress_message?: string | null
          rental_car_coverage?: boolean | null
          roadside_assistance?: boolean | null
          status?: Database["public"]["Enums"]["claim_status"] | null
          towing_coverage?: boolean | null
          transport_coverage?: boolean | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Update: {
          arranged_services?: Json | null
          conversation_history?: Json | null
          coverage_details?: string | null
          created_at?: string | null
          driver_email?: string | null
          driver_name?: string
          driver_phone?: string
          id?: string
          incident_description?: string
          is_covered?: boolean | null
          location?: string
          nearest_garage?: string | null
          policy_number?: string
          progress_message?: string | null
          rental_car_coverage?: boolean | null
          roadside_assistance?: boolean | null
          status?: Database["public"]["Enums"]["claim_status"] | null
          towing_coverage?: boolean | null
          transport_coverage?: boolean | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: Json
          created_at: string | null
          customer_since: string
          date_of_birth: string
          email: string
          full_name: string
          id: string
          licence_issuer: string
          licence_number: string
          phone: string
          policy_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          address: Json
          created_at?: string | null
          customer_since?: string
          date_of_birth: string
          email: string
          full_name: string
          id: string
          licence_issuer: string
          licence_number: string
          phone: string
          policy_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          address?: Json
          created_at?: string | null
          customer_since?: string
          date_of_birth?: string
          email?: string
          full_name?: string
          id?: string
          licence_issuer?: string
          licence_number?: string
          phone?: string
          policy_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      garages: {
        Row: {
          address: string
          average_response_time: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string
          rating: number | null
          services: string[] | null
        }
        Insert: {
          address: string
          average_response_time?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone: string
          rating?: number | null
          services?: string[] | null
        }
        Update: {
          address?: string
          average_response_time?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string
          rating?: number | null
          services?: string[] | null
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          coverage_type: string
          created_at: string | null
          holder_email: string | null
          holder_name: string
          holder_phone: string
          id: string
          max_towing_distance: number | null
          policy_number: string
          rental_car_coverage: boolean | null
          roadside_assistance: boolean | null
          towing_coverage: boolean | null
          transport_coverage: boolean | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: number | null
        }
        Insert: {
          coverage_type: string
          created_at?: string | null
          holder_email?: string | null
          holder_name: string
          holder_phone: string
          id?: string
          max_towing_distance?: number | null
          policy_number: string
          rental_car_coverage?: boolean | null
          roadside_assistance?: boolean | null
          towing_coverage?: boolean | null
          transport_coverage?: boolean | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Update: {
          coverage_type?: string
          created_at?: string | null
          holder_email?: string | null
          holder_name?: string
          holder_phone?: string
          id?: string
          max_towing_distance?: number | null
          policy_number?: string
          rental_car_coverage?: boolean | null
          roadside_assistance?: boolean | null
          towing_coverage?: boolean | null
          transport_coverage?: boolean | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          claim_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          recipient: string
          sent_at: string | null
          status: string | null
          type: string
        }
        Insert: {
          claim_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          type: string
        }
        Update: {
          claim_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          claim_id: string | null
          created_at: string | null
          estimated_arrival: number | null
          id: string
          provider_name: string
          provider_phone: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: string | null
        }
        Insert: {
          claim_id?: string | null
          created_at?: string | null
          estimated_arrival?: number | null
          id?: string
          provider_name: string
          provider_phone?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: string | null
        }
        Update: {
          claim_id?: string | null
          created_at?: string | null
          estimated_arrival?: number | null
          id?: string
          provider_name?: string
          provider_phone?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
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
      claim_status:
        | "data_gathering"
        | "coverage_check"
        | "arranging_services"
        | "completed"
      service_type: "tow_truck" | "repair_truck" | "taxi" | "rental_car"
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
      claim_status: [
        "data_gathering",
        "coverage_check",
        "arranging_services",
        "completed",
      ],
      service_type: ["tow_truck", "repair_truck", "taxi", "rental_car"],
    },
  },
} as const
