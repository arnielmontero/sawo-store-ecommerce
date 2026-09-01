"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isRenderableImageUrl } from "@/lib/format";

export interface CartItem {
  variantId: number;
  productSlug: string;
  productTitle: string;
  variantLabel: string | null;
  imageUrl: string | null;
  priceCents: number;
  quantity: number;
  availableStock: number;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  subtotalCents: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "sawo-webshop-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Loads any cart saved on a previous visit. Wrapped in try/catch — a
  // private window, cleared site data, or a browser blocking storage should
  // degrade to an empty cart, not a crashed page.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CartItem[] = JSON.parse(raw);
        // A cart saved before a product's photo was replaced (or before an
        // external host was removed from next.config.mjs) can still hold an
        // imageUrl next/image will no longer render — null it out here so a
        // returning visitor's old cart shows the placeholder instead of
        // crashing the page, without them needing to know to clear storage.
        setItems(
          parsed.map((item) => (isRenderableImageUrl(item.imageUrl) ? item : { ...item, imageUrl: null }))
        );
      }
    } catch {
      // ignore — start with an empty cart
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore — cart just won't persist this session
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, existing.availableStock || existing.quantity + quantity);
        return prev.map((i) => (i.variantId === item.variantId ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...item, quantity: Math.max(1, quantity) }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((variantId: number) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, quantity) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotalCents = useMemo(() => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0), [items]);

  const value: CartContextValue = {
    items,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem,
    removeItem,
    setQuantity,
    clear,
    itemCount,
    subtotalCents,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
