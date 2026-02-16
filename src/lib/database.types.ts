export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          name: string | null;
          stall_type: string | null;
          stall_address: string | null;
          preferred_language: "en" | "hi" | "te";
          photo_url: string | null;
          created_at: string;
          updated_at: string;
          credit_limit: number;
          credit_used: number;
          streak: number;
          points: number;
          tier: "Bronze" | "Silver" | "Gold";
          role: "vendor" | "admin";
          green_score?: number;
          business_address?: string | null;
          shop_photo_urls?: string[];
          gst_number?: string | null;
          pan_number?: string | null;
          udyam_number?: string | null;
          fssai_license?: string | null;
          other_business_details?: string | null;
        };
        Insert: {
          id: string;
          phone?: string | null;
          name?: string | null;
          stall_type?: string | null;
          stall_address?: string | null;
          preferred_language?: "en" | "hi" | "te";
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          credit_limit?: number;
          credit_used?: number;
          streak?: number;
          points?: number;
          tier?: "Bronze" | "Silver" | "Gold";
          role?: "vendor" | "admin";
          green_score?: number;
          business_address?: string | null;
          shop_photo_urls?: string[];
          gst_number?: string | null;
          pan_number?: string | null;
          udyam_number?: string | null;
          fssai_license?: string | null;
          other_business_details?: string | null;
        };
        Update: {
          id?: string;
          phone?: string | null;
          name?: string | null;
          stall_type?: string | null;
          stall_address?: string | null;
          preferred_language?: "en" | "hi" | "te";
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          credit_limit?: number;
          credit_used?: number;
          streak?: number;
          points?: number;
          tier?: "Bronze" | "Silver" | "Gold";
          role?: "vendor" | "admin";
          green_score?: number;
          business_address?: string | null;
          shop_photo_urls?: string[];
          gst_number?: string | null;
          pan_number?: string | null;
          udyam_number?: string | null;
          fssai_license?: string | null;
          other_business_details?: string | null;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          total: number;
          status: "pending" | "in-transit" | "delivered";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total: number;
          status?: "pending" | "in-transit" | "delivered";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      purchases_daily: {
        Row: {
          id: string;
          user_id: string;
          purchase_date: string;
          total_amount: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          purchase_date: string;
          total_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["purchases_daily"]["Insert"]>;
      };
      loyalty_points: {
        Row: {
          id: string;
          user_id: string;
          points: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          points: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["loyalty_points"]["Insert"]>;
      };
      draws_entries: {
        Row: {
          id: string;
          user_id: string;
          draw_date: string;
          eligible: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          draw_date: string;
          eligible: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["draws_entries"]["Insert"]>;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
