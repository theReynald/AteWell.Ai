import { API_BASE_URL, SUPABASE_ANON_KEY } from "@/constants/Api";
import { useGrocery } from "@/contexts/GroceryContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { GroceryItem } from "@/types/grocery";
import {
    getNovaGroupColor,
    getNovaGroupLabel,
    getNutriscoreColor,
} from "@/utils/openFoodFacts";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const { pendingItems, consumePendingItems } = useGrocery();
  const [inputText, setInputText] = useState("");
  const [editText, setEditText] = useState("");
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [zoomedImageName, setZoomedImageName] = useState<string>("");

  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  // Function to get health suggestion from backend proxy
  const getHealthSuggestion = async (
    itemId: string,
    itemName: string,
    nutritionInfo?: string,
  ) => {
    // Mark item as loading suggestion
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, isLoadingSuggestion: true } : item,
      ),
    );

    try {
      // Dev: localhost:3000/api/health-suggestion
      // Prod: <supabase>/functions/v1/health-suggestion
      const endpoint = __DEV__
        ? `${API_BASE_URL}/api/health-suggestion`
        : `${API_BASE_URL}/health-suggestion`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Supabase Edge Functions require the anon key in production
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

      const data = await response.json();

      if (data.healthSuggestion) {
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  healthSuggestion: data.healthSuggestion,
                  suggestionReason: data.suggestionReason || "",
                  showingSuggestion: true,
                  isLoadingSuggestion: false,
                }
              : item,
          ),
        );
      }
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
            };
          }
          return i;
        }),
      );
    }
  };

  // Function to dismiss suggestion
  const dismissSuggestion = (id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, showingSuggestion: false } : item,
      ),
    );
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
    setItems((prev) => [...prev, ...newItems]);
    // Trigger health suggestions for scanned items
    newItems.forEach((item) => {
      const nutritionContext = buildNutritionContext(item);
      getHealthSuggestion(item.id, item.name, nutritionContext);
    });
  }, [pendingItems]);

  const addItem = () => {
    if (inputText.trim() === "") return;

    const newItemId = Date.now().toString();
    const newItemName = inputText.trim();

    const newItem: GroceryItem = {
      id: newItemId,
      name: newItemName,
      isEditing: false,
    };

    setItems((prevItems) => [...prevItems, newItem]);
    setInputText("");

    // Return focus to input field after a short delay
    setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
      }
    }, 50);

    // Get health suggestion for the new item
    getHealthSuggestion(newItemId, newItemName);
  };

  const deleteItem = (id: string) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setItems(items.filter((item) => item.id !== id));
        },
      },
    ]);
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

    const updatedItems = items.map((item) => {
      if (item.id === id) {
        return { ...item, name: editText.trim(), isEditing: false };
      }
      return item;
    });

    setItems(updatedItems);
    setEditText("");
    Keyboard.dismiss();
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

  const renderItem = ({ item }: { item: GroceryItem }) => (
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
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: tintColor }]}
                onPress={() => startEditing(item.id)}
              >
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() => deleteItem(item.id)}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
            <View style={styles.suggestionLoading}>
              <ActivityIndicator color={tintColor} />
              <ThemedText style={styles.suggestionLoadingText}>
                Finding healthier alternative...
              </ThemedText>
            </View>
          )}

          {item.showingSuggestion && item.healthSuggestion && (
            <View style={styles.suggestionContainer}>
              <View style={styles.suggestionContent}>
                <ThemedText style={styles.suggestionTitle}>
                  Healthier Alternative:
                </ThemedText>
                <ThemedText style={styles.suggestionText}>
                  {item.healthSuggestion}
                </ThemedText>
                {item.suggestionReason && (
                  <ThemedText style={styles.suggestionReason}>
                    {item.suggestionReason}
                  </ThemedText>
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
  );

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

      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.headerTitle}>
          AteWell.AI 🍽️💡
        </ThemedText>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          ref={(ref) => setInputRef(ref)}
          style={[styles.input, { color: textColor }]}
          placeholder="Add an item..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          autoFocus={true}
          blurOnSubmit={false}
          onSubmitEditing={addItem}
          returnKeyType="done"
          enablesReturnKeyAutomatically={true}
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: tintColor }]}
          onPress={addItem}
        >
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.listContainer}>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <ThemedText style={styles.emptyListText}>
                Your grocery list is empty. Add some items!
              </ThemedText>
            }
          />
        </View>
      </TouchableWithoutFeedback>

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
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  addButton: {
    width: 80,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
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
  deleteButton: {
    backgroundColor: "#FF3B30",
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
  headerTitle: {
    marginTop: 10,
    marginBottom: 15,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: "#2089dc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
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
