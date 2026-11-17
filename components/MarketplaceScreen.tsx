'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ShoppingCategory } from '../lib/shoppingCatalog';
import { supabase } from '../lib/supabase';

type MarketplaceCondition = 'New with tags' | 'Like new' | 'Good' | 'Fair';
type MarketplaceListing = {
  id: string;
  name: string;
  brand: string;
  category: ShoppingCategory;
  size: string;
  condition: MarketplaceCondition;
  price: number;
  originalPrice?: number;
  description: string;
  seller: string;
  sellerId?: string;
  active?: boolean;
  createdAt?: number;
  imageUrl?: string;
  sold: boolean;
  closetItemId: string;
};
type MarketplaceView = 'browse' | 'sell' | 'details' | 'edit' | 'checkout' | 'confirmation';
type MarketplaceListingTab = 'others' | 'mine';
type ClosetItem = { id?: string; name?: string; category: string; imageUrl?: string };
type MarketplaceAccount = { id: string; name: string };

const storageKey = 'styleup-marketplace-listings';
const categories: ShoppingCategory[] = ['TOPS', 'PANTS', 'JACKETS', 'SHOES'];
const conditions: MarketplaceCondition[] = ['New with tags', 'Like new', 'Good', 'Fair'];

function getListingCategory(value: string): ShoppingCategory | null {
  const normalized = value.trim().toUpperCase();
  if (categories.includes(normalized as ShoppingCategory)) return normalized as ShoppingCategory;
  if (['SHIRT', 'TOP', 'T-SHIRT'].includes(normalized)) return 'TOPS';
  if (['BOTTOMS', 'TROUSERS', 'JEANS'].includes(normalized)) return 'PANTS';
  if (['OUTERWEAR', 'COAT'].includes(normalized)) return 'JACKETS';
  if (['FOOTWEAR', 'SNEAKERS'].includes(normalized)) return 'SHOES';
  return null;
}

function isListing(value: unknown): value is MarketplaceListing {
  if (!value || typeof value !== 'object') return false;
  const listing = value as Partial<MarketplaceListing>;
  return typeof listing.id === 'string'
    && typeof listing.name === 'string'
    && typeof listing.brand === 'string'
    && categories.includes(listing.category as ShoppingCategory)
    && typeof listing.size === 'string'
    && conditions.includes(listing.condition as MarketplaceCondition)
    && typeof listing.price === 'number'
    && Number.isFinite(listing.price)
    && (listing.originalPrice === undefined || (typeof listing.originalPrice === 'number' && Number.isFinite(listing.originalPrice)))
    && typeof listing.description === 'string'
    && typeof listing.seller === 'string'
    && (listing.sellerId === undefined || typeof listing.sellerId === 'string')
    && (listing.active === undefined || typeof listing.active === 'boolean')
    && (listing.createdAt === undefined || (typeof listing.createdAt === 'number' && Number.isFinite(listing.createdAt)))
    && (listing.imageUrl === undefined || typeof listing.imageUrl === 'string')
    && typeof listing.sold === 'boolean'
    && typeof listing.closetItemId === 'string';
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function formatListingAge(createdAt: number | undefined, now: number | null) {
  if (createdAt === undefined) return 'Listed date unavailable';
  if (now === null) return 'Listed recently';

  const minutes = Math.floor(Math.max(0, now - createdAt) / 60_000);
  if (minutes < 1) return 'Listed just now';
  if (minutes < 60) return `Listed ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Listed ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Listed ${days} ${days === 1 ? 'day' : 'days'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Listed ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;

  const months = Math.floor(days / 30);
  if (days < 365) return `Listed ${months} ${months === 1 ? 'month' : 'months'} ago`;

  const years = Math.floor(days / 365);
  return `Listed ${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function getMarketplaceAccount(user: User | null): MarketplaceAccount | null {
  if (!user) return null;
  const fullName = typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const name = typeof user.user_metadata.name === 'string' ? user.user_metadata.name.trim() : '';
  return { id: user.id, name: fullName || name };
}

function getClosetItemKey(item: ClosetItem, index: number) {
  return item.id ?? `${item.name ?? 'closet-item'}-${index}`;
}

function getListingImageUrl(listing: MarketplaceListing, closetPhotos: { key: string; item: ClosetItem & { imageUrl: string } }[]) {
  return listing.imageUrl?.trim() || closetPhotos.find(({ key }) => key === listing.closetItemId)?.item.imageUrl || '';
}

function MarketplacePrice({ listing, className }: { listing: MarketplaceListing; className: string }) {
  const originalPrice = listing.originalPrice ?? listing.price;
  const isDiscounted = originalPrice > listing.price;
  return <span className={className} aria-label={isDiscounted
    ? `On sale for ${formatPrice(listing.price)}, reduced from ${formatPrice(originalPrice)}`
    : formatPrice(listing.price)}>
    {isDiscounted && <del className="marketplace-price-original">{formatPrice(originalPrice)}</del>}
    {isDiscounted ? <strong className="marketplace-price-current">{formatPrice(listing.price)}</strong> : formatPrice(listing.price)}
  </span>;
}

export default function MarketplaceScreen({ closetItems, onClose }: { closetItems: ClosetItem[]; onClose: () => void }) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [view, setView] = useState<MarketplaceView>('browse');
  const [listingTab, setListingTab] = useState<MarketplaceListingTab>('others');
  const [sellerAccount, setSellerAccount] = useState<MarketplaceAccount | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | ShoppingCategory>('ALL');
  const [error, setError] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [selectedClosetItemId, setSelectedClosetItemId] = useState('');
  const [listingName, setListingName] = useState('');
  const [listingCategory, setListingCategory] = useState<ShoppingCategory>('TOPS');
  const closetCarouselRef = useRef<HTMLDivElement>(null);
  const closetPhotos = useMemo(() => closetItems
    .filter((item): item is ClosetItem & { imageUrl: string } => Boolean(item.imageUrl?.trim()))
    .map((item, index) => ({ key: getClosetItemKey(item, index), item })), [closetItems]);

  function scrollCloset(direction: -1 | 1) {
    const carousel = closetCarouselRef.current;
    if (carousel) carousel.scrollBy({ left: direction * carousel.clientWidth * 0.85, behavior: 'smooth' });
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) throw new Error('Saved listings are not a list.');
      setListings(parsed.filter(isListing));
    } catch (loadError) {
      console.error('Could not load marketplace listings:', loadError);
      setError('Saved listings could not be loaded. You can still add a new listing.');
    }
  }, []);

  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isActive = true;
    const syncAccount = async () => {
      try {
        const { data, error: accountError } = await client.auth.getSession();
        if (!isActive) return;
        if (accountError) {
          console.error('Could not load marketplace account:', accountError);
          setError('Your account details could not be loaded. Try again before creating a listing.');
          return;
        }
        setSellerAccount(getMarketplaceAccount(data.session?.user ?? null));
      } catch (accountError) {
        if (!isActive) return;
        console.error('Could not load marketplace account:', accountError);
        setError('Your account details could not be loaded. Try again before creating a listing.');
      }
    };

    void syncAccount();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (isActive) setSellerAccount(getMarketplaceAccount(session?.user ?? null));
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sellerAccount || closetPhotos.length === 0 || listings.length === 0) return;

    let updated = false;
    const nextListings = listings.map((listing) => {
      if (!isOwnListing(listing) || listing.imageUrl) return listing;
      const imageUrl = closetPhotos.find(({ key }) => key === listing.closetItemId)?.item.imageUrl;
      if (!imageUrl) return listing;
      updated = true;
      return { ...listing, imageUrl };
    });
    if (!updated) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
    } catch (saveError) {
      console.error('Could not save marketplace listing photos:', saveError);
      setError('An older listing photo could not be saved for other marketplace viewers.');
    }
  }, [closetPhotos, listings, sellerAccount]);

  function isOwnListing(listing: MarketplaceListing) {
    if (listing.sellerId && sellerAccount) return listing.sellerId === sellerAccount.id;
    return Boolean(sellerAccount?.name && listing.seller.trim().toLowerCase() === sellerAccount.name.toLowerCase());
  }

  function canBuyListing(listing: MarketplaceListing) {
    return !isOwnListing(listing) && (!listing.sellerId || Boolean(sellerAccount));
  }

  const selectedListing = listings.find((listing) => listing.id === selectedId && !listing.sold) ?? null;
  const selectedListingIsOwn = selectedListing ? isOwnListing(selectedListing) : false;
  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => !listing.sold
      && (listingTab === 'mine' || listing.active !== false)
      && (listingTab === 'mine' ? isOwnListing(listing) : !isOwnListing(listing))
      && (category === 'ALL' || listing.category === category)
      && (!query || `${listing.name} ${listing.brand} ${listing.category} ${listing.size}`.toLowerCase().includes(query)));
  }, [category, listingTab, listings, search, sellerAccount]);
  const hasListingsInTab = listings.some((listing) => !listing.sold
    && (listingTab === 'mine' ? isOwnListing(listing) : listing.active !== false && !isOwnListing(listing)));

  function publishListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!sellerAccount?.id || !sellerAccount.name) {
      setError(sellerAccount ? 'Add your name to your account profile before creating a listing.' : 'Sign in and add your account name before creating a listing.');
      return;
    }

    const selectedClosetItem = closetPhotos.find(({ key }) => key === selectedClosetItemId);
    if (!selectedClosetItem) {
      setError('Choose an item from your closet to create a listing.');
      return;
    }

    const price = Number(data.get('price'));
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a price greater than $0.');
      return;
    }

    const listing: MarketplaceListing = {
      id: `resale-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}`,
      name: listingName.trim(),
      brand: String(data.get('brand') ?? '').trim(),
      category: listingCategory,
      size: String(data.get('size') ?? '').trim(),
      condition: String(data.get('condition')) as MarketplaceCondition,
      price: Math.round(price * 100) / 100,
      description: String(data.get('description') ?? '').trim(),
      seller: sellerAccount.name,
      sellerId: sellerAccount.id,
      active: true,
      createdAt: Date.now(),
      imageUrl: selectedClosetItem.item.imageUrl,
      sold: false,
      closetItemId: selectedClosetItem.key,
    };
    const nextListings = [listing, ...listings];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
      setSearch('');
      setCategory('ALL');
      setListingTab('mine');
      setError('');
      setView('browse');
      setSelectedClosetItemId('');
      setListingName('');
      setListingCategory('TOPS');
      form.reset();
    } catch (saveError) {
      console.error('Could not save marketplace listing:', saveError);
      setError('This listing could not be saved in this browser. Check available storage and try again.');
    }
  }

  function saveListingEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListing || !isOwnListing(selectedListing)) {
      setError('You can only edit your own listings.');
      setView('browse');
      return;
    }

    const data = new FormData(event.currentTarget);
    const price = Number(data.get('price'));
    const size = String(data.get('size') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      setError('Enter a price greater than $0 and no more than $100,000.');
      return;
    }
    if (!size || !description) {
      setError('Enter both a size and description.');
      return;
    }

    const roundedPrice = Math.round(price * 100) / 100;
    const originalPrice = selectedListing.originalPrice !== undefined && roundedPrice < selectedListing.originalPrice
      ? selectedListing.originalPrice
      : roundedPrice < selectedListing.price
        ? selectedListing.price
        : undefined;
    const nextListings = listings.map((listing) => listing.id === selectedListing.id
      ? { ...listing, price: roundedPrice, originalPrice, size, description }
      : listing);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
      setError('');
      setView('details');
    } catch (saveError) {
      console.error('Could not update marketplace listing:', saveError);
      setError('This listing could not be updated in this browser. Check available storage and try again.');
    }
  }

  function toggleListingAvailability() {
    if (!selectedListing || !isOwnListing(selectedListing)) {
      setError('You can only change the status of your own listings.');
      setView('browse');
      return;
    }

    const nextListings = listings.map((listing) => listing.id === selectedListing.id
      ? { ...listing, active: listing.active === false }
      : listing);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
      setError('');
    } catch (saveError) {
      console.error('Could not update marketplace listing status:', saveError);
      setError('This listing status could not be changed in this browser. Check available storage and try again.');
    }
  }

  function deleteSelectedListing() {
    if (!selectedListing || !isOwnListing(selectedListing)) {
      setError('You can only delete your own listings.');
      setView('browse');
      return;
    }

    const nextListings = listings.filter((listing) => listing.id !== selectedListing.id);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
      setSelectedId(null);
      setIsConfirmingDelete(false);
      setListingTab('mine');
      setError('');
      setView('browse');
    } catch (saveError) {
      console.error('Could not delete marketplace listing:', saveError);
      setError('This listing could not be deleted in this browser. Check available storage and try again.');
    }
  }

  function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListing) {
      setError('This item is no longer available. Browse the marketplace for another.');
      setView('browse');
      return;
    }
    if (!canBuyListing(selectedListing)) {
      setError(!sellerAccount && selectedListing.sellerId
        ? 'Sign in to confirm this item belongs to another seller.'
        : 'You can’t buy your own listing. Browse the marketplace for another item.');
      setView('browse');
      return;
    }
    const nextListings = listings.map((listing) => listing.id === selectedListing.id ? { ...listing, sold: true } : listing);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextListings));
      setListings(nextListings);
      setOrderReference(`SU-${Date.now().toString().slice(-8)}`);
      setError('');
      setView('confirmation');
    } catch (saveError) {
      console.error('Could not complete marketplace preview order:', saveError);
      setError('Your order could not be completed. Please try again.');
    }
  }

  return <section className="marketplace-panel" aria-label="Pre-loved marketplace">
    {view === 'browse' ? <>
      <div className="marketplace-switch">
        <button type="button" onClick={onClose}>SHOP NEW</button>
        <button className="active" type="button" aria-pressed="true">PRE-LOVED</button>
      </div>
      <div className="marketplace-banner">
        <div><p className="shopping-eyebrow">STYLE CIRCULAR</p><h3>Good finds deserve another life.</h3><p>Discover pre-loved pieces by brand, or pass something on.</p></div>
        <button className="marketplace-sell-button" type="button" onClick={() => { setError(''); setView('sell'); }}>＋ SELL</button>
      </div>
      <div className="marketplace-listing-tabs" role="group" aria-label="Marketplace listings">
        <button type="button" aria-pressed={listingTab === 'others'} className={listingTab === 'others' ? 'active' : ''} onClick={() => setListingTab('others')}>OTHER LISTINGS</button>
        <button type="button" aria-pressed={listingTab === 'mine'} className={listingTab === 'mine' ? 'active' : ''} onClick={() => setListingTab('mine')}>YOUR LISTINGS</button>
      </div>
      <label className="marketplace-search">SEARCH ITEMS OR BRANDS<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try a brand, item, or size" /></label>
      <div className="shopping-filter-list marketplace-category-filter" aria-label="Filter pre-loved listings">
        {(['ALL', ...categories] as const).map((value) => <button key={value} type="button" className={category === value ? 'active' : ''} aria-pressed={category === value} onClick={() => setCategory(value)}>{value === 'ALL' ? 'ALL ITEMS' : value}</button>)}
      </div>
      {error && <p className="marketplace-error" role="alert">{error}</p>}
      {visibleListings.length === 0 ? <div className="marketplace-empty"><span aria-hidden="true">✦</span><h3>{hasListingsInTab ? (listingTab === 'mine' ? 'No matching listings' : 'No matching finds') : (listingTab === 'mine' ? 'You have no listings yet' : 'No other listings yet')}</h3><p>{hasListingsInTab ? 'Try another brand, size, or category.' : (listingTab === 'mine' ? 'List a piece from your closet to see it here.' : 'Check back for pre-loved pieces from other sellers.')}</p>{listingTab === 'mine' && <button className="primary-button" type="button" onClick={() => { setError(''); setView('sell'); }}>LIST AN ITEM</button>}</div> : <div className="marketplace-grid">
        {visibleListings.map((listing) => <article className="marketplace-card" key={listing.id}>
          <button type="button" className="marketplace-card-open" onClick={() => { setSelectedId(listing.id); setIsConfirmingDelete(false); setError(''); setView('details'); }}>
            <span className="marketplace-card-image">{getListingImageUrl(listing, closetPhotos) ? <img src={getListingImageUrl(listing, closetPhotos)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">✦</span>}</span>
            <span className="marketplace-card-brand">{listing.brand} · {listing.condition}</span>
            <strong>{listing.name}</strong>
            <span className="marketplace-card-meta">Size {listing.size} · {listing.category.toLowerCase()}</span>
            <MarketplacePrice listing={listing} className="marketplace-card-price" />
          </button>
          {isOwnListing(listing) ? <>
            <span className="marketplace-own-label">{listing.active === false ? 'Off Market' : 'Active'}</span>
            <button className="marketplace-buy-button" type="button" onClick={() => { setSelectedId(listing.id); setIsConfirmingDelete(false); setError(''); setView('edit'); }}>EDIT LISTING</button>
          </> : !sellerAccount && listing.sellerId ? <span className="marketplace-own-label">SIGN IN TO BUY</span> : <button className="marketplace-buy-button" type="button" onClick={() => { setSelectedId(listing.id); setError(''); setView('checkout'); }}>BUY NOW</button>}
          <small className="marketplace-listed-age">{formatListingAge(listing.createdAt, currentTime)}</small>
        </article>)}
      </div>}
      <p className="shopping-checkout-note">Marketplace preview: listings are saved on this device. Payments, shipping, and seller payouts are not connected.</p>
    </> : view === 'sell' ? <>
      <button className="shopping-back-link" type="button" onClick={() => { setIsConfirmingDelete(false); setError(''); setView('browse'); }}>← BACK TO MARKETPLACE</button>
      <p className="marketplace-intro">Give a favorite piece a second life. Add the details below to publish your listing in this browser.</p>
      <form className="marketplace-form" onSubmit={publishListing}>
        <fieldset className="marketplace-closet-picker">
          <legend>PICK AN ITEM FROM YOUR CLOSET</legend>
          {closetPhotos.length > 0 ? <div className="marketplace-closet-carousel">
            {closetPhotos.length > 2 && <button className="marketplace-closet-carousel-button" type="button" aria-label="Previous closet items" onClick={() => scrollCloset(-1)}>‹</button>}
            <div className={`marketplace-closet-grid${closetPhotos.length > 2 ? ' is-scrollable' : ''}`} ref={closetCarouselRef} role="region" aria-label="Closet items">
              {closetPhotos.map(({ key, item }) => <button
                className={`marketplace-closet-option${selectedClosetItemId === key ? ' selected' : ''}`}
                type="button"
                key={key}
                aria-pressed={selectedClosetItemId === key}
                onClick={() => {
                  const nextId = selectedClosetItemId === key ? '' : key;
                  const picked = closetPhotos.find((photo) => photo.key === nextId)?.item;
                  setSelectedClosetItemId(nextId);
                  setError('');
                  if (picked) {
                    setListingName(picked.name ?? '');
                    setListingCategory(getListingCategory(picked.category) ?? 'TOPS');
                  } else {
                    setListingName('');
                    setListingCategory('TOPS');
                  }
                }}
              >
                <span className="marketplace-closet-preview"><img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>
                <strong>{item.name || 'Closet item'}</strong>
                <small>{item.category}</small>
                {selectedClosetItemId === key && <span className="marketplace-closet-selected">SELECTED</span>}
              </button>)}
            </div>
            {closetPhotos.length > 2 && <button className="marketplace-closet-carousel-button" type="button" aria-label="Next closet items" onClick={() => scrollCloset(1)}>›</button>}
          </div> : <p className="marketplace-closet-empty">No photographed clothing in your closet yet. Add a clothing photo to your closet before listing.</p>}
        </fieldset>
        {selectedClosetItemId && <p className="marketplace-photo-source">✓ Listing photo will come from your closet item.</p>}
        <label>ITEM NAME<input name="name" value={listingName} onChange={(event) => setListingName(event.target.value)} required maxLength={80} placeholder="e.g. Relaxed denim jacket" /></label>
        <label>BRAND<input name="brand" required maxLength={60} placeholder="Any brand" /></label>
        <div className="shopping-checkout-row">
          <label>CATEGORY<select name="category" value={listingCategory} onChange={(event) => setListingCategory(event.target.value as ShoppingCategory)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>SIZE<input name="size" required maxLength={20} placeholder="e.g. M, 8, 28" /></label>
        </div>
        <div className="shopping-checkout-row">
          <label>CONDITION<select name="condition" defaultValue="Like new">{conditions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>PRICE (USD)<input name="price" type="number" min="0.01" max="100000" step="0.01" required placeholder="25.00" /></label>
        </div>
        <label>DESCRIPTION<textarea name="description" required maxLength={500} rows={3} placeholder="Share fit, measurements, and any details shoppers should know." /></label>
        <div className="marketplace-seller-account"><span>SELLER NAME</span><strong>{sellerAccount?.name || 'Account name required'}</strong><small>{sellerAccount?.name ? 'Tied to your account profile' : 'Sign in and set your name in your account profile to list items.'}</small></div>
        {error && <p className="marketplace-error" role="alert">{error}</p>}
        <p className="shopping-checkout-note">Listings stay in this browser; no shipping or payouts are connected.</p>
        <button className="primary-button shopping-checkout-button" type="submit" disabled={closetPhotos.length === 0 || !sellerAccount?.id || !sellerAccount.name}>PUBLISH LISTING</button>
      </form>
    </> : view === 'edit' && selectedListing && selectedListingIsOwn ? <>
      <button className="shopping-back-link" type="button" onClick={() => { setError(''); setView('details'); }}>← BACK TO LISTING</button>
      <p className="shopping-eyebrow">EDIT YOUR LISTING</p>
      <h3 className="marketplace-edit-heading">{selectedListing.name}</h3>
      <form className="marketplace-form" onSubmit={saveListingEdits}>
        <label>PRICE (USD)<input name="price" type="number" min="0.01" max="100000" step="0.01" required defaultValue={selectedListing.price.toFixed(2)} /></label>
        <label>SIZE<input name="size" required maxLength={20} defaultValue={selectedListing.size} /></label>
        <label>DESCRIPTION<textarea name="description" required maxLength={500} rows={4} defaultValue={selectedListing.description} /></label>
        <p className="shopping-checkout-note">Lowering the price will show the previous price crossed out next to the sale price.</p>
        {error && <p className="marketplace-error" role="alert">{error}</p>}
        <button className="primary-button shopping-checkout-button" type="submit">SAVE CHANGES</button>
        <button className="marketplace-delete-button" type="button" onClick={() => { setIsConfirmingDelete(true); setError(''); setView('details'); }}>DELETE LISTING</button>
      </form>
    </> : view === 'details' && selectedListing ? <>
      <button className="shopping-back-link" type="button" onClick={() => { setIsConfirmingDelete(false); setError(''); setView('browse'); }}>← BACK TO MARKETPLACE</button>
      <div className="marketplace-detail-image">{getListingImageUrl(selectedListing, closetPhotos) ? <img src={getListingImageUrl(selectedListing, closetPhotos)} alt={selectedListing.name} referrerPolicy="no-referrer" /> : <span aria-hidden="true">✦</span>}</div>
      <div className="shopping-detail-copy">
        <p className="shopping-eyebrow">PRE-LOVED · {selectedListing.condition.toUpperCase()}</p>
        <h3>{selectedListing.name}</h3>
        <MarketplacePrice listing={selectedListing} className="shopping-detail-price" />
        <p className="shopping-detail-description">{selectedListing.description}</p>
        <div className="shopping-product-specs"><div><span>BRAND</span><strong>{selectedListing.brand}</strong></div><div><span>SIZE</span><strong>{selectedListing.size}</strong></div><div><span>SELLER</span><strong>{selectedListing.seller}</strong></div></div>
        {selectedListingIsOwn ? <>
          <p className="shopping-checkout-note">{selectedListing.active === false ? 'This listing is off market and visible only to you.' : 'This item is currently listed in the marketplace.'}</p>
          {error && <p className="marketplace-error" role="alert">{error}</p>}
          <button className="primary-button shopping-checkout-button" type="button" onClick={() => { setIsConfirmingDelete(false); setError(''); setView('edit'); }}>EDIT LISTING</button>
          <button className="marketplace-status-button" type="button" onClick={toggleListingAvailability}>{selectedListing.active === false ? 'PUT BACK ON MARKET' : 'TAKE OFF MARKET'}</button>
          {isConfirmingDelete ? <div className="marketplace-delete-confirmation" role="group" aria-label="Confirm listing deletion">
            <p>Delete this listing permanently?</p>
            <button className="marketplace-delete-button" type="button" onClick={deleteSelectedListing}>DELETE LISTING</button>
            <button className="marketplace-status-button" type="button" onClick={() => setIsConfirmingDelete(false)}>CANCEL</button>
          </div> : <button className="marketplace-delete-button" type="button" onClick={() => setIsConfirmingDelete(true)}>DELETE LISTING</button>}
        </> : !sellerAccount && selectedListing.sellerId ? <p className="shopping-checkout-note">Sign in to confirm this item belongs to another seller before buying.</p> : <>
          <button className="primary-button shopping-checkout-button" type="button" onClick={() => { setError(''); setView('checkout'); }}>BUY ITEM · {formatPrice(selectedListing.price)}</button>
          <p className="shopping-checkout-note">Preview checkout. No payment will be processed.</p>
        </>}
        <small className="marketplace-listed-age marketplace-listed-age-detail">{formatListingAge(selectedListing.createdAt, currentTime)}</small>
      </div>
    </> : view === 'checkout' && selectedListing && canBuyListing(selectedListing) ? <form className="shopping-checkout-form" onSubmit={placeOrder}>
      <button className="shopping-back-link" type="button" onClick={() => setView('details')}>← BACK TO ITEM</button>
      <p className="shopping-checkout-summary">{selectedListing.name} · {formatPrice(selectedListing.price)}</p>
      <h3>Delivery details</h3>
      <label>FULL NAME<input name="name" autoComplete="name" required maxLength={100} /></label>
      <label>EMAIL<input name="email" type="email" autoComplete="email" required maxLength={150} /></label>
      <label>STREET ADDRESS<input name="address" autoComplete="street-address" required maxLength={150} /></label>
      <div className="shopping-checkout-row"><label>CITY<input name="city" autoComplete="address-level2" required maxLength={80} /></label><label>ZIP CODE<input name="postalCode" autoComplete="postal-code" required maxLength={12} /></label></div>
      <p className="shopping-checkout-note">Simulated purchase only. Your details are not saved and no payment or shipment is processed.</p>
      {error && <p className="marketplace-error" role="alert">{error}</p>}
      <button className="primary-button shopping-checkout-button" type="submit">PLACE PREVIEW ORDER · {formatPrice(selectedListing.price)}</button>
    </form> : view === 'confirmation' ? <div className="shopping-order-confirmation">
      <span className="shopping-order-check" aria-hidden="true">✓</span><p className="shopping-eyebrow">PREVIEW PURCHASE</p><h3>Order placed</h3><p>Your sample order <strong>{orderReference}</strong> is complete. No payment was taken and nothing will be shipped.</p><button className="primary-button" type="button" onClick={() => { setSelectedId(null); setView('browse'); }}>BACK TO MARKETPLACE</button>
    </div> : <div className="marketplace-empty"><h3>This listing is no longer available</h3><button className="primary-button" type="button" onClick={() => setView('browse')}>BACK TO MARKETPLACE</button></div>}
  </section>;
}
