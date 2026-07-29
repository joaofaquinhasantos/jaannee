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
      area_follows: {
        Row: {
          area_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_follows_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          id: string
          name_en: string
          name_th: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_en: string
          name_th: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_en?: string
          name_th?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          cuisine: string | null
          id: string
          name_en: string
          name_th: string
          reference_photo_url: string | null
          requires_subtype: boolean
          slug: string
        }
        Insert: {
          created_at?: string
          cuisine?: string | null
          id?: string
          name_en: string
          name_th: string
          reference_photo_url?: string | null
          requires_subtype?: boolean
          slug: string
        }
        Update: {
          created_at?: string
          cuisine?: string | null
          id?: string
          name_en?: string
          name_th?: string
          reference_photo_url?: string | null
          requires_subtype?: boolean
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_cuisine_fkey"
            columns: ["cuisine"]
            isOneToOne: false
            referencedRelation: "cuisines"
            referencedColumns: ["slug"]
          },
        ]
      }
      category_follows: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_follows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_responses: {
        Row: {
          agreed: boolean | null
          challenger_user_id: string
          created_at: string
          dish_hi_id: string
          dish_lo_id: string
          id: string
          responder_user_id: string
          winner_id: string
        }
        Insert: {
          agreed?: boolean | null
          challenger_user_id: string
          created_at?: string
          dish_hi_id: string
          dish_lo_id: string
          id?: string
          responder_user_id: string
          winner_id: string
        }
        Update: {
          agreed?: boolean | null
          challenger_user_id?: string
          created_at?: string
          dish_hi_id?: string
          dish_lo_id?: string
          id?: string
          responder_user_id?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_responses_dish_hi_id_fkey"
            columns: ["dish_hi_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_responses_dish_lo_id_fkey"
            columns: ["dish_lo_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_responses_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          category_id: string
          created_at: string
          dish_hi_id: string
          dish_lo_id: string
          id: string
          updated_at: string
          user_id: string
          winner_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          dish_hi_id: string
          dish_lo_id: string
          id?: string
          updated_at?: string
          user_id: string
          winner_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          dish_hi_id?: string
          dish_lo_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_dish_hi_id_fkey"
            columns: ["dish_hi_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_dish_lo_id_fkey"
            columns: ["dish_lo_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisines: {
        Row: {
          created_at: string
          name_en: string
          name_th: string
          slug: string
        }
        Insert: {
          created_at?: string
          name_en: string
          name_th: string
          slug: string
        }
        Update: {
          created_at?: string
          name_en?: string
          name_th?: string
          slug?: string
        }
        Relationships: []
      }
      dish_collection_items: {
        Row: {
          added_at: string
          collection_id: string
          dish_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          dish_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          dish_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "dish_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_collection_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_collections: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      dish_subtypes: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name_en: string
          name_th: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_en: string
          name_th: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_en?: string
          name_th?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_subtypes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_tries: {
        Row: {
          created_at: string
          dish_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_tries_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_wants: {
        Row: {
          created_at: string
          dish_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_wants_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          category_id: string | null
          comparisons_count: number
          created_at: string
          elo: number
          id: string
          name_en: string
          name_th: string | null
          needs_update: boolean
          note: string | null
          photo_url: string | null
          place_id: string
          price_thb: number | null
          requested_category_en: string | null
          requested_category_th: string | null
          status: Database["public"]["Enums"]["dish_status"]
          submitted_by: string | null
          subtype_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          comparisons_count?: number
          created_at?: string
          elo?: number
          id?: string
          name_en: string
          name_th?: string | null
          needs_update?: boolean
          note?: string | null
          photo_url?: string | null
          place_id: string
          price_thb?: number | null
          requested_category_en?: string | null
          requested_category_th?: string | null
          status?: Database["public"]["Enums"]["dish_status"]
          submitted_by?: string | null
          subtype_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          comparisons_count?: number
          created_at?: string
          elo?: number
          id?: string
          name_en?: string
          name_th?: string | null
          needs_update?: boolean
          note?: string | null
          photo_url?: string | null
          place_id?: string
          price_thb?: number | null
          requested_category_en?: string | null
          requested_category_th?: string | null
          status?: Database["public"]["Enums"]["dish_status"]
          submitted_by?: string | null
          subtype_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "dish_subtypes"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          area_id: string | null
          created_at: string
          created_by: string | null
          google_maps_url: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          status: string
        }
        Insert: {
          address?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          status?: string
        }
        Update: {
          address?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          tried_public: boolean
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          tried_public?: boolean
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          tried_public?: boolean
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          note: string | null
          reason: string
          status: Database["public"]["Enums"]["report_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          note?: string | null
          reason: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          note?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_claims: {
        Row: {
          business_role: string
          created_at: string
          id: string
          place_id: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          verification_note: string
        }
        Insert: {
          business_role: string
          created_at?: string
          id?: string
          place_id: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          verification_note: string
        }
        Update: {
          business_role?: string
          created_at?: string
          id?: string
          place_id?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          verification_note?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_contact_permissions: {
        Row: {
          allow_messages: boolean
          allow_vouchers: boolean
          granted_at: string
          place_id: string
          revoked_at: string | null
          source_dish_id: string
          user_id: string
        }
        Insert: {
          allow_messages?: boolean
          allow_vouchers?: boolean
          granted_at?: string
          place_id: string
          revoked_at?: string | null
          source_dish_id: string
          user_id: string
        }
        Update: {
          allow_messages?: boolean
          allow_vouchers?: boolean
          granted_at?: string
          place_id?: string
          revoked_at?: string | null
          source_dish_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_contact_permissions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_contact_permissions_source_dish_id_fkey"
            columns: ["source_dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_gallery_photos: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          display_order: number
          id: string
          photo_url: string
          place_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          display_order?: number
          id?: string
          photo_url: string
          place_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          photo_url?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_gallery_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_memberships: {
        Row: {
          created_at: string
          place_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          place_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          place_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_memberships_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_outreach: {
        Row: {
          body: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          place_id: string
          read_at: string | null
          recipient_user_id: string
          redeemed_at: string | null
          sender_user_id: string
          subject: string
          voucher_code: string | null
          voucher_terms: string | null
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          place_id: string
          read_at?: string | null
          recipient_user_id: string
          redeemed_at?: string | null
          sender_user_id: string
          subject: string
          voucher_code?: string | null
          voucher_terms?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          place_id?: string
          read_at?: string | null
          recipient_user_id?: string
          redeemed_at?: string | null
          sender_user_id?: string
          subject?: string
          voucher_code?: string | null
          voucher_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_outreach_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_profiles: {
        Row: {
          cover_url: string | null
          instagram_url: string | null
          is_verified: boolean
          line_url: string | null
          logo_url: string | null
          menu_url: string | null
          official_description: string | null
          phone: string | null
          place_id: string
          reservation_url: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cover_url?: string | null
          instagram_url?: string | null
          is_verified?: boolean
          line_url?: string | null
          logo_url?: string | null
          menu_url?: string | null
          official_description?: string | null
          phone?: string | null
          place_id: string
          reservation_url?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cover_url?: string | null
          instagram_url?: string | null
          is_verified?: boolean
          line_url?: string | null
          logo_url?: string | null
          menu_url?: string | null
          official_description?: string | null
          phone?: string | null
          place_id?: string
          reservation_url?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_profiles_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          place_id: string
          published_at: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          place_id: string
          published_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          place_id?: string
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_updates_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_retention_preferences: {
        Row: {
          challenge_notifications: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          challenge_notifications?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          challenge_notifications?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_merge_dishes: {
        Args: { _keep_id: string; _remove_id: string }
        Returns: Json
      }
      admin_merge_places: {
        Args: { _keep_id: string; _remove_id: string }
        Returns: Json
      }
      admin_review_restaurant_claim: {
        Args: {
          _approve: boolean
          _claim_id: string
          _review_note?: string
          _reviewed_by: string
        }
        Returns: Json
      }
      category_has_active_subtypes: {
        Args: { _category_id: string }
        Returns: boolean
      }
      category_is_subtype_scoped: {
        Args: { _category_id: string }
        Returns: boolean
      }
      dish_ranking_key: { Args: { _dish_id: string }; Returns: string }
      get_dish_tried_counts: {
        Args: { _dish_ids: string[] }
        Returns: {
          dish_id: string
          tries_count: number
        }[]
      }
      get_follow_counts: {
        Args: { _user_id: string }
        Returns: {
          followers_count: number
          following_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      nearby_places: {
        Args: {
          _lat: number
          _lng: number
          _max_results?: number
          _radius_km?: number
        }
        Returns: {
          address: string
          area_id: string
          distance_km: number
          id: string
          lat: number
          lng: number
          name: string
        }[]
      }
      normalize_dish_name: { Args: { _s: string }; Returns: string }
      restaurant_growth_is_active: {
        Args: { _place_id: string }
        Returns: boolean
      }
      search_places_by_similarity: {
        Args: { _term: string }
        Returns: {
          address: string
          area_id: string
          id: string
          name: string
          similarity_score: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_comparison_atomic: {
        Args: {
          _dish_a_id: string
          _dish_b_id: string
          _user_id: string
          _winner_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      dish_status: "pending" | "approved" | "rejected"
      report_status: "open" | "resolved" | "dismissed"
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
      app_role: ["admin", "moderator", "user"],
      dish_status: ["pending", "approved", "rejected"],
      report_status: ["open", "resolved", "dismissed"],
    },
  },
} as const
