"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { GroceryItem } from "../types/grocery";

const supabase = getSupabaseClient();
const isDev = process.env.NODE_ENV === "development";
const API_BASE_URL = process.env.NEXT_PUBLIC_HEALTH_API_BASE
  ?? (isDev ? "http://localhost:3000" : "https://lkbfscxbeojdvhttcxvj.supabase.co/functions/v1");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const rowToItem = (row: any): GroceryItem => ({
  id: row.id,
  name: row.name,
  barcode: row.barcode,
  brand: row.brand,
  image_url: row.image_url,
  scanned_product_image: row.scanned_product_image,
  nutrition_data: row.nutrition_data,
  health_suggestion: row.health_suggestion,
  suggestion_reason: row.suggestion_reason,
  created_at: row.created_at,
});

const getFoodEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes("apple")) return "🍎";
  if (lower.includes("banana")) return "🍌";
  if (lower.includes("bread")) return "🍞";
  if (lower.includes("milk")) return "🥛";
  if (lower.includes("egg")) return "🥚";
  if (lower.includes("chicken")) return "🍗";
  if (lower.includes("rice")) return "🍚";
  if (lower.includes("fish")) return "🐟";
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
  if (lower.includes("berry")) return "🍓";
  if (lower.includes("watermelon") || lower.includes("melon")) return "🍉";
  if (lower.includes("pineapple")) return "🍍";
  if (lower.includes("lemon")) return "🍋";
  if (lower.includes("meat") || lower.includes("beef") || lower.includes("steak")) return "🥩";
  if (lower.includes("pork") || lower.includes("bacon")) return "🥓";
  if (lower.includes("shrimp") || lower.includes("prawn")) return "🦐";
  if (lower.includes("pasta") || lower.includes("noodle")) return "🍝";
  if (lower.includes("pizza")) return "🍕";
  if (lower.includes("burger")) return "🍔";
  if (lower.includes("sandwich")) return "🥪";
  if (lower.includes("taco")) return "🌮";
  if (lower.includes("soup")) return "🍲";
  if (lower.includes("cookie")) return "🍪";
  if (lower.includes("cake")) return "🎂";
  if (lower.includes("chocolate")) return "🍫";
  if (lower.includes("ice cream")) return "🍦";
  if (lower.includes("coffee")) return "☕";
  if (lower.includes("tea")) return "🍵";
  if (lower.includes("juice")) return "🧃";
  return "🛒";
};

/* ─── Swipeable list item ─── */
function SwipeableItem({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const swipingRef = useRef(false);
  const DELETE_THRESHOLD = 100;

  const handleStart = (clientX: number) => {
    startXRef.current = clientX;
    currentXRef.current = 0;
    swipingRef.current = true;
    if (containerRef.current) {
      containerRef.current.style.transition = "none";
    }
  };

  const handleMove = (clientX: number) => {
    if (!swipingRef.current) return;
    const diff = clientX - startXRef.current;
    // Only allow swiping left
    currentXRef.current = Math.min(0, diff);
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${currentXRef.current}px)`;
    }
  };

  const handleEnd = () => {
    swipingRef.current = false;
    if (!containerRef.current) return;
    containerRef.current.style.transition = "transform 0.25s ease";
    if (currentXRef.current < -DELETE_THRESHOLD) {
      containerRef.current.style.transform = "translateX(-100%)";
      setTimeout(onDelete, 250);
    } else {
      containerRef.current.style.transform = "translateX(0)";
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12 }}>
      {/* Red delete background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#FF3B30",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 24,
          borderRadius: 12,
          color: "white",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        🗑️ Delete
      </div>
      <div
        ref={containerRef}
        style={{ position: "relative", zIndex: 1 }}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loadingSuggestion, setLoadingSuggestion] = useState<Record<string, boolean>>({});
  const [suggestionImages, setSuggestionImages] = useState<Record<string, string | null>>({});
  const [loadingSuggestionImage, setLoadingSuggestionImage] = useState<Record<string, boolean>>({});
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomName, setZoomName] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session ?? null))
      .catch(() => setSession(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const loadItems = useMemo(
    () =>
      async (currentUserId: string) => {
        setLoading(true);
        const { data, error } = await supabase
          .from("grocery_items")
          .select("*")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Could not load items:", error.message);
          setItems([]);
        } else {
          const mapped = (data ?? []).map(rowToItem);
          setItems(mapped);
          // Fetch Pexels images for items that already have suggestions
          mapped.forEach(async (item) => {
            if (item.health_suggestion) {
              setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: true }));
              const img = await fetchPexelsImage(item.health_suggestion);
              setSuggestionImages((prev) => ({ ...prev, [item.id]: img }));
              setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: false }));
            }
          });
        }
        setLoading(false);
      },
    [],
  );

  useEffect(() => {
    if (userId) {
      loadItems(userId);
    } else {
      setItems([]);
    }
  }, [userId, loadItems]);

  const addItem = async () => {
    if (!userId) return;
    const name = itemName.trim();
    if (!name) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("grocery_items")
      .insert({ user_id: userId, name })
      .select("*")
      .single();

    if (error) {
      console.error("Error adding item:", error.message);
    } else if (data) {
      const itemToAdd = rowToItem(data);
      setItems((prev) => [itemToAdd, ...prev]);
      setItemName("");
      // Fetch Pexels thumbnail for the item
      fetchPexelsImage(name).then(async (imgUrl) => {
        if (imgUrl) {
          setItems((prev) =>
            prev.map((i) => (i.id === itemToAdd.id ? { ...i, image_url: imgUrl } : i)),
          );
          await supabase
            .from("grocery_items")
            .update({ image_url: imgUrl })
            .eq("id", itemToAdd.id);
        }
      });
      await getHealthSuggestion(itemToAdd);
    }
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await supabase.from("grocery_items").delete().eq("id", id);
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditText(currentName);
  };

  const saveEdit = async (id: string) => {
    const newName = editText.trim();
    if (!newName) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name: newName } : item)));
    setEditingId(null);
    setEditText("");
    await supabase.from("grocery_items").update({ name: newName }).eq("id", id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const fetchPexelsImage = async (query: string): Promise<string | null> => {
    try {
      const queries = [query, `${query} food`];
      for (const q of queries) {
        const res = await fetch("/api/pexels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.imageUrl) return data.imageUrl;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getHealthSuggestion = async (item: GroceryItem) => {
    setLoadingSuggestion((prev) => ({ ...prev, [item.id]: true }));
    try {
      const endpoint = isDev ? `${API_BASE_URL}/api/health-suggestion` : `${API_BASE_URL}/health-suggestion`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!isDev && SUPABASE_ANON_KEY) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ itemName: item.name }),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      if (data.healthSuggestion) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  health_suggestion: data.healthSuggestion,
                  suggestion_reason: data.suggestionReason || "",
                }
              : i,
          ),
        );

        await supabase
          .from("grocery_items")
          .update({
            health_suggestion: data.healthSuggestion,
            suggestion_reason: data.suggestionReason || "",
          })
          .eq("id", item.id);

        // Fetch Pexels image for the suggestion
        setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: true }));
        const sugImg = await fetchPexelsImage(data.healthSuggestion);
        setSuggestionImages((prev) => ({ ...prev, [item.id]: sugImg }));
        setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: false }));
      }
    } catch (err: any) {
      console.warn("Health suggestion failed:", err.message);
    } finally {
      setLoadingSuggestion((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const replaceWithSuggestion = async (item: GroceryItem) => {
    if (!item.health_suggestion) return;
    const newName = item.health_suggestion
      .replace(/\*\*/g, "")
      .replace(/[#*_~`>]/g, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim()
      .split("\n")[0];

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              name: newName,
              health_suggestion: null,
              suggestion_reason: null,
            }
          : i,
      ),
    );

    await supabase
      .from("grocery_items")
      .update({
        name: newName,
        health_suggestion: null,
        suggestion_reason: null,
      })
      .eq("id", item.id);
  };

  const dismissSuggestion = async (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, health_suggestion: null, suggestion_reason: null } : i,
      ),
    );
    setSuggestionImages((prev) => ({ ...prev, [id]: null }));
    await supabase
      .from("grocery_items")
      .update({ health_suggestion: null, suggestion_reason: null })
      .eq("id", id);
  };

  const handleAuth = async () => {
    setAuthError(null);
    if (!email || !password) {
      setAuthError("Email and password are required");
      return;
    }

    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setItems([]);
  };

  if (!session) {
    return (
      <main>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1>AteWell.AI 🍽️💡</h1>
              <p className="lead">Sign in to manage your grocery list.</p>
            </div>
          </div>
          <div className="section">
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <button
                className={authMode === "signin" ? "primary" : "secondary"}
                onClick={() => setAuthMode("signin")}
              >
                Sign in
              </button>
              <button
                className={authMode === "signup" ? "primary" : "secondary"}
                onClick={() => setAuthMode("signup")}
              >
                Create account
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth();
              }}
            >
              <div>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {authError && (
                <div style={{ color: "#b91c1c", fontWeight: 600 }}>{authError}</div>
              )}
              <button className="primary" type="submit">
                {authMode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, color: "#2089dc" }}>AteWell.AI 🍽️💡</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Add Item"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <div className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Your items</h2>
            {loading && <span style={{ color: "#475569" }}>Loading...</span>}
          </div>
          {items.length === 0 && !loading ? (
            <p style={{ color: "#475569" }}>No items yet. Add your first item above.</p>
          ) : (
            <div className="list">
              {items.map((item) => (
                <SwipeableItem key={item.id} onDelete={() => deleteItem(item.id)}>
                  <div className="list-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: "#e2e8f0",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 22,
                          cursor: item.image_url || item.scanned_product_image ? "pointer" : "default",
                        }}
                        onClick={() => {
                          const url = item.scanned_product_image || item.image_url;
                          if (url) {
                            setZoomUrl(url);
                            setZoomName(item.name);
                          }
                        }}
                      >
                        {item.image_url || item.scanned_product_image ? (
                          <img
                            src={item.image_url || item.scanned_product_image || ""}
                            alt={item.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          getFoodEmoji(item.name)
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingId === item.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveEdit(item.id);
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 15,
                                flex: 1,
                              }}
                            />
                            <button className="primary" style={{ padding: "6px 14px", fontSize: 14 }} onClick={() => saveEdit(item.id)}>Save</button>
                            <button className="secondary" style={{ padding: "6px 14px", fontSize: 14 }} onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700 }}>{item.name}</span>
                        )}
                        {item.brand && (
                          <div style={{ color: "#475569", fontSize: 13 }}>Brand: {item.brand}</div>
                        )}
                        {loadingSuggestion[item.id] && (
                          <div style={{ color: "#0ea5e9", fontSize: 13, marginTop: 4 }}>Finding healthier alternative...</div>
                        )}
                        {loadingSuggestionImage[item.id] && (
                          <div style={{ color: "#0ea5e9", fontSize: 13, marginTop: 4 }}>Loading suggestion image...</div>
                        )}
                        {item.health_suggestion && (
                          <div
                            style={{
                              marginTop: 8,
                              background: "#f0f8ff",
                              borderLeft: "3px solid #4CD964",
                              borderRadius: 8,
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 13 }}>Healthier Alternative:</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                              {item.health_suggestion}
                            </div>
                            {suggestionImages[item.id] && (
                              <img
                                src={suggestionImages[item.id]!}
                                alt={item.health_suggestion || "suggestion"}
                                style={{
                                  width: "100%",
                                  maxHeight: 180,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  marginTop: 8,
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setZoomUrl(suggestionImages[item.id] || null);
                                  setZoomName(item.health_suggestion || "Suggestion");
                                }}
                              />
                            )}
                            {item.suggestion_reason && (
                              <div style={{ marginTop: 4, color: "#666", fontSize: 13, fontStyle: "italic" }}>
                                {item.suggestion_reason}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button
                                className="primary"
                                style={{ padding: "8px 16px", fontSize: 14 }}
                                onClick={() => replaceWithSuggestion(item)}
                              >
                                ✅ Replace
                              </button>
                              <button
                                className="secondary"
                                style={{ padding: "8px 16px", fontSize: 14 }}
                                onClick={() => dismissSuggestion(item.id)}
                              >
                                ❌ Keep
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingId !== item.id && (
                      <button
                        onClick={() => startEditing(item.id, item.name)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: 1,
                          flexShrink: 0,
                          marginLeft: "auto",
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </SwipeableItem>
              ))}
            </div>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", color: "#bbb", fontSize: 13, marginTop: 24 }}>
        ← Swipe items left to delete
      </p>

      {zoomUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onClick={() => setZoomUrl(null)}
        >
          <div
            style={{
              background: "#0f172a",
              borderRadius: 16,
              padding: 16,
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 16 }}>{zoomName}</div>
            <img
              src={zoomUrl}
              alt={zoomName}
              style={{
                maxWidth: "85vw",
                maxHeight: "75vh",
                borderRadius: 12,
                objectFit: "contain",
                background: "#0b1220",
              }}
            />
            <button className="secondary" onClick={() => setZoomUrl(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
