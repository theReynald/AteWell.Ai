import { useGrocery } from "@/contexts/GroceryContext";
import { GroceryItem } from "@/types/grocery";
import {
    getNovaGroupColor,
    getNovaGroupLabel,
    getNutriscoreColor,
    getNutriscoreLabel,
    lookupBarcode,
    ProductLookupResult,
} from "@/utils/openFoodFacts";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<ProductLookupResult | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string>("");
  const { addScannedItem } = useGrocery();
  const scanLockRef = useRef(false);

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    // Prevent multiple scans
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanned(true);
    setScannedBarcode(data);
    setIsLoading(true);

    const result = await lookupBarcode(data);
    setProduct(result);
    setIsLoading(false);
  };

  const handleAddToList = () => {
    if (!product?.found || !product.name) return;

    const newItem: GroceryItem = {
      id: Date.now().toString(),
      name: product.name,
      isEditing: false,
      barcode: scannedBarcode,
      brand: product.brand,
      imageUrl: product.imageUrl,
      scannedProductImage: product.imageUrl,
      nutritionData: product.nutritionData,
    };

    addScannedItem(newItem);

    Alert.alert(
      "Added!",
      `${product.name} has been added to your grocery list.`,
      [{ text: "OK" }],
    );

    // Reset for next scan
    resetScanner();
  };

  const resetScanner = () => {
    setScanned(false);
    setProduct(null);
    setScannedBarcode("");
    scanLockRef.current = false;
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <LinearGradient
        colors={["#ffffff", "#e6f0ff", "#99c2ff", "#3366cc", "#001f3f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.container}
      >
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </LinearGradient>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <LinearGradient
        colors={["#ffffff", "#e6f0ff", "#99c2ff", "#3366cc", "#001f3f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.container}
      >
        <View style={styles.centeredContent}>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan barcodes on your grocery items.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#ffffff", "#e6f0ff", "#99c2ff", "#3366cc", "#001f3f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan Barcode 📷</Text>
        <Text style={styles.headerSubtitle}>
          Point your camera at a product barcode
        </Text>
      </View>

      {!scanned ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
                "code93",
              ],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <Text style={styles.scanHint}>
                Align barcode within the frame
              </Text>
            </View>
          </CameraView>
        </View>
      ) : (
        <ScrollView
          style={styles.resultContainer}
          contentContainerStyle={styles.resultContent}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Looking up product...</Text>
              <Text style={styles.barcodeText}>Barcode: {scannedBarcode}</Text>
            </View>
          ) : product?.found ? (
            <View style={styles.productCard}>
              {/* Product Image */}
              {product.imageUrl && (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              )}

              {/* Product Name & Brand */}
              <Text style={styles.productName}>{product.name}</Text>
              {product.brand && (
                <Text style={styles.productBrand}>{product.brand}</Text>
              )}

              {/* Nutri-Score */}
              {product.nutritionData?.nutriscore_grade && (
                <View style={styles.scoreRow}>
                  <View
                    style={[
                      styles.scoreBadge,
                      {
                        backgroundColor: getNutriscoreColor(
                          product.nutritionData.nutriscore_grade,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.scoreBadgeText}>
                      Nutri-Score{" "}
                      {product.nutritionData.nutriscore_grade.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.scoreLabel}>
                    {getNutriscoreLabel(
                      product.nutritionData.nutriscore_grade,
                    )}
                  </Text>
                </View>
              )}

              {/* NOVA Group */}
              {product.nutritionData?.nova_group && (
                <View style={styles.scoreRow}>
                  <View
                    style={[
                      styles.scoreBadge,
                      {
                        backgroundColor: getNovaGroupColor(
                          product.nutritionData.nova_group,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.scoreBadgeText}>
                      NOVA {product.nutritionData.nova_group}
                    </Text>
                  </View>
                  <Text style={styles.scoreLabel}>
                    {getNovaGroupLabel(product.nutritionData.nova_group)}
                  </Text>
                </View>
              )}

              {/* Nutrition Facts */}
              {(product.nutritionData?.calories_per_100g != null ||
                product.nutritionData?.proteins_per_100g != null) && (
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionTitle}>
                    Nutrition per 100g
                  </Text>
                  <View style={styles.nutritionGrid}>
                    {product.nutritionData.calories_per_100g != null && (
                      <NutritionItem
                        label="Calories"
                        value={`${Math.round(product.nutritionData.calories_per_100g)} kcal`}
                      />
                    )}
                    {product.nutritionData.proteins_per_100g != null && (
                      <NutritionItem
                        label="Protein"
                        value={`${product.nutritionData.proteins_per_100g.toFixed(1)}g`}
                      />
                    )}
                    {product.nutritionData.fat_per_100g != null && (
                      <NutritionItem
                        label="Fat"
                        value={`${product.nutritionData.fat_per_100g.toFixed(1)}g`}
                      />
                    )}
                    {product.nutritionData.sugars_per_100g != null && (
                      <NutritionItem
                        label="Sugars"
                        value={`${product.nutritionData.sugars_per_100g.toFixed(1)}g`}
                      />
                    )}
                    {product.nutritionData.fiber_per_100g != null && (
                      <NutritionItem
                        label="Fiber"
                        value={`${product.nutritionData.fiber_per_100g.toFixed(1)}g`}
                      />
                    )}
                    {product.nutritionData.salt_per_100g != null && (
                      <NutritionItem
                        label="Salt"
                        value={`${product.nutritionData.salt_per_100g.toFixed(1)}g`}
                      />
                    )}
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.addToListButton}
                  onPress={handleAddToList}
                >
                  <Text style={styles.addToListButtonText}>
                    + Add to Grocery List
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={resetScanner}
                >
                  <Text style={styles.scanAgainButtonText}>
                    Scan Another Item
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.notFoundContainer}>
              <Text style={styles.notFoundEmoji}>🔍</Text>
              <Text style={styles.notFoundTitle}>Product Not Found</Text>
              <Text style={styles.notFoundText}>
                Barcode: {scannedBarcode}
              </Text>
              <Text style={styles.notFoundSubtext}>
                This product isn't in the Open Food Facts database yet.
              </Text>
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={resetScanner}
              >
                <Text style={styles.scanAgainButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

function NutritionItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutritionItem}>
      <Text style={styles.nutritionLabel}>{label}</Text>
      <Text style={styles.nutritionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2089dc",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  // Camera
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scanFrame: {
    width: 280,
    height: 160,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#00FF88",
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHint: {
    color: "white",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
    fontWeight: "500",
  },
  // Permission
  permissionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
  // Results
  resultContainer: {
    flex: 1,
  },
  resultContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 18,
    color: "#333",
    marginTop: 15,
    fontWeight: "600",
  },
  barcodeText: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
  // Product Card
  productCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
  },
  productName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  productBrand: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  // Scores
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  scoreBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  scoreBadgeText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  scoreLabel: {
    marginLeft: 12,
    fontSize: 15,
    color: "#555",
    fontWeight: "500",
  },
  // Nutrition
  nutritionCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  nutritionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  nutritionItem: {
    width: "50%",
    paddingVertical: 6,
  },
  nutritionLabel: {
    fontSize: 13,
    color: "#888",
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  // Actions
  actionButtons: {
    marginTop: 20,
    gap: 12,
  },
  addToListButton: {
    backgroundColor: "#4CD964",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addToListButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  scanAgainButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  scanAgainButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Not Found
  notFoundContainer: {
    alignItems: "center",
    paddingTop: 40,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 30,
  },
  notFoundEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 14,
    color: "#888",
    marginBottom: 4,
  },
  notFoundSubtext: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
});
