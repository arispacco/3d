/**
 * Boutique Hakkilo XR — localStorage-backed cart & mock order store.
 *
 * Plain JS, no React. All localStorage access is wrapped in try/catch so
 * private-browsing / quota-exceeded scenarios degrade silently instead of
 * crashing the UI (the cart simply behaves as empty / non-persistent).
 *
 * Keys are prefixed with `pi-boutique-` to avoid collisions with the rest
 * of the app's localStorage usage.
 */

import { CATALOG_PRODUCTS } from './boutiqueCatalog';

const CART_KEY = 'pi-boutique-cart';
const ORDERS_KEY = 'pi-boutique-orders';
const ORDER_SEQ_KEY = 'pi-boutique-order-seq';

// --- Low-level safe storage helpers ---

const readJSON = (key, fallback) => {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
        return fallback;
    }
};

const writeJSON = (key, value) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Fail silently (private browsing, quota exceeded...)
    }
};

// --- Cart ---

/** @returns {Array<{id: string, qte: number}>} */
export const getCart = () => {
    const cart = readJSON(CART_KEY, []);
    return Array.isArray(cart) ? cart : [];
};

/** Adds one unit of a product (new line, or increments the existing one). */
export const addToCart = (productId) => {
    const cart = getCart();
    const line = cart.find((item) => item.id === productId);
    if (line) {
        line.qte += 1;
    } else {
        cart.push({ id: productId, qte: 1 });
    }
    writeJSON(CART_KEY, cart);
    return cart;
};

/** Sets the quantity of a line; removes the line entirely if qte <= 0. */
export const setQty = (productId, qte) => {
    let cart = getCart();
    if (qte <= 0) {
        cart = cart.filter((item) => item.id !== productId);
    } else {
        const line = cart.find((item) => item.id === productId);
        if (line) {
            line.qte = qte;
        } else {
            cart.push({ id: productId, qte });
        }
    }
    writeJSON(CART_KEY, cart);
    return cart;
};

export const removeFromCart = (productId) => {
    const cart = getCart().filter((item) => item.id !== productId);
    writeJSON(CART_KEY, cart);
    return cart;
};

export const clearCart = () => {
    writeJSON(CART_KEY, []);
    return [];
};

/**
 * Computes the integer FCFA total of a cart by looking prices up in the
 * catalog. `products` defaults to CATALOG_PRODUCTS; unknown ids count as 0.
 */
export const cartTotal = (cartItems, products = CATALOG_PRODUCTS) => {
    if (!Array.isArray(cartItems)) return 0;
    return cartItems.reduce((total, item) => {
        const product = products.find((p) => p.id === item.id);
        return total + (product ? product.prix * item.qte : 0);
    }, 0);
};

// --- Orders (mock checkout — no real payment) ---

/** @returns {Array<object>} most recent order first */
export const getOrders = () => {
    const orders = readJSON(ORDERS_KEY, []);
    return Array.isArray(orders) ? orders : [];
};

/**
 * Records a mock order ("paiement à la livraison ou mobile money").
 * Generates a CMD-0001-style incrementing id, prepends the order to the
 * stored list, persists, and returns the new order.
 */
export const placeOrder = ({ items, total }) => {
    const seq = Number(readJSON(ORDER_SEQ_KEY, 0)) || 0;
    const nextSeq = seq + 1;
    const order = {
        id: `CMD-${String(nextSeq).padStart(4, '0')}`,
        date: Date.now(),
        statut: 'En traitement',
        items,
        total,
    };
    const orders = getOrders();
    orders.unshift(order);
    writeJSON(ORDERS_KEY, orders);
    writeJSON(ORDER_SEQ_KEY, nextSeq);
    return order;
};

// --- Formatting ---

/** French-locale price string, e.g. 520000 -> "520 000 FCFA". */
export const fmtPrice = (n) => {
    const value = Number(n) || 0;
    let formatted;
    try {
        formatted = new Intl.NumberFormat('fr-FR').format(value);
    } catch {
        formatted = String(value);
    }
    // Normalise narrow no-break / no-break spaces to regular spaces
    return `${formatted.replace(/[\u202f\u00a0]/g, ' ')} FCFA`;
};
