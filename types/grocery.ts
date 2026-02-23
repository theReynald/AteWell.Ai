export type NutritionData = {
  nutriscore_grade?: string; // a, b, c, d, e
  nova_group?: number; // 1-4 (food processing level)
  calories_per_100g?: number;
  fat_per_100g?: number;
  sugars_per_100g?: number;
  salt_per_100g?: number;
  fiber_per_100g?: number;
  proteins_per_100g?: number;
  ingredients_text?: string;
  allergens?: string;
};

export type GroceryItem = {
  id: string;
  name: string;
  isEditing: boolean;
  healthSuggestion?: string;
  suggestionReason?: string;
  showingSuggestion?: boolean;
  isLoadingSuggestion?: boolean;
  imageUrl?: string;
  isLoadingImage?: boolean;
  // Barcode scan data
  barcode?: string;
  brand?: string;
  nutritionData?: NutritionData;
  scannedProductImage?: string;
};
