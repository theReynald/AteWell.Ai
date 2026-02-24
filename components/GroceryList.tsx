import { IconSymbol } from "@/components/ui/IconSymbol";
import { API_BASE_URL, SUPABASE_ANON_KEY } from "@/constants/Api";
import { useAuth } from "@/contexts/AuthContext";
import { useGrocery } from "@/contexts/GroceryContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { supabase } from "@/lib/supabase";
import { GroceryItem } from "@/types/grocery";
import {
    getNovaGroupColor,
    getNovaGroupLabel,
    getNutriscoreColor,
} from "@/utils/openFoodFacts";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Keyboard,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY;

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const { pendingItems, consumePendingItems } = useGrocery();
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const [editText, setEditText] = useState("");
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [zoomedImageName, setZoomedImageName] = useState<string>("");
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const router = useRouter();

  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // ─── Database helpers ───

  // Convert DB row → GroceryItem
  const rowToItem = (row: any): GroceryItem => ({
    id: row.id,
    name: row.name,
    isEditing: false,
    barcode: row.barcode ?? undefined,
    brand: row.brand ?? undefined,
    healthSuggestion: row.health_suggestion ?? undefined,
    suggestionReason: row.suggestion_reason ?? undefined,
    showingSuggestion: !!(row.health_suggestion),
    imageUrl: row.image_url ?? undefined,
    suggestionImageUrl: undefined,
    isLoadingSuggestionImage: false,
    scannedProductImage: row.scanned_product_image ?? undefined,
    nutritionData: row.nutrition_data ?? undefined,
  });

  // Load items from Supabase on mount
  const loadItems = useCallback(async () => {
    if (!user) return;
    setIsLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load items:", error.message);
      } else if (data) {
        setItems(data.map(rowToItem));
      }
    } catch (e: any) {
      // Fetch timed out or network error — show empty list instead of hanging
      console.warn("Network error loading items (continuing offline):", e.message);
    }
    setIsLoadingItems(false);
  }, [user]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Insert item into DB, returns the DB id
  const dbInsertItem = async (item: GroceryItem): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("grocery_items")
      .insert({
        user_id: user.id,
        name: item.name,
        barcode: item.barcode ?? null,
        brand: item.brand ?? null,
        scanned_product_image: item.scannedProductImage ?? null,
        nutrition_data: item.nutritionData ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("Error inserting item:", error);
      return null;
    }
    return data?.id ?? null;
  };

  // Update item fields in DB
  const dbUpdateItem = async (id: string, fields: Record<string, any>) => {
    const { error } = await supabase
      .from("grocery_items")
      .update(fields)
      .eq("id", id);
    if (error) console.warn("Error updating item:", error);
  };

  // Delete item from DB
  const dbDeleteItem = async (id: string) => {
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("id", id);
    if (error) console.warn("Error deleting item:", error);
  };

  // ─── End Database helpers ───

  const fetchSuggestionFromBackend = async (
    itemName: string,
    nutritionInfo?: string,
  ) => {
    // Dev: localhost:3000/api/health-suggestion
    // Prod: <supabase>/functions/v1/health-suggestion
    const base = API_BASE_URL;
    const usesFunctions = base.includes("/functions/v1");
    const endpoint = usesFunctions
      ? `${base}/health-suggestion`
      : `${base}/api/health-suggestion`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!__DEV__ && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith("YOUR")) {
      headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        itemName,
        nutritionContext: nutritionInfo,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return response.json();
  };

  const fetchPexelsImage = async (query: string, itemId: string) => {
    if (!PEXELS_API_KEY) return null;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, isLoadingSuggestionImage: true }
          : item,
      ),
    );

    try {
      // Try the exact query first, then fall back to appending "food" for better results
      const queries = [query, `${query} food`];
      let imageUrl: string | null = null;

      for (const q of queries) {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          q,
        )}&per_page=1&orientation=portrait`;

        const resp = await fetch(url, {
          headers: { Authorization: PEXELS_API_KEY },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const first = data?.photos?.[0];
        imageUrl = first?.src?.medium || first?.src?.large || null;
        if (imageUrl) break;
      }
      if (imageUrl) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, suggestionImageUrl: imageUrl }
              : item,
          ),
        );
      }
      return imageUrl;
    } catch (err) {
      console.warn("Pexels fetch failed", err);
      return null;
    } finally {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, isLoadingSuggestionImage: false }
            : item,
        ),
      );
    }
  };

  // Function to get health suggestion from backend proxy
  const getHealthSuggestion = async (
    itemId: string,
    itemName: string,
    nutritionInfo?: string,
  ) => {
    // Mark item as loading suggestion
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              isLoadingSuggestion: true,
              suggestionImageUrl: undefined,
              isLoadingSuggestionImage: false,
            }
          : item,
      ),
    );

    try {
      const data = await fetchSuggestionFromBackend(itemName, nutritionInfo);
      const suggestionText = data?.healthSuggestion as string | undefined;
      const suggestionReason = data?.suggestionReason || "";

      if (!suggestionText) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, isLoadingSuggestion: false }
              : item,
          ),
        );
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                healthSuggestion: suggestionText,
                suggestionReason,
                showingSuggestion: true,
                isLoadingSuggestion: false,
              }
            : item,
        ),
      );

      dbUpdateItem(itemId, {
        health_suggestion: suggestionText,
        suggestion_reason: suggestionReason,
      });

      fetchPexelsImage(suggestionText, itemId);
    } catch (error) {
      console.error("Error getting health suggestion:", error);
      // Silently fail — don't block the user with an alert
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, isLoadingSuggestion: false } : item,
        ),
      );
    }
  };

  // Function to replace original item with suggestion
  const replaceFoodItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.healthSuggestion) {
      // Clean the suggestion text for use as the item name
      const newName = item.healthSuggestion
        .replace(/\*\*/g, "")
        .replace(/[#*_~`>]/g, "")
        .replace(/^\d+[\.\)]\s*/, "")
        .trim()
        .split("\n")[0];

      setItems((prevItems) =>
        prevItems.map((i) => {
          if (i.id === id && i.healthSuggestion) {
            return {
              ...i,
              name: newName,
              healthSuggestion: undefined,
              suggestionReason: undefined,
              showingSuggestion: false,
              imageUrl: undefined,
              suggestionImageUrl: undefined,
            };
          }
          return i;
        }),
      );
      // Persist to DB
      dbUpdateItem(id, {
        name: newName,
        health_suggestion: null,
        suggestion_reason: null,
        image_url: null,
      });
    }
  };

  // Function to dismiss suggestion
  const dismissSuggestion = (id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id
          ? {
              ...item,
              showingSuggestion: false,
              healthSuggestion: undefined,
              suggestionReason: undefined,
            }
          : item,
      ),
    );
    // Clear from DB so web and future loads don't re-show it
    dbUpdateItem(id, {
      health_suggestion: null,
      suggestion_reason: null,
    });
  };

  // Build nutrition context string from scanned product data
  const buildNutritionContext = (item: GroceryItem): string | undefined => {
    if (!item.nutritionData) return undefined;
    const nd = item.nutritionData;
    const parts: string[] = [];
    if (nd.nutriscore_grade)
      parts.push(`Nutri-Score: ${nd.nutriscore_grade.toUpperCase()}`);
    if (nd.nova_group)
      parts.push(
        `NOVA group: ${nd.nova_group} (${getNovaGroupLabel(nd.nova_group)})`,
      );
    if (nd.calories_per_100g != null)
      parts.push(
        `Calories: ${Math.round(nd.calories_per_100g)} kcal/100g`,
      );
    if (nd.proteins_per_100g != null)
      parts.push(`Protein: ${nd.proteins_per_100g.toFixed(1)}g/100g`);
    if (nd.fat_per_100g != null)
      parts.push(`Fat: ${nd.fat_per_100g.toFixed(1)}g/100g`);
    if (nd.sugars_per_100g != null)
      parts.push(`Sugars: ${nd.sugars_per_100g.toFixed(1)}g/100g`);
    if (nd.salt_per_100g != null)
      parts.push(`Salt: ${nd.salt_per_100g.toFixed(1)}g/100g`);
    if (nd.fiber_per_100g != null)
      parts.push(`Fiber: ${nd.fiber_per_100g.toFixed(1)}g/100g`);
    if (nd.ingredients_text)
      parts.push(
        `Ingredients: ${nd.ingredients_text.substring(0, 200)}`,
      );
    return parts.length > 0 ? parts.join("\n") : undefined;
  };

  // Pick up items added from the barcode scanner tab
  useEffect(() => {
    if (pendingItems.length === 0) return;
    const newItems = consumePendingItems();

    // Insert each scanned item into DB, then add to local state with DB id
    newItems.forEach(async (item) => {
      const dbId = await dbInsertItem(item);
      const itemWithDbId = dbId ? { ...item, id: dbId } : item;
      setItems((prev) => [itemWithDbId, ...prev]);
      const nutritionContext = buildNutritionContext(itemWithDbId);
      getHealthSuggestion(itemWithDbId.id, itemWithDbId.name, nutritionContext);
    });
  }, [pendingItems]);

  const addItem = async () => {
    if (inputText.trim() === "") return;

    const newItemName = inputText.trim();

    const newItem: GroceryItem = {
      id: Date.now().toString(), // temporary id
      name: newItemName,
      isEditing: false,
    };

    setInputText("");

    // Insert into DB first to get real id
    const dbId = await dbInsertItem(newItem);
    const itemWithId = dbId ? { ...newItem, id: dbId } : newItem;

    setItems((prevItems) => [itemWithId, ...prevItems]);

    // Return focus to input field after a short delay
    setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
      }
    }, 50);

    // Get health suggestion for the new item
    getHealthSuggestion(itemWithId.id, newItemName);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    dbDeleteItem(id);
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    itemId: string,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity
        style={styles.swipeDeleteContainer}
        onPress={() => deleteItem(itemId)}
        activeOpacity={0.7}
      >
        <Animated.Text style={[styles.swipeDeleteText, { transform: [{ scale }] }]}>
          🗑️
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  const startEditing = (id: string) => {
    const updatedItems = items.map((item) => {
      if (item.id === id) {
        setEditText(item.name);
        return { ...item, isEditing: true };
      }
      return { ...item, isEditing: false };
    });
    setItems(updatedItems);
  };

  const saveEdit = (id: string) => {
    if (editText.trim() === "") return;

    const newName = editText.trim();
    const updatedItems = items.map((item) => {
      if (item.id === id) {
        return { ...item, name: newName, isEditing: false };
      }
      return item;
    });

    setItems(updatedItems);
    setEditText("");
    Keyboard.dismiss();
    // Persist to DB
    dbUpdateItem(id, { name: newName });
  };

  // Get the emoji icon for a food item
  const getFoodEmoji = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("apple")) return "🍎";
    if (lower.includes("banana")) return "🍌";
    if (lower.includes("bread")) return "🍞";
    if (lower.includes("milk")) return "🥛";
    if (lower.includes("egg")) return "🥚";
    if (lower.includes("chicken")) return "🍗";
    if (lower.includes("rice")) return "🍚";
    if (lower.includes("fish") || lower.includes("salmon") || lower.includes("tuna")) return "🐟";
    if (lower.includes("cheese")) return "🧀";
    if (lower.includes("tomato")) return "🍅";
    if (lower.includes("carrot")) return "🥕";
    if (lower.includes("broccoli")) return "🥦";
    if (lower.includes("potato")) return "🥔";
    if (lower.includes("corn")) return "🌽";
    if (lower.includes("pepper")) return "🌶️";
    if (lower.includes("lettuce") || lower.includes("salad")) return "🥬";
    if (lower.includes("avocado")) return "🥑";
    if (lower.includes("orange")) return "🍊";
    if (lower.includes("grape")) return "🍇";
    if (lower.includes("strawberry") || lower.includes("berry")) return "🍓";
    if (lower.includes("watermelon") || lower.includes("melon")) return "🍉";
    if (lower.includes("pineapple")) return "🍍";
    if (lower.includes("lemon")) return "🍋";
    if (lower.includes("peach")) return "🍑";
    if (lower.includes("meat") || lower.includes("beef") || lower.includes("steak")) return "🥩";
    if (lower.includes("pork") || lower.includes("bacon")) return "🥓";
    if (lower.includes("shrimp") || lower.includes("prawn")) return "🦐";
    if (lower.includes("pasta") || lower.includes("spaghetti") || lower.includes("noodle")) return "🍝";
    if (lower.includes("pizza")) return "🍕";
    if (lower.includes("burger")) return "🍔";
    if (lower.includes("sandwich")) return "🥪";
    if (lower.includes("taco")) return "🌮";
    if (lower.includes("soup")) return "🍲";
    if (lower.includes("cookie") || lower.includes("biscuit")) return "🍪";
    if (lower.includes("cake")) return "🎂";
    if (lower.includes("chocolate")) return "🍫";
    if (lower.includes("ice cream")) return "🍦";
    if (lower.includes("coffee")) return "☕";
    if (lower.includes("tea")) return "🍵";
    if (lower.includes("juice") || lower.includes("smoothie")) return "🧃";
    if (lower.includes("water")) return "💧";
    if (lower.includes("wine")) return "🍷";
    if (lower.includes("beer")) return "🍺";
    if (lower.includes("cereal") || lower.includes("oat") || lower.includes("granola")) return "🥣";
    if (lower.includes("yogurt") || lower.includes("yoghurt")) return "🥛";
    if (lower.includes("butter") || lower.includes("oil")) return "🧈";
    if (lower.includes("honey")) return "🍯";
    if (lower.includes("nut") || lower.includes("almond") || lower.includes("walnut") || lower.includes("peanut")) return "🥜";
    if (lower.includes("mushroom")) return "🍄";
    if (lower.includes("onion") || lower.includes("garlic")) return "🧅";
    if (lower.includes("cucumber")) return "🥒";
    if (lower.includes("eggplant") || lower.includes("aubergine")) return "🍆";
    if (lower.includes("bean") || lower.includes("lentil")) return "🫘";
    if (lower.includes("tofu") || lower.includes("soy")) return "🧊";
    if (lower.includes("quinoa") || lower.includes("grain")) return "🌾";
    return "🛒";
  };

  const renderItem = ({ item }: { item: GroceryItem }) => {
    return (
    <Swipeable
      renderRightActions={(progress, dragX) =>
        renderRightActions(progress, dragX, item.id)
      }
      overshootRight={false}
      friction={2}
    >
    <ThemedView style={styles.itemContainer}>
      {item.isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={[styles.editInput, { color: textColor }]}
            value={editText}
            onChangeText={setEditText}
            autoFocus
            blurOnSubmit={false}
            onSubmitEditing={() => saveEdit(item.id)}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => saveEdit(item.id)}
          >
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.itemContentContainer}>
          <View style={styles.itemTopRow}>
            {/* Item image or emoji */}
            <TouchableOpacity
              style={styles.itemImageContainer}
              onPress={() => {
                if (item.imageUrl || item.scannedProductImage) {
                  setZoomedImageUrl(item.imageUrl || item.scannedProductImage || null);
                  setZoomedImageName(item.name);
                }
              }}
              disabled={!item.imageUrl && !item.scannedProductImage}
            >
              {item.imageUrl || item.scannedProductImage ? (
                <Image
                  source={{ uri: item.imageUrl || item.scannedProductImage }}
                  style={styles.itemImage}
                />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Text style={styles.itemImagePlaceholderText}>
                    {getFoodEmoji(item.name)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <ThemedText style={styles.itemText}>{item.name}</ThemedText>
            <TouchableOpacity
              style={styles.editIconButton}
              onPress={() => startEditing(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          {/* Nutrition badges for scanned items */}
          {item.nutritionData && (
            <View style={styles.nutritionBadgeRow}>
              {item.brand && (
                <Text style={styles.brandText}>{item.brand}</Text>
              )}
              <View style={styles.badgeRow}>
                {item.nutritionData.nutriscore_grade && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: getNutriscoreColor(
                          item.nutritionData.nutriscore_grade,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      Nutri-Score{" "}
                      {item.nutritionData.nutriscore_grade.toUpperCase()}
                    </Text>
                  </View>
                )}
                {item.nutritionData.nova_group && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: getNovaGroupColor(
                          item.nutritionData.nova_group,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      NOVA {item.nutritionData.nova_group}
                    </Text>
                  </View>
                )}
                {item.nutritionData.calories_per_100g != null && (
                  <View style={[styles.badge, { backgroundColor: "#666" }]}>
                    <Text style={styles.badgeText}>
                      {Math.round(item.nutritionData.calories_per_100g)} kcal
                    </Text>
                  </View>
                )}
              </View>
              {item.barcode && (
                <Text style={styles.barcodeLabel}>
                  Barcode: {item.barcode}
                </Text>
              )}
            </View>
          )}

          {/* Health suggestion area */}
          {item.isLoadingSuggestion && (
            <View style={[styles.suggestionLoading, isDark && { backgroundColor: '#1e2a30' }]}>
              <ActivityIndicator color={tintColor} />
              <ThemedText style={styles.suggestionLoadingText}>
                Finding healthier alternative...
              </ThemedText>
            </View>
          )}

          {item.showingSuggestion && item.healthSuggestion && (
            <View style={[styles.suggestionContainer, isDark && { backgroundColor: '#1a2a35', borderLeftColor: '#3aad4a' }]}>
              <View style={styles.suggestionContent}>
                <ThemedText style={styles.suggestionTitle}>
                  Healthier Alternative:
                </ThemedText>
                <ThemedText style={styles.suggestionText}>
                  {item.healthSuggestion}
                </ThemedText>
                {item.suggestionReason && (
                  <ThemedText style={[styles.suggestionReason, isDark && { color: '#aab4be' }]}>
                    {item.suggestionReason}
                  </ThemedText>
                )}
                {item.isLoadingSuggestionImage && (
                  <View style={[styles.suggestionImagePlaceholder, isDark && { backgroundColor: '#232d35' }]}>
                    <ActivityIndicator color={tintColor} />
                  </View>
                )}
                {!item.isLoadingSuggestionImage && item.suggestionImageUrl && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setZoomedImageUrl(item.suggestionImageUrl || null);
                      setZoomedImageName(item.healthSuggestion || "Suggestion");
                    }}
                  >
                    <Image
                      source={{ uri: item.suggestionImageUrl }}
                      style={styles.suggestionImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.suggestionButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.suggestionButton,
                    { backgroundColor: "#4CD964" },
                  ]}
                  onPress={() => replaceFoodItem(item.id)}
                >
                  <Text style={styles.buttonText}>✅ Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.suggestionButton,
                    { backgroundColor: "#8E8E93" },
                  ]}
                  onPress={() => dismissSuggestion(item.id)}
                >
                  <Text style={styles.buttonText}>❌ Keep</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </ThemedView>
    </Swipeable>
  );
  };

  // Focus the input field when component mounts
  const [inputRef, setInputRef] = useState<TextInput | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [inputRef]);

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

      <ThemedText type="title" style={styles.headerTitle}>
        AteWell.AI 🍽️💡
      </ThemedText>

      {isLoadingItems ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={{ marginTop: 10 }}>Loading your list...</ThemedText>
        </View>
      ) : (
      <>
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={(ref) => setInputRef(ref)}
            style={[styles.input, { color: textColor }]}
            placeholder="Add Item"
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoFocus={true}
            blurOnSubmit={false}
            onSubmitEditing={addItem}
            returnKeyType="done"
            enablesReturnKeyAutomatically={true}
          />
          {!inputText && (
            <TouchableOpacity
              style={styles.inlineScanButton}
              onPress={() => router.push("/(tabs)/scan")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="barcode.viewfinder" size={28} color={tintColor} />
              <Text style={[styles.inlineScanLabel, { color: tintColor }]}>Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.listContainer}>
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          removeClippedSubviews
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                await loadItems();
                setIsRefreshing(false);
              }}
              tintColor={tintColor}
            />
          }
          ListEmptyComponent={
            <ThemedText style={styles.emptyListText}>
              Your grocery list is empty. Add some items!
            </ThemedText>
          }
        />
      </View>

      {/* Zoomed Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={zoomedImageUrl !== null}
        onRequestClose={() => setZoomedImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.zoomModalOverlay}
          activeOpacity={1}
          onPress={() => setZoomedImageUrl(null)}
        >
          <View style={styles.zoomModalContent}>
            <Text style={styles.zoomModalTitle}>{zoomedImageName}</Text>
            {zoomedImageUrl && (
              <Image
                source={{ uri: zoomedImageUrl }}
                style={styles.zoomedImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={() => setZoomedImageUrl(null)}
            >
              <Text style={styles.zoomCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "transparent",
  },
  spacer: {
    height: 40,
  },
  title: {
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    height: 50,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
  },
  inlineScanButton: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineScanLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  listContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: "column",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  itemContentContainer: {
    flex: 1,
    width: "100%",
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
  },
  itemImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  itemImagePlaceholderText: {
    fontSize: 24,
  },
  buttonContainer: {
    flexDirection: "row",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  editIconButton: {
    padding: 6,
    marginLeft: 8,
  },
  editIcon: {
    fontSize: 20,
  },
  swipeDeleteContainer: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    marginVertical: 6,
  },
  swipeDeleteText: {
    fontSize: 28,
    color: "white",
  },
  editContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  editInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  emptyListText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    color: "#888",
  },
  suggestionLoading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
  },
  suggestionLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontStyle: "italic",
  },
  suggestionContainer: {
    marginTop: 10,
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#4CD964",
  },
  suggestionContent: {
    marginBottom: 8,
  },
  suggestionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    marginTop: 2,
  },
  suggestionButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  suggestionButton: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    marginHorizontal: 4,
  },
  suggestionImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginTop: 8,
  },
  suggestionImagePlaceholder: {
    height: 160,
    borderRadius: 8,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8ecf2",
  },
  headerTitle: {
    marginTop: 10,
    marginBottom: 15,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: "#2089dc",
  },
  zoomModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomModalContent: {
    width: "90%",
    maxHeight: "80%",
    alignItems: "center",
  },
  zoomModalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  zoomedImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
  },
  zoomCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
  },
  zoomCloseButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  nutritionBadgeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  brandText: {
    fontSize: 13,
    color: "#888",
    marginBottom: 6,
    fontStyle: "italic",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  barcodeLabel: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 6,
  },
});
