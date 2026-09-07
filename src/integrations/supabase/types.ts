export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ServiceStatus = "published" | "draft";
export type ProjectStatus = "published" | "draft";
export type MessageStatus = "new" | "read";

export type Database = {
  public: {
    Tables: {
      services: {
        Row: {
          id: string;
          title: string;
          short_description: string;
          detail_description: string | null;
          icon_name: string | null;
          image_url: string | null;
          sort_order: number;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          short_description: string;
          detail_description?: string | null;
          icon_name?: string | null;
          image_url?: string | null;
          sort_order?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          location: string | null;
          project_year: string | null;
          short_description: string;
          detail_description: string | null;
          cover_image_url: string | null;
          gallery_images: string[] | null;
          sort_order: number;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          location?: string | null;
          project_year?: string | null;
          short_description: string;
          detail_description?: string | null;
          cover_image_url?: string | null;
          gallery_images?: string[] | null;
          sort_order?: number;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      contact_messages: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          subject: string | null;
          message: string;
          status: MessageStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          subject?: string | null;
          message: string;
          status?: MessageStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_messages"]["Insert"]>;
      };
      site_settings: {
        Row: {
          id: string;
          company_name: string;
          phone: string;
          whatsapp: string;
          email: string;
          address: string;
          map_url: string | null;
          map_embed_url: string | null;
          linkedin_url: string | null;
          instagram_url: string | null;
          seo_title: string;
          seo_description: string;
          footer_description: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name?: string;
          phone?: string;
          whatsapp?: string;
          email?: string;
          address?: string;
          map_url?: string | null;
          map_embed_url?: string | null;
          linkedin_url?: string | null;
          instagram_url?: string | null;
          seo_title?: string;
          seo_description?: string;
          footer_description?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: "admin" | "user";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: "admin" | "user";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
    };
  };
};

export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ContactMessageRow = Database["public"]["Tables"]["contact_messages"]["Row"];
export type SiteSettingsRow = Database["public"]["Tables"]["site_settings"]["Row"];
