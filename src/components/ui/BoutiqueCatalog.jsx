import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useScene } from '../../context/SceneContext';
import { PRODUCT_MODELS } from '../canvas/rooms/Studio/ProductModels';
import { CATALOG_CATEGORIES, CATALOG_PRODUCTS } from '../canvas/rooms/Studio/boutiqueCatalog';
import {
    getCart,
    addToCart,
    setQty,
    removeFromCart,
    cartTotal,
    placeOrder,
    clearCart,
    fmtPrice,
} from '../canvas/rooms/Studio/boutiqueStore';
import '../../styles/BoutiqueCatalog.scss';

const SORT_OPTIONS = [
    { value: 'pertinence', label: 'Pertinence' },
    { value: 'prix-asc', label: 'Prix croissant' },
    { value: 'prix-desc', label: 'Prix décroissant' },
    { value: 'nouveautes', label: "Nouveautés d'abord" },
];

const CATEGORY_LABELS = CATALOG_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat.label;
    return acc;
}, {});

/**
 * Full-screen 2D e-commerce catalog overlay for the Hakkilo XR boutique.
 * Separate from GlobalOverlay (the single-product focus card): this is the
 * full browsing UI (search / filter / sort / 3D preview / cart / mock order).
 */
const BoutiqueCatalog = () => {
    const { isCatalogOpen, closeCatalog } = useScene();

    if (!isCatalogOpen) return null;

    return <CatalogPanel onClose={closeCatalog} />;
};

const CatalogPanel = ({ onClose }) => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('pertinence');
    const [category, setCategory] = useState('all');
    const [cart, setCart] = useState(() => getCart());
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [preview, setPreview] = useState(null); // product being previewed in 3D
    const [addedMap, setAddedMap] = useState({}); // productId -> true while "Ajouté ✓" flash
    const [confirmation, setConfirmation] = useState(null); // last placed order
    const [showEmptyMsg, setShowEmptyMsg] = useState(false);

    const addedTimers = useRef({});
    const confirmTimer = useRef(null);
    const emptyMsgTimer = useRef(null);
    const searchRef = useRef(null);

    // Clean up all pending timers on unmount
    useEffect(() => {
        const timers = addedTimers.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
            clearTimeout(confirmTimer.current);
            clearTimeout(emptyMsgTimer.current);
        };
    }, []);

    // Autofocus the search field when the catalog opens
    useEffect(() => {
        const t = setTimeout(() => searchRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, []);

    // Escape closes the innermost open layer first
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (preview) {
                setPreview(null);
            } else if (confirmation) {
                setConfirmation(null);
            } else if (isCartOpen) {
                setIsCartOpen(false);
            } else {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [preview, confirmation, isCartOpen, onClose]);

    const cartCount = cart.reduce((sum, item) => sum + item.qte, 0);
    const total = cartTotal(cart, CATALOG_PRODUCTS);

    const visibleProducts = useMemo(() => {
        const query = search.trim().toLowerCase();
        let list = CATALOG_PRODUCTS.filter((p) => {
            if (category !== 'all' && p.category !== category) return false;
            if (query && !p.nom.toLowerCase().includes(query)) return false;
            return true;
        });
        if (sortBy === 'prix-asc') {
            list = [...list].sort((a, b) => a.prix - b.prix);
        } else if (sortBy === 'prix-desc') {
            list = [...list].sort((a, b) => b.prix - a.prix);
        } else if (sortBy === 'nouveautes') {
            list = [...list].sort((a, b) => (b.nouveaute ? 1 : 0) - (a.nouveaute ? 1 : 0));
        }
        return list;
    }, [search, category, sortBy]);

    const handleAdd = useCallback((productId) => {
        setCart(addToCart(productId));
        setAddedMap((m) => ({ ...m, [productId]: true }));
        clearTimeout(addedTimers.current[productId]);
        addedTimers.current[productId] = setTimeout(() => {
            setAddedMap((m) => {
                const next = { ...m };
                delete next[productId];
                return next;
            });
        }, 1200);
    }, []);

    const handleQty = useCallback((productId, qte) => {
        setCart(setQty(productId, qte));
    }, []);

    const handleRemove = useCallback((productId) => {
        setCart(removeFromCart(productId));
    }, []);

    const handleOrder = useCallback(() => {
        if (cart.length === 0) {
            setShowEmptyMsg(true);
            clearTimeout(emptyMsgTimer.current);
            emptyMsgTimer.current = setTimeout(() => setShowEmptyMsg(false), 2500);
            return;
        }
        const order = placeOrder({ items: cart, total: cartTotal(cart, CATALOG_PRODUCTS) });
        clearCart();
        setCart([]);
        setIsCartOpen(false);
        setConfirmation(order);
        clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirmation(null), 5000);
    }, [cart]);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="boutique-catalog" role="dialog" aria-label="Boutique Hakkilo XR">
            {/* Backdrop — clicking it closes the catalog */}
            <div className="boutique-backdrop" onClick={handleBackdropClick} />

            <div className="boutique-panel">
                {/* === HEADER === */}
                <header className="boutique-header">
                    <div className="boutique-brand">
                        <h2 className="boutique-title">Boutique Hakkilo XR</h2>
                        <span className="boutique-subtitle">Matériel VR / AR — démo, commande fictive</span>
                    </div>

                    <div className="boutique-toolbar">
                        <input
                            ref={searchRef}
                            type="text"
                            className="boutique-search"
                            placeholder="Rechercher un produit…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Rechercher un produit"
                        />
                        <select
                            className="boutique-sort"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Trier les produits"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="boutique-cart-btn"
                            onClick={() => setIsCartOpen(true)}
                            aria-label={`Ouvrir le panier (${cartCount} article${cartCount > 1 ? 's' : ''})`}
                        >
                            Panier
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </button>
                        <button
                            type="button"
                            className="boutique-close-btn"
                            onClick={onClose}
                            aria-label="Fermer la boutique"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* === CATEGORY CHIPS === */}
                <div className="boutique-chips" role="group" aria-label="Filtrer par catégorie">
                    <button
                        type="button"
                        className={`boutique-chip ${category === 'all' ? 'active' : ''}`}
                        onClick={() => setCategory('all')}
                        aria-pressed={category === 'all'}
                    >
                        Tous
                    </button>
                    {CATALOG_CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            className={`boutique-chip ${category === cat.id ? 'active' : ''}`}
                            onClick={() => setCategory(cat.id)}
                            aria-pressed={category === cat.id}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* === PRODUCT GRID === */}
                <div className="boutique-grid-scroll">
                    {visibleProducts.length === 0 ? (
                        <p className="boutique-empty">Aucun produit ne correspond à votre recherche.</p>
                    ) : (
                        <div className="boutique-grid">
                            {visibleProducts.map((item) => (
                                <article key={item.id} className="boutique-card">
                                    <div className="card-top">
                                        <span className="card-category">{CATEGORY_LABELS[item.category] || item.category}</span>
                                        {item.nouveaute && <span className="card-new">NOUVEAU</span>}
                                    </div>
                                    <h3 className="card-name">{item.nom}</h3>
                                    <p className="card-desc">{item.desc}</p>
                                    <div className="card-meta">
                                        <span className="card-rating" aria-label={`Note ${item.note} sur 5`}>
                                            ★ {Number(item.note).toFixed(1)}
                                        </span>
                                        {item.stock > 5 ? (
                                            <span className="card-stock in-stock">En stock</span>
                                        ) : item.stock > 0 ? (
                                            <span className="card-stock low-stock">Plus que {item.stock} en stock</span>
                                        ) : (
                                            <span className="card-stock out-of-stock">Épuisé</span>
                                        )}
                                    </div>
                                    <div className="card-price">{fmtPrice(item.prix)}</div>
                                    <div className="card-actions">
                                        <button
                                            type="button"
                                            className="card-preview-btn"
                                            onClick={() => setPreview(item)}
                                        >
                                            Aperçu 3D
                                        </button>
                                        <button
                                            type="button"
                                            className={`card-add-btn ${addedMap[item.id] ? 'added' : ''}`}
                                            onClick={() => handleAdd(item.id)}
                                            disabled={item.stock <= 0}
                                        >
                                            {addedMap[item.id] ? 'Ajouté ✓' : 'Ajouter au panier'}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* === 3D PREVIEW MODAL === */}
            {preview && (
                <div
                    className="boutique-preview-overlay"
                    onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}
                >
                    <div className="boutique-preview" role="dialog" aria-label={`Aperçu 3D — ${preview.nom}`}>
                        <div className="preview-header">
                            <h3>{preview.nom}</h3>
                            <button
                                type="button"
                                className="boutique-close-btn"
                                onClick={() => setPreview(null)}
                                aria-label="Fermer l'aperçu 3D"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="preview-canvas">
                            <Canvas camera={{ position: [0.35, 0.28, 0.45], fov: 40 }} dpr={[1, 2]}>
                                <color attach="background" args={['#F7F4EE']} />
                                <ambientLight intensity={0.9} />
                                <directionalLight position={[2, 3, 2]} intensity={1.4} />
                                <PreviewModel category={preview.category} />
                                <OrbitControls enablePan={false} autoRotate autoRotateSpeed={2} />
                            </Canvas>
                        </div>
                        <p className="preview-hint">Glissez pour tourner autour du produit</p>
                    </div>
                </div>
            )}

            {/* === CART DRAWER === */}
            <div
                className={`boutique-drawer-scrim ${isCartOpen ? 'open' : ''}`}
                onClick={() => setIsCartOpen(false)}
                aria-hidden="true"
            />
            <aside
                className={`boutique-drawer ${isCartOpen ? 'open' : ''}`}
                role="dialog"
                aria-label="Panier"
                inert={!isCartOpen ? true : undefined}
            >
                <div className="drawer-header">
                    <h3>Panier</h3>
                    <button
                        type="button"
                        className="boutique-close-btn"
                        onClick={() => setIsCartOpen(false)}
                        aria-label="Fermer le panier"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="drawer-items">
                    {cart.length === 0 ? (
                        <p className="drawer-empty">Votre panier est vide.</p>
                    ) : (
                        cart.map((line) => {
                            const product = CATALOG_PRODUCTS.find((p) => p.id === line.id);
                            if (!product) return null;
                            return (
                                <div key={line.id} className="drawer-item">
                                    <div className="item-info">
                                        <span className="item-name">{product.nom}</span>
                                        <span className="item-price">{fmtPrice(product.prix * line.qte)}</span>
                                    </div>
                                    <div className="item-controls">
                                        <button
                                            type="button"
                                            className="qty-btn"
                                            onClick={() => handleQty(line.id, line.qte - 1)}
                                            aria-label={`Réduire la quantité de ${product.nom}`}
                                        >
                                            −
                                        </button>
                                        <span className="item-qty" aria-label="Quantité">{line.qte}</span>
                                        <button
                                            type="button"
                                            className="qty-btn"
                                            onClick={() => handleQty(line.id, line.qte + 1)}
                                            aria-label={`Augmenter la quantité de ${product.nom}`}
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            className="item-remove-btn"
                                            onClick={() => handleRemove(line.id)}
                                            aria-label={`Retirer ${product.nom} du panier`}
                                        >
                                            Retirer
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="drawer-footer">
                    <div className="drawer-total">
                        <span>Total</span>
                        <strong>{fmtPrice(total)}</strong>
                    </div>
                    {showEmptyMsg && (
                        <p className="drawer-warning" role="alert">
                            Votre panier est vide — ajoutez un produit avant de commander.
                        </p>
                    )}
                    <button type="button" className="drawer-order-btn" onClick={handleOrder}>
                        Commander
                    </button>
                    <p className="drawer-note">
                        Paiement à la livraison ou mobile money — aucune transaction réelle (démo).
                    </p>
                </div>
            </aside>

            {/* === ORDER CONFIRMATION TOAST === */}
            {confirmation && (
                <div className="boutique-toast" role="status">
                    <span className="toast-text">
                        Commande {confirmation.id} enregistrée — paiement à la livraison ou mobile
                        money, confirmé par notre équipe.
                    </span>
                    <button
                        type="button"
                        className="toast-close-btn"
                        onClick={() => setConfirmation(null)}
                        aria-label="Fermer la confirmation"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

const PreviewModel = ({ category }) => {
    const Model = PRODUCT_MODELS[category];
    if (!Model) return null;
    return <Model />;
};

export default BoutiqueCatalog;
