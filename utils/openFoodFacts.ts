import { NutritionData } from "@/types/grocery";

export type OpenFoodFactsProduct = {
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_small_url?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  nutriments?: {
    "energy-kcal_100g"?: number;
    fat_100g?: number;
    sugars_100g?: number;
    salt_100g?: number;
    fiber_100g?: number;
    proteins_100g?: number;
  };
  ingredients_text?: string;
  allergens_tags?: string[];
  categories?: string;
};

export type ProductLookupResult = {
  found: boolean;
  name?: string;
  brand?: string;
  imageUrl?: string;
  nutritionData?: NutritionData;
  categories?: string;
};

export async function lookupBarcode(
  barcode: string,
): Promise<ProductLookupResult> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: {
          "User-Agent": "AteWellAI/1.0 (grocery-tracker-app)",
        },
      },
    );

    if (!response.ok) {
      return { found: false };
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return { found: false };
    }

    const product: OpenFoodFactsProduct = data.product;

    const nutritionData: NutritionData = {
      nutriscore_grade: product.nutriscore_grade,
      nova_group: product.nova_group,
      calories_per_100g: product.nutriments?.["energy-kcal_100g"],
      fat_per_100g: product.nutriments?.fat_100g,
      sugars_per_100g: product.nutriments?.sugars_100g,
      salt_per_100g: product.nutriments?.salt_100g,
      fiber_per_100g: product.nutriments?.fiber_100g,
      proteins_per_100g: product.nutriments?.proteins_100g,
      ingredients_text: product.ingredients_text,
      allergens: product.allergens_tags?.join(", "),
    };

    return {
      found: true,
      name: product.product_name || "Unknown Product",
      brand: product.brands,
      imageUrl: product.image_small_url || product.image_url,
      nutritionData,
      categories: product.categories,
    };
  } catch (error) {
    console.error("Error looking up barcode:", error);
    return { found: false };
  }
}

export function getNutriscoreColor(grade?: string): string {
  switch (grade?.toLowerCase()) {
    case "a":
      return "#038141";
    case "b":
      return "#85BB2F";
    case "c":
      return "#FECB02";
    case "d":
      return "#EE8100";
    case "e":
      return "#E63E11";
    default:
      return "#999";
  }
}

export function getNutriscoreLabel(grade?: string): string {
  switch (grade?.toLowerCase()) {
    case "a":
      return "Excellent";
    case "b":
      return "Good";
    case "c":
      return "Average";
    case "d":
      return "Poor";
    case "e":
      return "Bad";
    default:
      return "Unknown";
  }
}

export function getNovaGroupLabel(group?: number): string {
  switch (group) {
    case 1:
      return "Unprocessed";
    case 2:
      return "Processed ingredients";
    case 3:
      return "Processed foods";
    case 4:
      return "Ultra-processed";
    default:
      return "Unknown";
  }
}

export function getNovaGroupColor(group?: number): string {
  switch (group) {
    case 1:
      return "#038141";
    case 2:
      return "#85BB2F";
    case 3:
      return "#EE8100";
    case 4:
      return "#E63E11";
    default:
      return "#999";
  }
}
