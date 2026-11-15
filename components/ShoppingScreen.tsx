'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { shoppingProducts, shoppingStores, type ShoppingCategory, type ShoppingProduct, type ShoppingSection } from '../lib/shoppingCatalog';
import MarketplaceScreen from './MarketplaceScreen';

type ClosetItem = { id?: string; name?: string; category: string; imageUrl?: string };
type OutfitRecommendation = { title: string; itemIds: string[] };
type CartEntry = { productId: string; quantity: number };
type ShoppingFilter = 'RECOMMENDED' | 'ALL' | ShoppingCategory;
type CheckoutStage = 'cart' | 'details' | 'confirmation';

const cartStorageKey = 'styleup-shopping-cart';
const coreCategories: ShoppingCategory[] = ['TOPS', 'PANTS', 'JACKETS', 'SHOES'];
const categoryFilters: { value: ShoppingFilter; label: string }[] = [
  { value: 'RECOMMENDED', label: 'FOR YOU' },
  { value: 'ALL', label: 'ALL' },
  { value: 'TOPS', label: 'TOPS' },
  { value: 'PANTS', label: 'BOTTOMS' },
  { value: 'JACKETS', label: 'LAYERS' },
  { value: 'SHOES', label: 'SHOES' },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
}

function getRecommendedCategories(items: ClosetItem[], recommendations: OutfitRecommendation[]) {
  const itemById = new Map(items.filter((item): item is ClosetItem & { id: string } => Boolean(item.id)).map((item) => [item.id, item]));
  const recommendationGaps = new Set<ShoppingCategory>();

  for (const outfit of recommendations) {
    const outfitCategories = new Set(outfit.itemIds.map((id) => itemById.get(id)?.category.trim().toUpperCase()));
    for (const category of coreCategories) {
      if (!outfitCategories.has(category)) recommendationGaps.add(category);
    }
  }

  if (recommendationGaps.size > 0) return [...recommendationGaps];
  const closetCategories = new Set(items.map((item) => item.category.trim().toUpperCase()));
  return coreCategories.filter((category) => !closetCategories.has(category));
}

function getInitialCart() {
  try {
    const savedCart = window.localStorage.getItem(cartStorageKey);
    const parsed: unknown = savedCart ? JSON.parse(savedCart) : [];
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(shoppingProducts.map((product) => product.id));
    return parsed.filter((entry): entry is CartEntry => (
      Boolean(entry)
      && typeof entry.productId === 'string'
      && validIds.has(entry.productId)
      && Number.isInteger(entry.quantity)
      && entry.quantity > 0
    ));
  } catch {
    window.localStorage.removeItem(cartStorageKey);
    return [];
  }
}

function StoreLogo({ store }: { store: (typeof shoppingStores)[number] }) {
  return <span className="shopping-brand-mark">
    <img src={store.logoUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('logo-fallback'); }} />
    <span>{store.initials}</span>
  </span>;
}

function ShoppingProductImage({ product, alt, className }: { product: ShoppingProduct; alt: string; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [product.imageUrl]);

  if (imageFailed) return <span className="shopping-photo-state">Photo unavailable</span>;
  return <img className={className} src={product.imageUrl} alt={alt} loading="lazy" onError={() => setImageFailed(true)} />;
}

function ShoppingProductName({ product, className }: { product: ShoppingProduct; className?: string }) {
  return <span className={className} title={product.name}>{product.name}</span>;
}

export default function ShoppingScreen({ closetItems, outfitRecommendations = [] }: { closetItems: ClosetItem[]; outfitRecommendations?: OutfitRecommendation[] }) {
  const shoppingPageRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<ShoppingSection>('men');
  const [selectedStore, setSelectedStore] = useState('all');
  const [filter, setFilter] = useState<ShoppingFilter>('RECOMMENDED');
  const [visibleCount, setVisibleCount] = useState(20);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<CheckoutStage>('cart');
  const [orderReference, setOrderReference] = useState('');
  const [hasLoadedCart, setHasLoadedCart] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);

  useEffect(() => {
    setCart(getInitialCart());
    setHasLoadedCart(true);
  }, []);

  useEffect(() => {
    if (hasLoadedCart) window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, hasLoadedCart]);

  useEffect(() => {
    (shoppingPageRef.current?.closest('.screen-content') as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'auto' });
  }, [checkoutStage, selectedProductId, showCart, showMarketplace]);

  const gaps = useMemo(() => getRecommendedCategories(closetItems, outfitRecommendations), [closetItems, outfitRecommendations]);
  const products = useMemo(() => shoppingProducts.filter((product) => {
    if (product.section !== section) return false;
    if (selectedStore !== 'all' && product.storeId !== selectedStore) return false;
    if (filter === 'ALL') return true;
    if (filter === 'RECOMMENDED') return gaps.length === 0 || gaps.includes(product.category);
    return product.category === filter;
  }), [filter, gaps, selectedStore, section]);
  const selectedProduct = shoppingProducts.find((product) => product.id === selectedProductId) ?? null;
  const selectedProductStore = selectedProduct && shoppingStores.find((store) => store.id === selectedProduct.storeId);
  const selectedProductQuantity = selectedProduct ? cart.find((entry) => entry.productId === selectedProduct.id)?.quantity ?? 0 : 0;
  const cartCount = cart.reduce((total, entry) => total + entry.quantity, 0);
  const cartProducts = cart.flatMap((entry) => {
    const product = shoppingProducts.find((item) => item.id === entry.productId);
    return product ? [{ product, quantity: entry.quantity }] : [];
  });
  const cartTotal = cartProducts.reduce((total, entry) => total + entry.product.price * entry.quantity, 0);
  const visibleProducts = products.slice(0, visibleCount);

  function addToCart(product: ShoppingProduct) {
    setCart((current) => {
      const existing = current.find((entry) => entry.productId === product.id);
      return existing
        ? current.map((entry) => entry.productId === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
        : [...current, { productId: product.id, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current.flatMap((entry) => {
      if (entry.productId !== productId) return [entry];
      const quantity = entry.quantity + delta;
      return quantity > 0 ? [{ ...entry, quantity }] : [];
    }));
  }

  function selectStore(storeId: string) {
    setSelectedStore(storeId);
    setFilter('RECOMMENDED');
    setVisibleCount(20);
  }

  function selectFilter(nextFilter: ShoppingFilter) {
    setFilter(nextFilter);
    setVisibleCount(20);
  }

  function selectSection(nextSection: ShoppingSection) {
    setSection(nextSection);
    setVisibleCount(20);
  }

  function openProduct(product: ShoppingProduct) {
    setSection(product.section);
    setSelectedProductId(product.id);
  }

  function beginCheckout() {
    setCheckoutStage('details');
  }

  function placeDemoOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderReference(`SU-${Date.now().toString().slice(-8)}`);
    setCart([]);
    setCheckoutStage('confirmation');
  }

  function returnToShopping() {
    setShowCart(false);
    setCheckoutStage('cart');
    setSelectedProductId(null);
  }

  const categoryMessage = outfitRecommendations.length > 0 && gaps.length > 0
    ? `Round out “${outfitRecommendations[0].title}” with pieces these outfit ideas are missing.`
    : closetItems.length === 0
      ? 'A few versatile starting pieces for your closet.'
      : gaps.length > 0
        ? `Ideas for ${gaps.map((category) => category.toLowerCase()).join(', ')} your outfits may be missing.`
        : 'Your core categories are covered. Explore a fresh addition to your looks.';

  return <div className="shopping-page" ref={shoppingPageRef}>
    <div className="shopping-heading">
      <div><p className="shopping-eyebrow">{showMarketplace ? 'STYLEUP MARKETPLACE' : 'STYLEUP EDIT'}</p><h2>{showMarketplace ? 'Pre-loved' : showCart ? checkoutStage === 'confirmation' ? 'Order complete' : checkoutStage === 'details' ? 'Checkout' : 'Your cart' : selectedProduct ? 'Product details' : 'Shopping'}</h2></div>
      <button className={`shopping-cart-toggle${showCart ? ' selected' : ''}`} type="button" onClick={() => {
        if (showMarketplace) {
          setShowMarketplace(false);
          return;
        }
        setSelectedProductId(null);
        setShowCart((current) => !current);
        setCheckoutStage('cart');
      }} aria-label={showMarketplace || showCart ? 'Continue shopping' : `Open cart, ${cartCount} items`}>
        <span aria-hidden="true">{showMarketplace || showCart ? '←' : '▱'}</span><small>{showMarketplace || showCart ? 'SHOP' : `CART ${cartCount}`}</small>
      </button>
    </div>

    {showMarketplace ? <MarketplaceScreen closetItems={closetItems} onClose={() => setShowMarketplace(false)} /> : showCart ? checkoutStage === 'cart' ? <>
      {cartProducts.length === 0 ? <div className="shopping-empty-cart"><span aria-hidden="true">▱</span><h3>Your cart is empty</h3><p>Save pieces from any store and they’ll collect here.</p><button className="primary-button" type="button" onClick={returnToShopping}>EXPLORE STORES</button></div> : <>
        <div className="shopping-cart-list">{cartProducts.map(({ product, quantity }) => {
          const store = shoppingStores.find((item) => item.id === product.storeId);
          return <article className="shopping-cart-item" key={product.id}>
            <button className="shopping-cart-product-link" type="button" onClick={() => { setShowCart(false); openProduct(product); }} aria-label="View cart item details"><ShoppingProductImage product={product} alt="" /></button>
            <div className="shopping-cart-copy"><span>{store?.name}</span><strong><ShoppingProductName product={product} /></strong><small>{formatPrice(product.price)}</small><div className="shopping-quantity"><button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label="Remove one item">−</button><span>{quantity}</span><button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label="Add one item">+</button></div></div>
            <button className="shopping-remove" type="button" onClick={() => setCart((current) => current.filter((entry) => entry.productId !== product.id))} aria-label="Remove item from cart">×</button>
          </article>;
        })}</div>
        <div className="shopping-cart-summary"><span>SUBTOTAL</span><strong>{formatPrice(cartTotal)}</strong></div>
        <button className="primary-button shopping-checkout-button" type="button" onClick={beginCheckout}>CONTINUE TO CHECKOUT</button>
        <p className="shopping-checkout-note">Preview checkout. No payment will be processed.</p>
        <button className="shopping-clear-button" type="button" onClick={() => setCart([])}>CLEAR CART</button>
      </>}
    </> : checkoutStage === 'details' ? <form className="shopping-checkout-form" onSubmit={placeDemoOrder}>
      <button className="shopping-back-link" type="button" onClick={() => setCheckoutStage('cart')}>← BACK TO CART</button>
      <p className="shopping-checkout-summary">{cartCount} {cartCount === 1 ? 'item' : 'items'} · {formatPrice(cartTotal)}</p>
      <h3>Delivery details</h3>
      <label>FULL NAME<input name="name" autoComplete="name" required maxLength={100} /></label>
      <label>EMAIL<input name="email" type="email" autoComplete="email" required maxLength={150} /></label>
      <label>STREET ADDRESS<input name="address" autoComplete="street-address" required maxLength={150} /></label>
      <div className="shopping-checkout-row"><label>CITY<input name="city" autoComplete="address-level2" required maxLength={80} /></label><label>ZIP CODE<input name="postalCode" autoComplete="postal-code" required maxLength={12} /></label></div>
      <label>PAYMENT METHOD<select name="payment" defaultValue="sample-card"><option value="sample-card">Sample card ···· 4242</option><option value="sample-wallet">Sample digital wallet</option></select></label>
      <p className="shopping-checkout-note">This is a simulated order. Your details are not saved and no payment is processed.</p>
      <button className="primary-button shopping-checkout-button" type="submit">PLACE PREVIEW ORDER · {formatPrice(cartTotal)}</button>
    </form> : <div className="shopping-order-confirmation">
      <span className="shopping-order-check" aria-hidden="true">✓</span><p className="shopping-eyebrow">PREVIEW ORDER</p><h3>Order confirmed</h3><p>Your sample order <strong>{orderReference}</strong> is complete. No payment was taken and nothing will be shipped.</p><button className="primary-button" type="button" onClick={returnToShopping}>BACK TO SHOPPING</button>
    </div> : selectedProduct ? <>
      <button className="shopping-back-link" type="button" onClick={() => setSelectedProductId(null)}>← BACK TO {selectedStore === 'all' ? 'SHOPPING' : shoppingStores.find((store) => store.id === selectedStore)?.name.toUpperCase()}</button>
      <div className="shopping-detail-gallery"><ShoppingProductImage product={selectedProduct} className="shopping-detail-image" alt={selectedProduct.name} /></div>
      <div className="shopping-detail-copy">
        <div className="shopping-detail-brand"><StoreLogo store={selectedProductStore!} /><span>{selectedProductStore?.name} · {selectedProduct.category.toLowerCase()}</span></div>
        <h3><ShoppingProductName product={selectedProduct} /></h3>
        <strong className="shopping-detail-price">{formatPrice(selectedProduct.price)}</strong>
        <p className="shopping-detail-description">{selectedProduct.description}</p>
        <div className="shopping-product-specs"><div><span>CATEGORY</span><strong>{selectedProduct.category.toLowerCase()}</strong></div><div><span>MATERIAL</span><strong>{selectedProduct.material}</strong></div><div><span>FIT</span><strong>{selectedProduct.fit}</strong></div></div>
        <div className="shopping-detail-stepper"><strong>ADD TO CART</strong><div className="shopping-product-stepper"><button type="button" disabled={selectedProductQuantity === 0} onClick={() => changeQuantity(selectedProduct.id, -1)} aria-label="Remove one item">−</button><span>{selectedProductQuantity}</span><button type="button" onClick={() => addToCart(selectedProduct)} aria-label="Add one item to cart">+</button></div></div>
      </div>
      <section className="shopping-review-section"><div className="shopping-review-heading"><div><p className="shopping-eyebrow">SAMPLE REVIEWS</p><h3>What people think</h3></div><strong>★ {selectedProduct.rating.toFixed(1)} <small>({selectedProduct.reviewCount})</small></strong></div>
        {selectedProduct.reviews.map((review) => <article className="shopping-review" key={review.author}><div><strong>{review.title}</strong><span>★★★★★</span></div><p>{review.text}</p><small>{review.author} · Sample review</small></article>)}
      </section>
    </> : <>
      <div className="shopping-mode-toggle" role="group" aria-label="Shopping mode">
        <button className="active" type="button" aria-pressed="true">SHOP NEW</button>
        <button type="button" aria-pressed="false" onClick={() => { setShowMarketplace(true); setShowCart(false); }}>PRE-LOVED</button>
      </div>
      <div className="shopping-section-toggle" role="group" aria-label="Clothing section">
        <button type="button" className={section === 'men' ? 'active' : ''} aria-pressed={section === 'men'} onClick={() => selectSection('men')}>MEN&apos;S</button>
        <button type="button" className={section === 'women' ? 'active' : ''} aria-pressed={section === 'women'} onClick={() => selectSection('women')}>WOMEN&apos;S</button>
      </div>
      <p className="shopping-intro">{categoryMessage}</p>
      <div className="shopping-store-heading"><h3>STORES</h3><span>6 STORES</span></div>
      <div className="shopping-store-list" aria-label="Choose a store">
        <button className={`shopping-store${selectedStore === 'all' ? ' active' : ''}`} type="button" onClick={() => selectStore('all')} aria-pressed={selectedStore === 'all'}><span className="shopping-brand-mark shopping-all-mark">✳</span><span>All stores</span></button>
        {shoppingStores.map((store) => <button className={`shopping-store${selectedStore === store.id ? ' active' : ''}`} type="button" key={store.id} onClick={() => selectStore(store.id)} aria-pressed={selectedStore === store.id}><StoreLogo store={store} /><span>{store.name}</span></button>)}
      </div>
      <div className="shopping-product-heading"><div><h3>{selectedStore === 'all' ? 'Picked for your closet' : shoppingStores.find((store) => store.id === selectedStore)?.name}</h3><p>{selectedStore === 'all' ? 'Pieces to help complete a look' : 'Explore the collection'}</p></div><span>{products.length} ITEMS</span></div>
      <div className="shopping-filter-list" aria-label="Filter products">
        {categoryFilters.map((option) => <button type="button" key={option.value} className={filter === option.value ? 'active' : ''} onClick={() => selectFilter(option.value)} aria-pressed={filter === option.value}>{option.label}</button>)}
      </div>
      {products.length === 0 ? <p className="shopping-no-results">No items match this category yet.</p> : <>
        <div className="shopping-product-grid">{visibleProducts.map((product) => {
          const store = shoppingStores.find((item) => item.id === product.storeId)!;
          const inCart = cart.find((entry) => entry.productId === product.id)?.quantity ?? 0;
          const fillsGap = gaps.includes(product.category);
          return <article className="shopping-product" key={product.id}>
            <button className="shopping-product-open" type="button" onClick={() => openProduct(product)}>
              <span className="shopping-product-image"><ShoppingProductImage product={product} alt="" />{fillsGap && <span className="shopping-gap-label">OUTFIT MATCH</span>}</span>
              <span className="shopping-product-store"><StoreLogo store={store} />{store.name} · {product.category.toLowerCase()}</span>
              <strong className="shopping-product-name"><ShoppingProductName product={product} /></strong>
              <span className="shopping-product-price">{formatPrice(product.price)}</span>
            </button>
            <div className="shopping-product-stepper"><button type="button" disabled={inCart === 0} onClick={() => changeQuantity(product.id, -1)} aria-label="Remove one item">−</button><span>{inCart}</span><button type="button" onClick={() => addToCart(product)} aria-label="Add one item to cart">+</button></div>
          </article>;
        })}</div>
        {visibleCount < products.length && <button className="shopping-load-more" type="button" onClick={() => setVisibleCount((current) => current + 20)}>SHOW MORE · {products.length - visibleCount} LEFT</button>}
      </>}
    </>}
  </div>;
}