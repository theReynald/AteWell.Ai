import { GroceryItem } from "@/types/grocery";
import React, { createContext, useCallback, useContext, useState } from "react";

type GroceryContextType = {
  /** Items added from the barcode scanner, waiting to be picked up by GroceryList */
  pendingItems: GroceryItem[];
  /** Called by scanner to queue an item */
  addScannedItem: (item: GroceryItem) => void;
  /** Called by GroceryList to consume pending items */
  consumePendingItems: () => GroceryItem[];
};

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

export function GroceryProvider({ children }: { children: React.ReactNode }) {
  const [pendingItems, setPendingItems] = useState<GroceryItem[]>([]);

  const addScannedItem = useCallback((item: GroceryItem) => {
    setPendingItems((prev) => [...prev, item]);
  }, []);

  const consumePendingItems = useCallback(() => {
    const items = pendingItems;
    if (items.length > 0) {
      setPendingItems([]);
    }
    return items;
  }, [pendingItems]);

  return (
    <GroceryContext.Provider value={{ pendingItems, addScannedItem, consumePendingItems }}>
      {children}
    </GroceryContext.Provider>
  );
}

export function useGrocery() {
  const context = useContext(GroceryContext);
  if (!context) {
    throw new Error("useGrocery must be used within a GroceryProvider");
  }
  return context;
}
