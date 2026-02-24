"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
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

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loadingSuggestion, setLoadingSuggestion] = useState<Record<string, boolean>>({});
  const [loadingImage, setLoadingImage] = useState<Record<string, boolean>>({});
  const [backfilling, setBackfilling] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomName, setZoomName] = useState<string>("");
  const [suggestionAttempts, setSuggestionAttempts] = useState<Record<string, number>>({});
  const [suggestionImages, setSuggestionImages] = useState<Record<string, string | null>>({});
  const [loadingSuggestionImage, setLoadingSuggestionImage] = useState<Record<string, boolean>>({});

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
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Could not load items:", error.message);
          setItems([]);
        } else {
          setItems((data ?? []).map(rowToItem));
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
      let itemToAdd = rowToItem(data);
      const imageUrl = await fetchPexelsImage(itemToAdd.name, itemToAdd.id);
      if (imageUrl) {
        itemToAdd = { ...itemToAdd, image_url: imageUrl };
        await supabase
          .from("grocery_items")
          .update({ image_url: imageUrl })
          .eq("id", itemToAdd.id);
      }
      setItems((prev) => [...prev, itemToAdd]);
      setItemName("");
      await getHealthSuggestion(itemToAdd, { incrementAttempt: true });
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

  const fetchPexelsImage = async (name: string, id: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoadingImage((prev) => ({ ...prev, [id]: true }));
    }
    try {
      const res = await fetch("/api/pexels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.imageUrl ?? null;
    } catch {
      return null;
    } finally {
      if (!silent) {
        setLoadingImage((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  const getHealthSuggestion = async (item: GroceryItem, opts?: { incrementAttempt?: boolean }) => {
    const shouldIncrement = opts?.incrementAttempt ?? false;
    const currentAttempts = suggestionAttempts[item.id] ?? 0;
    if (shouldIncrement && currentAttempts >= 5) return;
    if (shouldIncrement) {
      setSuggestionAttempts((prev) => ({ ...prev, [item.id]: currentAttempts + 1 }));
    }
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

        setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: true }));
        const suggestedImage = await fetchPexelsImage(data.healthSuggestion, item.id, { silent: true });
        setSuggestionImages((prev) => ({ ...prev, [item.id]: suggestedImage }));
        setLoadingSuggestionImage((prev) => ({ ...prev, [item.id]: false }));

        await supabase
          .from("grocery_items")
          .update({
            health_suggestion: data.healthSuggestion,
            suggestion_reason: data.suggestionReason || "",
          })
          .eq("id", item.id);
      }
    } catch (err: any) {
      console.warn("Health suggestion failed:", err.message);
    } finally {
      setLoadingSuggestion((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const requestAnotherSuggestion = async (item: GroceryItem) => {
    await getHealthSuggestion(item, { incrementAttempt: true });
  };

  const replaceWithSuggestion = async (item: GroceryItem) => {
    if (!item.health_suggestion) return;
    const newName = item.health_suggestion
      .replace(/\*\*/g, "")
      .replace(/[#*_~`>]/g, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim()
      .split("\n")[0];

    const suggestedImage = suggestionImages[item.id] ?? null;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              name: newName,
              image_url: suggestedImage || i.image_url,
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
        image_url: suggestedImage || null,
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

  const backfillImages = async () => {
    if (backfilling) return;
    setBackfilling(true);
    const targets = items.filter((i) => !i.image_url && !i.scanned_product_image);
    for (const item of targets) {
      const url = await fetchPexelsImage(item.name, item.id);
      if (url) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, image_url: url } : i)));
        await supabase.from("grocery_items").update({ image_url: url }).eq("id", item.id);
      }
    }
    setBackfilling(false);
  };

  if (!session) {
    return (
      <main>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1>AteWell Web</h1>
              <p className="lead">Sign in to add items from the web and keep them in sync with mobile.</p>
            </div>
            <span className="badge">Beta</span>
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
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "linear-gradient(135deg, #1e90ff, #38bdf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 22,
                boxShadow: "0 10px 30px rgba(30,144,255,0.25)",
              }}
            >
              🍽️
            </div>
            <div>
              <h1 style={{ margin: 0 }}>AteWell.AI</h1>
              <p className="lead" style={{ margin: 0 }}>Add items here and they appear on mobile.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge">Signed in</span>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section">
          <h2 style={{ margin: 0 }}>Add item</h2>
          <p className="lead" style={{ marginBottom: 12 }}>Items save directly to the grocery_items table.</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              placeholder="e.g. Spinach"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button className="primary" onClick={addItem} disabled={saving}>
              {saving ? "Saving..." : "Add"}
            </button>
          </div>
        </div>

        <div className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Your items</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {loading && <span style={{ color: "#475569" }}>Loading...</span>}
              {items.length > 0 && (
                <button className="secondary" onClick={backfillImages} disabled={backfilling}>
                  {backfilling ? "Backfilling..." : "Backfill images"}
                </button>
              )}
            </div>
          </div>
          {items.length === 0 && !loading ? (
            <p style={{ color: "#475569" }}>No items yet. Add your first item to sync it to mobile.</p>
          ) : (
            <div className="list">
              {items.map((item) => (
                <div key={item.id} className="list-item">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        background: "#e2e8f0",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.image_url || item.scanned_product_image ? (
                        <img
                          src={item.image_url || item.scanned_product_image || ""}
                          alt={item.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                          onClick={() => {
                            const hiRes = item.scanned_product_image || item.image_url;
                            setZoomUrl(hiRes || null);
                            setZoomName(item.name);
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 26 }}>{getFoodEmoji(item.name)}</span>
                      )}
                    </div>
                    <div>
                      {editingId === item.id ? (
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
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            minWidth: 180,
                          }}
                        />
                      ) : (
                        <div style={{ fontWeight: 700 }}>{item.name}</div>
                      )}
                      {item.brand && (
                        <div style={{ color: "#475569", fontSize: 14 }}>Brand: {item.brand}</div>
                      )}
                      {loadingSuggestion[item.id] && (
                        <div style={{ color: "#0ea5e9", fontSize: 13, marginTop: 4 }}>Finding healthier option...</div>
                      )}
                      {loadingSuggestionImage[item.id] && (
                        <div style={{ color: "#0ea5e9", fontSize: 13, marginTop: 4 }}>Fetching suggestion image...</div>
                      )}
                      {loadingImage[item.id] && (
                        <div style={{ color: "#0ea5e9", fontSize: 13, marginTop: 4 }}>Fetching image...</div>
                      )}
                      {item.health_suggestion && (
                        <div
                          style={{
                            marginTop: 8,
                            background: "#f0f8ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 12,
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Healthier alternative</div>
                          {suggestionImages[item.id] && (
                            <img
                              src={suggestionImages[item.id] || ""}
                              alt={item.health_suggestion || "alternative"}
                              style={{
                                width: "100%",
                                maxHeight: 200,
                                objectFit: "cover",
                                borderRadius: 10,
                                marginBottom: 8,
                              }}
                            />
                          )}
                          <div style={{ fontSize: 14, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                            {item.health_suggestion}
                          </div>
                          {item.suggestion_reason && (
                            <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>
                              {item.suggestion_reason}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button className="primary" onClick={() => replaceWithSuggestion(item)}>Use this</button>
                            <button className="secondary" onClick={() => dismissSuggestion(item.id)}>Keep original</button>
                            <button
                              className="secondary"
                              onClick={() => requestAnotherSuggestion(item)}
                              disabled={(suggestionAttempts[item.id] ?? 0) >= 5}
                            >
                              {`Try another (${Math.min(suggestionAttempts[item.id] ?? 0, 5)}/5)`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editingId === item.id ? (
                      <>
                        <button className="primary" onClick={() => saveEdit(item.id)}>Save</button>
                        <button className="secondary" onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="secondary" onClick={() => startEditing(item.id, item.name)}>
                          Edit
                        </button>
                        <button className="secondary" onClick={() => deleteItem(item.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
