export type GroceryItem = {
  id: string;
  name: string;
  barcode?: string | null;
  brand?: string | null;
  image_url?: string | null;
  scanned_product_image?: string | null;
  nutrition_data?: unknown;
  health_suggestion?: string | null;
  suggestion_reason?: string | null;
  created_at?: string;
};
