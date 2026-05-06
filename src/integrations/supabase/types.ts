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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ab_test_assignments: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          test_id: string
          variant_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          test_id: string
          variant_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          test_id?: string
          variant_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_assignments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_events: {
        Row: {
          amount: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          order_id: string | null
          test_id: string
          variant_id: string
          visitor_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          test_id: string
          variant_id: string
          visitor_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          test_id?: string
          variant_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_variants: {
        Row: {
          checkout_url: string | null
          clicks: number
          created_at: string
          id: string
          impressions: number
          label: string
          mirror_pixel_id: string | null
          name: string
          page_url: string | null
          paused: boolean
          revenue: number
          sales: number
          sort_order: number
          test_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          checkout_url?: string | null
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          label: string
          mirror_pixel_id?: string | null
          name?: string
          page_url?: string | null
          paused?: boolean
          revenue?: number
          sales?: number
          sort_order?: number
          test_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          checkout_url?: string | null
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          label?: string
          mirror_pixel_id?: string | null
          name?: string
          page_url?: string | null
          paused?: boolean
          revenue?: number
          sales?: number
          sort_order?: number
          test_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_variants_mirror_pixel_id_fkey"
            columns: ["mirror_pixel_id"]
            isOneToOne: false
            referencedRelation: "mirror_pixels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_variants_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_tests: {
        Row: {
          auto_winner_enabled: boolean
          auto_winner_min_clicks: number
          auto_winner_min_uplift: number
          conversion_goal: string | null
          created_at: string
          ended_at: string | null
          entry_url: string | null
          graph: Json
          id: string
          name: string
          slug: string
          started_at: string | null
          status: string
          sticky_days: number
          targeting_rules: Json | null
          traffic_split: string
          updated_at: string
          user_id: string
          winner_variant_id: string | null
        }
        Insert: {
          auto_winner_enabled?: boolean
          auto_winner_min_clicks?: number
          auto_winner_min_uplift?: number
          conversion_goal?: string | null
          created_at?: string
          ended_at?: string | null
          entry_url?: string | null
          graph?: Json
          id?: string
          name?: string
          slug: string
          started_at?: string | null
          status?: string
          sticky_days?: number
          targeting_rules?: Json | null
          traffic_split?: string
          updated_at?: string
          user_id: string
          winner_variant_id?: string | null
        }
        Update: {
          auto_winner_enabled?: boolean
          auto_winner_min_clicks?: number
          auto_winner_min_uplift?: number
          conversion_goal?: string | null
          created_at?: string
          ended_at?: string | null
          entry_url?: string | null
          graph?: Json
          id?: string
          name?: string
          slug?: string
          started_at?: string | null
          status?: string
          sticky_days?: number
          targeting_rules?: Json | null
          traffic_split?: string
          updated_at?: string
          user_id?: string
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_winner_variant_fk"
            columns: ["winner_variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      abandoned_carts: {
        Row: {
          checkout_step: string | null
          checkout_url: string | null
          created_at: string
          customer_city: string | null
          customer_country: string | null
          customer_cpf: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_zip: string | null
          email_recovery_sent_at: string | null
          email_recovery_status: string | null
          email_reminder_count: number | null
          id: string
          ip_address: string | null
          notes: string | null
          page_url: string | null
          payment_method: string | null
          product_id: string
          product_price: number | null
          recovered: boolean
          updated_at: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          checkout_step?: string | null
          checkout_url?: string | null
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_zip?: string | null
          email_recovery_sent_at?: string | null
          email_recovery_status?: string | null
          email_reminder_count?: number | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          page_url?: string | null
          payment_method?: string | null
          product_id: string
          product_price?: number | null
          recovered?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          checkout_step?: string | null
          checkout_url?: string | null
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_zip?: string | null
          email_recovery_sent_at?: string | null
          email_recovery_status?: string | null
          email_reminder_count?: number | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          page_url?: string | null
          payment_method?: string | null
          product_id?: string
          product_price?: number | null
          recovered?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      appsell_integrations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          login_url: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          login_url?: string | null
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          login_url?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_accounts: {
        Row: {
          auto_recharge_amount: number
          auto_recharge_enabled: boolean
          auto_recharge_threshold: number
          balance: number
          blocked: boolean
          card_brand: string | null
          card_last4: string | null
          card_token: string | null
          created_at: string
          credit_limit: number
          credit_tier: string
          id: string
          last_auto_recharge_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_recharge_amount?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          balance?: number
          blocked?: boolean
          card_brand?: string | null
          card_last4?: string | null
          card_token?: string | null
          created_at?: string
          credit_limit?: number
          credit_tier?: string
          id?: string
          last_auto_recharge_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_recharge_amount?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          balance?: number
          blocked?: boolean
          card_brand?: string | null
          card_last4?: string | null
          card_token?: string | null
          created_at?: string
          credit_limit?: number
          credit_tier?: string
          id?: string
          last_auto_recharge_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_recharges: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          external_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          external_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          external_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_tiers: {
        Row: {
          color: string
          credit_limit: number
          id: string
          key: string
          label: string
          level: number
          updated_at: string
        }
        Insert: {
          color?: string
          credit_limit?: number
          id?: string
          key: string
          label: string
          level?: number
          updated_at?: string
        }
        Update: {
          color?: string
          credit_limit?: number
          id?: string
          key?: string
          label?: string
          level?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bin_cache: {
        Row: {
          bank_name: string | null
          bin: string
          brand: string | null
          country_alpha2: string | null
          created_at: string
          raw: Json | null
          scheme: string | null
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          bin: string
          brand?: string | null
          country_alpha2?: string | null
          created_at?: string
          raw?: Json | null
          scheme?: string | null
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          bin?: string
          brand?: string | null
          country_alpha2?: string | null
          created_at?: string
          raw?: Json | null
          scheme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_recovery_settings: {
        Row: {
          created_at: string
          email_button_color: string | null
          email_button_text: string | null
          email_delay_minutes: number
          email_enabled: boolean
          email_heading: string | null
          email_subject: string | null
          id: string
          second_email_delay_hours: number | null
          second_email_enabled: boolean | null
          updated_at: string
          user_id: string
          whatsapp_delay_minutes: number | null
          whatsapp_enabled: boolean | null
          whatsapp_message_template: string | null
        }
        Insert: {
          created_at?: string
          email_button_color?: string | null
          email_button_text?: string | null
          email_delay_minutes?: number
          email_enabled?: boolean
          email_heading?: string | null
          email_subject?: string | null
          id?: string
          second_email_delay_hours?: number | null
          second_email_enabled?: boolean | null
          updated_at?: string
          user_id: string
          whatsapp_delay_minutes?: number | null
          whatsapp_enabled?: boolean | null
          whatsapp_message_template?: string | null
        }
        Update: {
          created_at?: string
          email_button_color?: string | null
          email_button_text?: string | null
          email_delay_minutes?: number
          email_enabled?: boolean
          email_heading?: string | null
          email_subject?: string | null
          id?: string
          second_email_delay_hours?: number | null
          second_email_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          whatsapp_delay_minutes?: number | null
          whatsapp_enabled?: boolean | null
          whatsapp_message_template?: string | null
        }
        Relationships: []
      }
      checkout_builder_configs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_split_active: boolean | null
          layout: Json
          name: string
          price: number | null
          product_id: string
          settings: Json
          test_started_at: string | null
          traffic_weight: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_split_active?: boolean | null
          layout?: Json
          name?: string
          price?: number | null
          product_id: string
          settings?: Json
          test_started_at?: string | null
          traffic_weight?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_split_active?: boolean | null
          layout?: Json
          name?: string
          price?: number | null
          product_id?: string
          settings?: Json
          test_started_at?: string | null
          traffic_weight?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_builder_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_settings: {
        Row: {
          company_name: string | null
          countdown_minutes: number | null
          custom_css: string | null
          id: string
          logo_url: string | null
          pix_discount_percent: number | null
          primary_color: string | null
          show_countdown: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          countdown_minutes?: number | null
          custom_css?: string | null
          id?: string
          logo_url?: string | null
          pix_discount_percent?: number | null
          primary_color?: string | null
          show_countdown?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          countdown_minutes?: number | null
          custom_css?: string | null
          id?: string
          logo_url?: string | null
          pix_discount_percent?: number | null
          primary_color?: string | null
          show_countdown?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      checkout_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          layout: Json
          name: string
          published: boolean
          settings: Json
          thumbnail_url: string | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          layout?: Json
          name: string
          published?: boolean
          settings?: Json
          thumbnail_url?: string | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          layout?: Json
          name?: string
          published?: boolean
          settings?: Json
          thumbnail_url?: string | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      collaborator_payout_requests: {
        Row: {
          amount: number
          collaborator_id: string
          created_at: string | null
          id: string
          pix_key: string
          processed_at: string | null
          processed_by: string | null
          status: string | null
        }
        Insert: {
          amount: number
          collaborator_id: string
          created_at?: string | null
          id?: string
          pix_key: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          collaborator_id?: string
          created_at?: string | null
          id?: string
          pix_key?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      collaborator_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_amount: number | null
          product_id: string | null
          used_count: number
          user_id: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          product_id?: string | null
          used_count?: number
          user_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          product_id?: string | null
          used_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          file_url: string | null
          id: string
          module_id: string
          sort_order: number
          title: string
        }
        Insert: {
          content?: string | null
          content_type?: string
          created_at?: string
          file_url?: string | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          file_url?: string | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_products: {
        Row: {
          course_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_products_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_reply_enabled: boolean
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_reply_enabled?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_reply_enabled?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domains: {
        Row: {
          cloudflare_hostname_id: string | null
          created_at: string
          hostname: string
          id: string
          ssl_status: string | null
          status: string
          stripe_apple_pay_status: string | null
          stripe_pmd_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          hostname: string
          id?: string
          ssl_status?: string | null
          status?: string
          stripe_apple_pay_status?: string | null
          stripe_pmd_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          hostname?: string
          id?: string
          ssl_status?: string | null
          status?: string
          stripe_apple_pay_status?: string | null
          stripe_pmd_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          cpf: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          id: string
          metrics_order: Json
          updated_at: string
          user_id: string
          visible_metrics: Json
        }
        Insert: {
          id?: string
          metrics_order?: Json
          updated_at?: string
          user_id: string
          visible_metrics?: Json
        }
        Update: {
          id?: string
          metrics_order?: Json
          updated_at?: string
          user_id?: string
          visible_metrics?: Json
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounce_reason: string | null
          bounced_at: string | null
          clicked_at: string | null
          cost_estimate: number | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          email_type: string
          html_body: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          order_id: string | null
          product_id: string | null
          resend_id: string | null
          source: string | null
          status: string
          subject: string
          to_email: string
          to_name: string | null
          user_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type?: string
          html_body?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          product_id?: string | null
          resend_id?: string | null
          source?: string | null
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
          user_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type?: string
          html_body?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          product_id?: string | null
          resend_id?: string | null
          source?: string | null
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      emq_snapshots: {
        Row: {
          browser_count: number | null
          created_at: string
          dedup_rate: number | null
          dual_count: number | null
          emq_score: number | null
          event_name: string
          id: string
          pixel_id: string
          product_id: string
          server_count: number | null
          snapshot_date: string
          vid_coverage: number | null
        }
        Insert: {
          browser_count?: number | null
          created_at?: string
          dedup_rate?: number | null
          dual_count?: number | null
          emq_score?: number | null
          event_name: string
          id?: string
          pixel_id: string
          product_id: string
          server_count?: number | null
          snapshot_date?: string
          vid_coverage?: number | null
        }
        Update: {
          browser_count?: number | null
          created_at?: string
          dedup_rate?: number | null
          dual_count?: number | null
          emq_score?: number | null
          event_name?: string
          id?: string
          pixel_id?: string
          product_id?: string
          server_count?: number | null
          snapshot_date?: string
          vid_coverage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "emq_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      fraud_blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          type: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      gatflow_integrations: {
        Row: {
          active: boolean | null
          api_secret: string | null
          created_at: string
          id: string
          plan_tier: string | null
          shop_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          api_secret?: string | null
          created_at?: string
          id?: string
          plan_tier?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          api_secret?: string | null
          created_at?: string
          id?: string
          plan_tier?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_tasks: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_materials: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          lesson_id: string
          material_type: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          lesson_id: string
          material_type?: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          lesson_id?: string
          material_type?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          lesson_id: string
          member_access_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id: string
          member_access_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id?: string
          member_access_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_member_access_id_fkey"
            columns: ["member_access_id"]
            isOneToOne: false
            referencedRelation: "member_access"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reviews: {
        Row: {
          approved: boolean
          comment: string | null
          created_at: string
          customer_name: string
          id: string
          lesson_id: string
          member_access_id: string
          rating: number
        }
        Insert: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          lesson_id: string
          member_access_id: string
          rating?: number
        }
        Update: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          lesson_id?: string
          member_access_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reviews_member_access_id_fkey"
            columns: ["member_access_id"]
            isOneToOne: false
            referencedRelation: "member_access"
            referencedColumns: ["id"]
          },
        ]
      }
      maria_ai_settings: {
        Row: {
          active: boolean
          auto_reply_on_approve: boolean
          avatar_url: string | null
          cross_sell_enabled: boolean
          id: string
          max_tokens: number
          model: string
          persona_name: string
          system_prompt: string
          temperature: number
          total_replies: number
          total_tokens_used: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_reply_on_approve?: boolean
          avatar_url?: string | null
          cross_sell_enabled?: boolean
          id?: string
          max_tokens?: number
          model?: string
          persona_name?: string
          system_prompt?: string
          temperature?: number
          total_replies?: number
          total_tokens_used?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_reply_on_approve?: boolean
          avatar_url?: string | null
          cross_sell_enabled?: boolean
          id?: string
          max_tokens?: number
          model?: string
          persona_name?: string
          system_prompt?: string
          temperature?: number
          total_replies?: number
          total_tokens_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_app_installations: {
        Row: {
          access_token: string | null
          active: boolean | null
          app_id: string | null
          id: string
          installed_at: string
          plan_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean | null
          app_id?: string | null
          id?: string
          installed_at?: string
          plan_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean | null
          app_id?: string | null
          id?: string
          installed_at?: string
          plan_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_app_installations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_apps: {
        Row: {
          active: boolean | null
          client_id: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          redirect_url: string | null
          slug: string
          sso_secret: string
          sso_url: string | null
          updated_at: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          client_id?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          redirect_url?: string | null
          slug: string
          sso_secret?: string
          sso_url?: string | null
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          client_id?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          redirect_url?: string | null
          slug?: string
          sso_secret?: string
          sso_url?: string | null
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      marketplace_oauth_codes: {
        Row: {
          app_id: string | null
          code: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          app_id?: string | null
          code: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          app_id?: string | null
          code?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_oauth_codes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_partners: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          shared_secret: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          shared_secret?: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          shared_secret?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      member_access: {
        Row: {
          access_token: string
          course_id: string
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          order_id: string | null
        }
        Insert: {
          access_token?: string
          course_id: string
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
        }
        Update: {
          access_token?: string
          course_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_access_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_access_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mirror_pixels: {
        Row: {
          active: boolean
          capi_token: string
          created_at: string
          event_source_url_override: string | null
          fire_on_events: string[]
          id: string
          label: string
          last_event_at: string | null
          last_meta_response: Json | null
          pixel_id: string
          total_events_sent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capi_token: string
          created_at?: string
          event_source_url_override?: string | null
          fire_on_events?: string[]
          id?: string
          label?: string
          last_event_at?: string | null
          last_meta_response?: Json | null
          pixel_id: string
          total_events_sent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capi_token?: string
          created_at?: string
          event_source_url_override?: string | null
          fire_on_events?: string[]
          id?: string
          label?: string
          last_event_at?: string | null
          last_meta_response?: Json | null
          pixel_id?: string
          total_events_sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          email_pix_reminder: boolean
          id: string
          notification_pattern: string
          notification_sound: string
          product_whitelist: string[] | null
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          report_08: boolean
          report_12: boolean
          report_18: boolean
          report_23: boolean
          send_abandoned_cart: boolean
          send_approved: boolean
          send_pending: boolean
          show_dashboard_name: boolean
          show_product_name: boolean
          show_utm_campaign: boolean
          show_value: string
          updated_at: string
          user_id: string
          whatsapp_pix_reminder: boolean
        }
        Insert: {
          created_at?: string
          email_pix_reminder?: boolean
          id?: string
          notification_pattern?: string
          notification_sound?: string
          product_whitelist?: string[] | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          report_08?: boolean
          report_12?: boolean
          report_18?: boolean
          report_23?: boolean
          send_abandoned_cart?: boolean
          send_approved?: boolean
          send_pending?: boolean
          show_dashboard_name?: boolean
          show_product_name?: boolean
          show_utm_campaign?: boolean
          show_value?: string
          updated_at?: string
          user_id: string
          whatsapp_pix_reminder?: boolean
        }
        Update: {
          created_at?: string
          email_pix_reminder?: boolean
          id?: string
          notification_pattern?: string
          notification_sound?: string
          product_whitelist?: string[] | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          report_08?: boolean
          report_12?: boolean
          report_18?: boolean
          report_23?: boolean
          send_abandoned_cart?: boolean
          send_approved?: boolean
          send_pending?: boolean
          show_dashboard_name?: boolean
          show_product_name?: boolean
          show_utm_campaign?: boolean
          show_value?: string
          updated_at?: string
          user_id?: string
          whatsapp_pix_reminder?: boolean
        }
        Relationships: []
      }
      order_bumps: {
        Row: {
          active: boolean
          bump_product_id: string
          call_to_action: string
          created_at: string
          description: string
          id: string
          product_id: string
          sort_order: number
          title: string
          use_product_image: boolean
          user_id: string | null
        }
        Insert: {
          active?: boolean
          bump_product_id: string
          call_to_action?: string
          created_at?: string
          description?: string
          id?: string
          product_id: string
          sort_order?: number
          title?: string
          use_product_image?: boolean
          user_id?: string | null
        }
        Update: {
          active?: boolean
          bump_product_id?: string
          call_to_action?: string
          created_at?: string
          description?: string
          id?: string
          product_id?: string
          sort_order?: number
          title?: string
          use_product_image?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          collaborator_id: string | null
          created_at: string
          customer_city: string | null
          customer_country: string | null
          customer_id: string | null
          customer_state: string | null
          customer_zip: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          payment_method: string
          platform_fee_amount: number | null
          platform_fee_percent: number | null
          product_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          collaborator_id?: string | null
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_id?: string | null
          customer_state?: string | null
          customer_zip?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string
          platform_fee_amount?: number | null
          platform_fee_percent?: number | null
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          collaborator_id?: string | null
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_id?: string | null
          customer_state?: string | null
          customer_zip?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string
          platform_fee_amount?: number | null
          platform_fee_percent?: number | null
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          environment: string
          id: string
          name: string
          payment_methods: Json
          provider: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          name?: string
          payment_methods?: Json
          provider: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          name?: string
          payment_methods?: Json
          provider?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          created_at: string | null
          customer_email: string | null
          error: Json | null
          function_name: string
          id: string
          level: string | null
          message: string | null
          payload: Json | null
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          error?: Json | null
          function_name: string
          id?: string
          level?: string | null
          message?: string | null
          payload?: Json | null
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          error?: Json | null
          function_name?: string
          id?: string
          level?: string | null
          message?: string | null
          payload?: Json | null
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pending_sends: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          message: string
          sent_at: string | null
          status: string
          tenant_id: string
          to_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          message: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          to_number: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          message?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          to_number?: string
        }
        Relationships: []
      }
      pixel_events: {
        Row: {
          created_at: string
          customer_city: string | null
          customer_country: string | null
          customer_name: string | null
          event_id: string | null
          event_name: string
          event_value: number | null
          id: string
          is_bot: boolean
          pixel_id: string | null
          product_id: string
          source: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_name?: string | null
          event_id?: string | null
          event_name: string
          event_value?: number | null
          id?: string
          is_bot?: boolean
          pixel_id?: string | null
          product_id: string
          source?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          customer_city?: string | null
          customer_country?: string | null
          customer_name?: string | null
          event_id?: string | null
          event_name?: string
          event_value?: number | null
          id?: string
          is_bot?: boolean
          pixel_id?: string | null
          product_id?: string
          source?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          clarity_project_id: string | null
          id: string
          platform_fee_percent: number | null
          platform_name: string | null
          updated_at: string | null
        }
        Insert: {
          clarity_project_id?: string | null
          id?: string
          platform_fee_percent?: number | null
          platform_name?: string | null
          updated_at?: string | null
        }
        Update: {
          clarity_project_id?: string | null
          id?: string
          platform_fee_percent?: number | null
          platform_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      producer_verifications: {
        Row: {
          address_proof_url: string | null
          created_at: string
          document_back_url: string | null
          document_front_url: string | null
          document_type: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_proof_url?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_type?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_proof_url?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_type?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_pixels: {
        Row: {
          capi_token: string | null
          created_at: string
          domain: string | null
          fire_on_boleto: boolean
          fire_on_pix: boolean
          id: string
          last_event_at: string | null
          last_health_check_at: string | null
          pixel_id: string
          platform: string
          product_id: string
          token_status: string
          user_id: string | null
        }
        Insert: {
          capi_token?: string | null
          created_at?: string
          domain?: string | null
          fire_on_boleto?: boolean
          fire_on_pix?: boolean
          id?: string
          last_event_at?: string | null
          last_health_check_at?: string | null
          pixel_id: string
          platform?: string
          product_id: string
          token_status?: string
          user_id?: string | null
        }
        Update: {
          capi_token?: string | null
          created_at?: string
          domain?: string | null
          fire_on_boleto?: boolean
          fire_on_pix?: boolean
          id?: string
          last_event_at?: string | null
          last_health_check_at?: string | null
          pixel_id?: string
          platform?: string
          product_id?: string
          token_status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          billing_cycle: string
          created_at: string
          currency: string
          delivery_method: string
          description: string | null
          id: string
          image_url: string | null
          is_subscription: boolean
          moderation_status: string
          name: string
          original_price: number | null
          payment_settings: Json
          price: number
          rejection_reason: string | null
          show_coupon: boolean
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          currency?: string
          delivery_method?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_subscription?: boolean
          moderation_status?: string
          name: string
          original_price?: number | null
          payment_settings?: Json
          price?: number
          rejection_reason?: string | null
          show_coupon?: boolean
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          currency?: string
          delivery_method?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_subscription?: boolean
          moderation_status?: string
          name?: string
          original_price?: number | null
          payment_settings?: Json
          price?: number
          rejection_reason?: string | null
          show_coupon?: boolean
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          pix_key: string | null
          profile_completed: boolean
          updated_at: string
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          pix_key?: string | null
          profile_completed?: boolean
          updated_at?: string
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_key?: string | null
          profile_completed?: boolean
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          app_name: string
          background_color: string
          description: string | null
          icon_192_url: string | null
          icon_512_url: string | null
          id: string
          notification_body: string | null
          notification_icon_url: string | null
          notification_title: string | null
          short_name: string
          splash_image_url: string | null
          theme_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name?: string
          background_color?: string
          description?: string | null
          icon_192_url?: string | null
          icon_512_url?: string | null
          id?: string
          notification_body?: string | null
          notification_icon_url?: string | null
          notification_title?: string | null
          short_name?: string
          splash_image_url?: string | null
          theme_color?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          background_color?: string
          description?: string | null
          icon_192_url?: string | null
          icon_512_url?: string | null
          id?: string
          notification_body?: string | null
          notification_icon_url?: string | null
          notification_title?: string | null
          short_name?: string
          splash_image_url?: string | null
          theme_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          action: string
          blocked: boolean
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          action: string
          blocked?: boolean
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          action?: string
          blocked?: boolean
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      recovery_opportunities: {
        Row: {
          abandoned_cart_id: string | null
          claimed_at: string | null
          closed_at: string | null
          collaborator_id: string | null
          contacted_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          outcome: string | null
          reference_id: string
          released_at: string | null
          released_reason: string | null
          status: string | null
          type: string
        }
        Insert: {
          abandoned_cart_id?: string | null
          claimed_at?: string | null
          closed_at?: string | null
          collaborator_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          outcome?: string | null
          reference_id: string
          released_at?: string | null
          released_reason?: string | null
          status?: string | null
          type: string
        }
        Update: {
          abandoned_cart_id?: string | null
          claimed_at?: string | null
          closed_at?: string | null
          collaborator_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          outcome?: string | null
          reference_id?: string
          released_at?: string | null
          released_reason?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_opportunities_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_opportunities_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_release_log: {
        Row: {
          collaborator_id: string
          id: string
          reason: string | null
          recovery_id: string
          released_at: string
        }
        Insert: {
          collaborator_id: string
          id?: string
          reason?: string | null
          recovery_id: string
          released_at?: string
        }
        Update: {
          collaborator_id?: string
          id?: string
          reason?: string | null
          recovery_id?: string
          released_at?: string
        }
        Relationships: []
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          member_access_id: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_access_id: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_access_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_member_access_id_fkey"
            columns: ["member_access_id"]
            isOneToOne: false
            referencedRelation: "member_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "lesson_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          is_ai_reply: boolean
          member_access_id: string | null
          review_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          is_ai_reply?: boolean
          member_access_id?: string | null
          review_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_ai_reply?: boolean
          member_access_id?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_member_access_id_fkey"
            columns: ["member_access_id"]
            isOneToOne: false
            referencedRelation: "member_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "lesson_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pages: {
        Row: {
          created_at: string
          id: string
          layout: Json
          product_id: string
          published: boolean
          settings: Json
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          product_id: string
          published?: boolean
          settings?: Json
          slug: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          product_id?: string
          published?: boolean
          settings?: Json
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_recovery_attribution: {
        Row: {
          collaborator_id: string
          commission_amount: number
          created_at: string | null
          order_id: string
          product_price: number
        }
        Insert: {
          collaborator_id: string
          commission_amount: number
          created_at?: string | null
          order_id: string
          product_price: number
        }
        Update: {
          collaborator_id?: string
          commission_amount?: number
          created_at?: string | null
          order_id?: string
          product_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_recovery_attribution_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      upsell_offers: {
        Row: {
          active: boolean
          created_at: string
          description: string
          discount_percent: number
          id: string
          product_id: string
          sort_order: number
          title: string
          upsell_product_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          product_id: string
          sort_order?: number
          title?: string
          upsell_product_id: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          product_id?: string
          sort_order?: number
          title?: string
          upsell_product_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upsell_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_offers_upsell_product_id_fkey"
            columns: ["upsell_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      utmify_integrations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_audit_log: {
        Row: {
          block_reason: string | null
          blocked: boolean
          caller_type: string
          caller_user_id: string | null
          created_at: string
          deliveries_count: number | null
          environment: string
          event_type: string
          id: string
          ip_address: string | null
          order_id: string | null
          order_status_at_fire: string | null
          payload: Json | null
          user_agent: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean
          caller_type?: string
          caller_user_id?: string | null
          created_at?: string
          deliveries_count?: number | null
          environment?: string
          event_type: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          order_status_at_fire?: string | null
          payload?: Json | null
          user_agent?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean
          caller_type?: string
          caller_user_id?: string | null
          created_at?: string
          deliveries_count?: number | null
          environment?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          order_status_at_fire?: string | null
          payload?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          completed_at: string | null
          created_at: string
          endpoint_id: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          last_response_body: string | null
          last_response_status: number | null
          max_attempts: number
          next_retry_at: string | null
          order_id: string | null
          payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          endpoint_id: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          endpoint_id?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          events: string[]
          id: string
          product_id: string | null
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          product_id?: string | null
          secret?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          product_id?: string | null
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          gateway: string
          id: string
          processed_at: string
        }
        Insert: {
          gateway: string
          id: string
          processed_at?: string
        }
        Update: {
          gateway?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      whatsapp_configs: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          status: string | null
          tenant_id: string
          updated_at: string
          whatsapp_access_token: string | null
          whatsapp_business_id: string | null
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          tenant_id: string
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Relationships: []
      }
      whatsapp_feature_flags: {
        Row: {
          enabled: boolean
          feature: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_send_log: {
        Row: {
          created_at: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_status: string
          error_message: string | null
          external_message_id: string | null
          id: string
          message_body: string
          order_id: string | null
          read_at: string | null
          status: string
          template_category: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_body: string
          order_id?: string | null
          read_at?: string | null
          status?: string
          template_category: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_body?: string
          order_id?: string | null
          read_at?: string | null
          status?: string
          template_category?: string
          tenant_id?: string
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          instance_id: string
          node_url: string
          phone_number: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id: string
          node_url?: string
          phone_number?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          node_url?: string
          phone_number?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          flow_nodes: Json
          id: string
          name: string
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          active?: boolean
          body: string
          category?: string
          created_at?: string
          flow_nodes?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          flow_nodes?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
    }
    Views: {
      active_gateways: {
        Row: {
          environment: string | null
          id: string | null
          name: string | null
          payment_methods: Json | null
          provider: string | null
          user_id: string | null
        }
        Insert: {
          environment?: string | null
          id?: string | null
          name?: string | null
          payment_methods?: Json | null
          provider?: string | null
          user_id?: string | null
        }
        Update: {
          environment?: string | null
          id?: string | null
          name?: string | null
          payment_methods?: Json | null
          provider?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_order_bumps: {
        Row: {
          active: boolean | null
          bump_product_id: string | null
          call_to_action: string | null
          description: string | null
          id: string | null
          product_id: string | null
          sort_order: number | null
          title: string | null
          use_product_image: boolean | null
        }
        Insert: {
          active?: boolean | null
          bump_product_id?: string | null
          call_to_action?: string | null
          description?: string | null
          id?: string | null
          product_id?: string | null
          sort_order?: number | null
          title?: string | null
          use_product_image?: boolean | null
        }
        Update: {
          active?: boolean | null
          bump_product_id?: string | null
          call_to_action?: string | null
          description?: string | null
          id?: string | null
          product_id?: string | null
          sort_order?: number | null
          title?: string | null
          use_product_image?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      public_product_pixels: {
        Row: {
          domain: string | null
          fire_on_boleto: boolean | null
          fire_on_pix: boolean | null
          id: string | null
          pixel_id: string | null
          platform: string | null
          product_id: string | null
        }
        Insert: {
          domain?: string | null
          fire_on_boleto?: boolean | null
          fire_on_pix?: boolean | null
          id?: string | null
          pixel_id?: string | null
          platform?: string | null
          product_id?: string | null
        }
        Update: {
          domain?: string | null
          fire_on_boleto?: boolean | null
          fire_on_pix?: boolean | null
          id?: string | null
          pixel_id?: string | null
          platform?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      public_pwa_settings: {
        Row: {
          app_name: string | null
          background_color: string | null
          description: string | null
          icon_192_url: string | null
          icon_512_url: string | null
          id: string | null
          notification_body: string | null
          notification_icon_url: string | null
          notification_title: string | null
          short_name: string | null
          splash_image_url: string | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          app_name?: string | null
          background_color?: string | null
          description?: string | null
          icon_192_url?: string | null
          icon_512_url?: string | null
          id?: string | null
          notification_body?: string | null
          notification_icon_url?: string | null
          notification_title?: string | null
          short_name?: string | null
          splash_image_url?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          app_name?: string | null
          background_color?: string | null
          description?: string | null
          icon_192_url?: string | null
          icon_512_url?: string | null
          id?: string | null
          notification_body?: string | null
          notification_icon_url?: string | null
          notification_title?: string | null
          short_name?: string | null
          splash_image_url?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unclaimed_opportunities: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_purchases_count: number | null
          is_hot: boolean | null
          product_id: string | null
          product_name: string | null
          reference_id: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ab_evaluate_winner: { Args: { p_test_id: string }; Returns: string }
      ab_pick_variant: {
        Args: {
          p_link_type?: string
          p_test_slug: string
          p_visitor_id: string
        }
        Returns: Json
      }
      ab_record_conversion: {
        Args: { p_amount: number; p_order_id: string; p_visitor_id: string }
        Returns: boolean
      }
      add_billing_credit: {
        Args: { p_amount: number; p_description: string; p_user_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_identifier: string
          p_max_hits: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      collaborator_has_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: undefined
      }
      get_abandoned_cart_prefill: {
        Args: { p_cart_id: string }
        Returns: {
          customer_cpf: string
          customer_email: string
          customer_name: string
          customer_phone: string
          product_id: string
        }[]
      }
      get_analytics_summary: {
        Args: {
          p_date_from: string
          p_is_super_admin?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      get_appsell_login_url: { Args: { p_product_id: string }; Returns: string }
      get_checkout_settings: {
        Args: { p_user_id: string }
        Returns: {
          company_name: string
          countdown_minutes: number
          custom_css: string
          logo_url: string
          pix_discount_percent: number
          primary_color: string
          show_countdown: boolean
          user_id: string
        }[]
      }
      get_collaborator_monthly_stats: {
        Args: { p_collaborator_id: string; p_month: string }
        Returns: {
          base_commission: number
          bonus_meta: number
          sales_count: number
          total_earned: number
        }[]
      }
      get_courses_for_product: {
        Args: { p_product_id: string }
        Returns: string[]
      }
      get_dashboard_metrics:
        | {
            Args: {
              p_date_from?: string
              p_date_to?: string
              p_is_super_admin?: boolean
              p_product_id?: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_currency?: string
              p_date_from?: string
              p_date_to?: string
              p_is_super_admin?: boolean
              p_product_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      get_latest_pixel_events_per_product: {
        Args: never
        Returns: {
          latest_event: string
          product_id: string
        }[]
      }
      get_order_delivery_links: {
        Args: { p_order_id: string }
        Returns: {
          access_url: string
          delivery_type: string
        }[]
      }
      get_pixel_feedback_metrics: { Args: { p_days?: number }; Returns: Json }
      get_revenue_summary: {
        Args: { p_user_id: string }
        Returns: {
          paid_count: number
          paid_count_brl: number
          paid_count_usd: number
          pending_count: number
          total_fees: number
          total_fees_brl: number
          total_fees_usd: number
          total_pending: number
          total_pending_brl: number
          total_pending_usd: number
          total_revenue: number
          total_revenue_brl: number
          total_revenue_usd: number
        }[]
      }
      get_utm_attribution: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          campaign: string
          count: number
          currency: string
          medium: string
          revenue: number
          source: string
        }[]
      }
      get_webhook_secret: { Args: { p_webhook_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ab_variant_stat: {
        Args: { p_field: string; p_variant_id: string }
        Returns: undefined
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: boolean
      }
      is_email_unsubscribed: { Args: { p_email: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_verified_producer: { Args: { _user_id: string }; Returns: boolean }
      list_orders_paginated: {
        Args: {
          p_affiliate_search?: string
          p_currency?: string
          p_is_super_admin: boolean
          p_offer_filter?: string
          p_page: number
          p_page_size: number
          p_payment_methods?: string
          p_period?: string
          p_product_id?: string
          p_product_type?: string
          p_sale_type?: string
          p_search?: string
          p_status_filter?: string
          p_subscription_filter?: string
          p_user_id: string
          p_utm_search?: string
        }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      owns_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      owns_lesson: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      owns_module: {
        Args: { _module_id: string; _user_id: string }
        Returns: boolean
      }
      producer_has_gateway: { Args: { p_user_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reconcile_abandoned_carts: { Args: never; Returns: number }
      release_recovery: {
        Args: { p_reason?: string; p_recovery_id: string }
        Returns: Json
      }
      update_abandoned_cart: {
        Args: {
          p_cart_id: string
          p_checkout_step?: string
          p_customer_cpf?: string
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_payment_method?: string
        }
        Returns: boolean
      }
      update_pixel_token: {
        Args: { p_new_token: string; p_pixel_row_id: string }
        Returns: boolean
      }
      validate_coupon: {
        Args: { p_code: string }
        Returns: {
          code: string
          discount_type: string
          discount_value: number
          expires_at: string
          id: string
          max_uses: number
          min_amount: number
          product_id: string
          used_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "collaborator"
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
      app_role: ["admin", "user", "super_admin", "collaborator"],
    },
  },
} as const
