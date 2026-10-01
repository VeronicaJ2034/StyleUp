'use client';

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from 'react';

type Tab = 'matches' | 'add' | 'account';
type ClothingItem = { name: string; category: string; color: string; tone: string; imageUrl?: string };
type Analysis = { category: string; color: string; secondaryColor: string | null; pattern: string; style: string; formality: string };
type WeatherState = { temperature: number; description: string; rainChance: number; humidity: number; windSpeed: number; locationName: string; latitude: number; longitude: number };
type Account = { id: string; fullName: string; email: string; birthday: string; closetItems: ClothingItem[] };
type GeoSearchResult = { name: string; country?: string; admin1?: string; latitude: number; longitude: number };
type AddClothingState = { isAnalyzing: boolean; error: string; analysis: Analysis | null };
type AccountTabState = { mode: 'create' | 'signIn'; fullName: string; email: string; birthday: string; signInEmail: string; error: string };
type MatchTabState = { matchIndex: number };

const initialMatchState: MatchTabState = { matchIndex: 0 };
const initialAddClothingState: AddClothingState = { isAnalyzing: false, error: '', analysis: null };
const initialAccountTabState: AccountTabState = { mode: 'create', fullName: '', email: '', birthday: '', signInEmail: '', error: '' };
const initialScrollState: Record<Tab, number> = { matches: 0, add: 0, account: 0 };

const matchIdeas = [
  { title: 'Soft structure', detail: 'A considered look from your closet', accent: '#FFF0B8' },
  { title: 'Between seasons', detail: 'A fresh combination from what you own', accent: '#DCEAF5' },
  { title: 'Quiet weekend', detail: 'Build a relaxed look from your closet', accent: '#E6E3F2' },
];
const categories = ['Tops', 'Pants', 'Jackets', 'Shoes'];
const categoryTones = ['#8D86C0', '#7A91B2', '#A38BC0', '#8A9DB7'];
const categoryMap: Record<Analysis['category'], string> = { shirt: 'TOPS', jacket: 'JACKETS', pants: 'PANTS', shoes: 'SHOES' };

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [matchState, setMatchState] = useState<MatchTabState>(initialMatchState);
  const [addClothingState, setAddClothingState] = useState<AddClothingState>(initialAddClothingState);
  const [accountState, setAccountState] = useState<AccountTabState>(initialAccountTabState);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [scrollPositions, setScrollPositions] = useState<Record<Tab, number>>(initialScrollState);
  const screenContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const savedAccounts = window.localStorage.getItem('styleup-accounts');
    const savedAccountId = window.localStorage.getItem('styleup-active-account');
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts) as Account[]);
    if (savedAccountId) setActiveAccountId(savedAccountId);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      window.localStorage.setItem('styleup-accounts', JSON.stringify(accounts));
      if (activeAccountId) window.localStorage.setItem('styleup-active-account', activeAccountId);
      else window.localStorage.removeItem('styleup-active-account');
    }
  }, [accounts, activeAccountId, isLoading]);

  useEffect(() => {
    const element = screenContentRef.current;
    if (!element) return;
    element.scrollTop = scrollPositions[activeTab];
  }, [activeTab, scrollPositions]);

  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  const closetItems = activeAccount?.closetItems ?? [];

  function createAccount(account: Omit<Account, 'id' | 'closetItems'>) {
    const newAccount: Account = { ...account, id: `${Date.now()}`, closetItems: [] };
    setAccounts((current) => [...current, newAccount]);
    setActiveAccountId(newAccount.id);
    setActiveTab('matches');
    setAccountState((current) => ({ ...current, mode: 'signIn', fullName: '', email: '', birthday: '', signInEmail: '', error: '' }));
  }

  function updateCloset(item: ClothingItem) {
    if (!activeAccount) return;
    setAccounts((current) => current.map((account) => account.id === activeAccount.id ? { ...account, closetItems: [item, ...account.closetItems] } : account));
  }

  function signIn(accountId: string) {
    setActiveAccountId(accountId);
    setActiveTab('matches');
    setAccountState((current) => ({ ...current, signInEmail: '', error: '', mode: 'signIn' }));
  }

  function signOut() {
    setActiveAccountId('');
    setActiveTab('account');
    setAccountState((current) => ({ ...current, mode: 'signIn', error: '' }));
  }

  function handleTabChange(nextTab: Tab) {
    setActiveTab(nextTab);
  }

  return (
    <main className="stage">
      <section className="phone-frame" aria-label="StyleUp phone preview">
        <div className="device-island" aria-hidden="true" />
        <div className="phone-screen">
          {isLoading ? <LoadingScreen /> : <>
            <header className="app-header">
              <div className="brand-lockup"><img className="brand-logo" src="/StyleUpLogo.png" alt="StyleUp" /></div>
              <WeatherBadge />
            </header>
            <div
              ref={screenContentRef}
              className="screen-content"
              onScroll={() => {
                const element = screenContentRef.current;
                if (!element) return;
                setScrollPositions((current) => ({ ...current, [activeTab]: element.scrollTop }));
              }}
            >
              {activeTab === 'account' ? <AccountScreen accounts={accounts} activeAccount={activeAccount} state={accountState} setState={setAccountState} onCreate={createAccount} onSignIn={signIn} onSignOut={signOut} /> : !activeAccount ? <SignedOutScreen onOpenAccount={() => setActiveTab('account')} /> : activeTab === 'matches' ? <MatchesScreen items={closetItems} matchIndex={matchState.matchIndex} onNext={() => setMatchState((current) => ({ ...current, matchIndex: (current.matchIndex + 1) % matchIdeas.length }))} /> : <AddClothingScreen items={closetItems} state={addClothingState} setState={setAddClothingState} onItemSaved={updateCloset} />}
            </div>
            <nav className="tab-bar" aria-label="Closet sections">
              <TabButton label="MAKE A MATCH" symbol="+" active={activeTab === 'matches'} onClick={() => handleTabChange('matches')} />
              <TabButton label="ADD CLOTHING" symbol="↑" active={activeTab === 'add'} onClick={() => handleTabChange('add')} />
              <TabButton label="ACCOUNT" symbol="○" active={activeTab === 'account'} onClick={() => handleTabChange('account')} />
            </nav>
          </>}
        </div>
      </section>
    </main>
  );
}

function SignedOutScreen({ onOpenAccount }: { onOpenAccount: () => void }) {
  return <div className="empty-state"><div className="empty-mark">○</div><h2>Sign in to your closet</h2><p>Create an account so your uploaded pieces stay with you.</p><button className="primary-button" type="button" onClick={onOpenAccount}>OPEN ACCOUNT <span aria-hidden="true">→</span></button></div>;
}

function AccountScreen({ accounts, activeAccount, state, setState, onCreate, onSignIn, onSignOut }: { accounts: Account[]; activeAccount?: Account; state: AccountTabState; setState: Dispatch<SetStateAction<AccountTabState>>; onCreate: (account: Omit<Account, 'id' | 'closetItems'>) => void; onSignIn: (accountId: string) => void; onSignOut: () => void }) {
  const { mode, fullName, email, birthday, signInEmail, error } = state;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim() || !email.trim() || !birthday) {
      setState((current) => ({ ...current, error: 'Add your name, email, and birthday to continue.' }));
      return;
    }
    onCreate({ fullName: fullName.trim(), email: email.trim().toLowerCase(), birthday });
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = accounts.find((item) => item.email === signInEmail.trim().toLowerCase());
    if (!account) {
      setState((current) => ({ ...current, error: 'No local account was found for that email.' }));
      return;
    }
    setState((current) => ({ ...current, error: '' }));
    onSignIn(account.id);
  }

  return <div className="account-screen">
    <div className="account-heading"><div><p className="eyebrow">YOUR STYLE PROFILE</p><h2>{activeAccount ? activeAccount.fullName : 'Your account'}</h2></div><div className="account-avatar">{activeAccount ? activeAccount.fullName.charAt(0).toUpperCase() : '?'}</div></div>
    {activeAccount && <div className="profile-summary"><span>EMAIL<strong>{activeAccount.email}</strong></span><span>BIRTHDAY<strong>{activeAccount.birthday}</strong></span><span>CLOSET<strong>{activeAccount.closetItems.length} {activeAccount.closetItems.length === 1 ? 'piece' : 'pieces'}</strong></span><button className="secondary-button" type="button" onClick={onSignOut}>SIGN OUT</button></div>}
    <div className="account-switcher"><button className={mode === 'create' ? 'selected' : ''} type="button" onClick={() => setState((current) => ({ ...current, mode: 'create', error: '' }))}>CREATE ACCOUNT</button><button className={mode === 'signIn' ? 'selected' : ''} type="button" onClick={() => setState((current) => ({ ...current, mode: 'signIn', error: '' }))}>SIGN IN</button></div>
    {mode === 'create' ? <form className="account-form" onSubmit={handleCreate}><label>FULL NAME<input value={fullName} onChange={(event) => setState((current) => ({ ...current, fullName: event.target.value }))} placeholder="Alex Morgan" /></label><label>EMAIL<input type="email" value={email} onChange={(event) => setState((current) => ({ ...current, email: event.target.value }))} placeholder="alex@example.com" /></label><label>BIRTHDAY<input type="date" value={birthday} onChange={(event) => setState((current) => ({ ...current, birthday: event.target.value }))} /></label><button className="primary-button" type="submit">CREATE MY CLOSET <span aria-hidden="true">→</span></button></form> : <form className="account-form" onSubmit={handleSignIn}><label>EMAIL<input type="email" value={signInEmail} onChange={(event) => setState((current) => ({ ...current, signInEmail: event.target.value }))} placeholder="alex@example.com" /></label><button className="primary-button" type="submit">SIGN IN <span aria-hidden="true">→</span></button></form>}
    {error && <p className="account-error" role="alert">{error}</p>}
    <p className="account-note">Accounts are currently saved on this device. Production sign-in will need a secure auth and database service.</p>
  </div>;
}

function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [manualStatus, setManualStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [locationSuggestions, setLocationSuggestions] = useState<GeoSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);

  const loadWeatherForCoordinates = async (latitude: number, longitude: number, fallbackName?: string) => {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
        daily: 'precipitation_probability_max',
        temperature_unit: 'fahrenheit',
        timezone: 'auto',
        forecast_days: '1',
      });

      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error('Weather request failed');

      const data = await response.json();
      const locationName = fallbackName ?? (await getLocationName(latitude, longitude));
      const chanceOfRain = Number(data.daily?.precipitation_probability_max?.[0] ?? 0);

      setWeather({
        temperature: Math.round(data.current.temperature_2m),
        description: describeWeather(data.current.weather_code),
        rainChance: Number.isFinite(chanceOfRain) ? chanceOfRain : 0,
        humidity: Number(data.current.relative_humidity_2m ?? 0),
        windSpeed: Math.round(Number(data.current.wind_speed_10m ?? 0)),
        locationName: locationName === 'Your location' ? 'Approximate current location' : locationName,
        latitude,
        longitude,
      });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const loadCurrentLocationWeather = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    setPanelOpen(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      await loadWeatherForCoordinates(coords.latitude, coords.longitude, 'Approximate current location');
    }, () => {
      setStatus('error');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 });
  };

  const handleManualLocation = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const query = manualLocation.trim();
    if (!query) return;

    setManualStatus('loading');
    try {
      const requestUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const response = await fetch(requestUrl);
      if (!response.ok) throw new Error('Location lookup failed');
      const data = await response.json();
      const result: GeoSearchResult | undefined = data.results?.[0];
      if (!result) throw new Error('Location not found');

      const locationName = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
      await loadWeatherForCoordinates(result.latitude, result.longitude, locationName);
      setManualLocation('');
      setManualStatus('idle');
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } catch {
      setManualStatus('error');
    }
  };

  useEffect(() => {
    const query = manualLocation.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingLocations(true);
      try {
        const requestUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error('Location lookup failed');
        const data = await response.json();
        setLocationSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocations(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [manualLocation]);

  useEffect(() => {
    void loadCurrentLocationWeather();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh((value) => value + 1), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const label = status === 'ready' ? weather?.description ?? 'LOCAL WEATHER' : status === 'loading' ? 'YOUR AREA' : 'TAP TO RETRY';
  return (
    <div className="weather-wrapper">
      <button
        className="weather-badge"
        type="button"
        onClick={() => {
          setPanelOpen((value) => !value);
          if (status === 'error') {
            setStatus('loading');
            setRefresh((value) => value + 1);
          }
        }}
        aria-expanded={panelOpen}
        aria-label={status === 'ready' && weather ? `${weather.temperature} degrees, ${weather.description} in your location` : 'Get weather for your location'}
        title={status === 'error' ? 'Allow location access to see local weather' : 'Current weather at your location'}
      >
        <strong>{weather ? `${weather.temperature}°F` : status === 'loading' ? '···' : '—'}</strong>
        <span>{label}</span>
      </button>

      {panelOpen && (
        <div className="weather-panel" role="dialog" aria-label="Weather details and location controls">
          <div className="weather-panel-header">
            <div className="weather-panel-location">
              <p className="weather-label">CURRENT LOCATION</p>
              <h3>{weather?.locationName ?? 'Local conditions'}</h3>
              <small>Approximate based on your device location</small>
            </div>
            <button type="button" className="close-panel" onClick={() => setPanelOpen(false)} aria-label="Close weather details">×</button>
          </div>

          {status === 'ready' && weather ? (
            <>
              <div className="weather-panel-snapshot">
                <div>
                  <span className="weather-mini-label">NOW</span>
                  <strong>{weather.temperature}°F</strong>
                </div>
                <div>
                  <span className="weather-mini-label">OUTLOOK</span>
                  <strong>{weather.description}</strong>
                </div>
              </div>

              <div className="weather-panel-grid">
                <span>RAIN CHANCE<strong>{weather.rainChance}%</strong></span>
                <span>HUMIDITY<strong>{weather.humidity}%</strong></span>
                <span>WIND<strong>{weather.windSpeed} mph</strong></span>
                <span>COORDS<strong>{weather.latitude.toFixed(2)}, {weather.longitude.toFixed(2)}</strong></span>
              </div>
            </>
          ) : (
            <p className="weather-empty">Weather details are unavailable right now.</p>
          )}

          <form className="weather-form" onSubmit={handleManualLocation}>
            <label>
              CHANGE LOCATION
              <div className="location-input-wrap">
                <input
                  value={manualLocation}
                  onChange={(event) => setManualLocation(event.target.value)}
                  onFocus={() => setShowSuggestions(manualLocation.trim().length >= 2)}
                  onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                  placeholder="Search a city or area"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions}
                />
                {showSuggestions && (
                  <ul className="location-suggestions" role="listbox">
                    {isSearchingLocations ? (
                      <li className="location-suggestion muted">Searching…</li>
                    ) : locationSuggestions.length > 0 ? (
                      locationSuggestions.map((suggestion) => {
                        const label = [suggestion.name, suggestion.admin1, suggestion.country].filter(Boolean).join(', ');
                        return (
                          <li key={`${label}-${suggestion.latitude}-${suggestion.longitude}`} className="location-suggestion" role="option" onMouseDown={() => {
                            setManualLocation(label);
                            setLocationSuggestions([]);
                            setShowSuggestions(false);
                            void (async () => {
                              const locationName = [suggestion.name, suggestion.admin1, suggestion.country].filter(Boolean).join(', ');
                              setManualStatus('loading');
                              await loadWeatherForCoordinates(suggestion.latitude, suggestion.longitude, locationName);
                              setManualStatus('idle');
                            })();
                          }}>
                            {label}
                          </li>
                        );
                      })
                    ) : (
                      <li className="location-suggestion muted">No matches found</li>
                    )}
                  </ul>
                )}
              </div>
            </label>
            <div className="weather-form-actions">
              <button type="submit" className="primary-button small-button">UPDATE LOCATION</button>
              <button type="button" className="secondary-button small-button" onClick={loadCurrentLocationWeather}>USE MY LOCATION</button>
            </div>
            {manualStatus === 'error' && <p className="account-error">We couldn’t find that location. Try another city or area.</p>}
          </form>
        </div>
      )}
    </div>
  );
}

async function getLocationName(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`);
    if (!response.ok) return 'Your location';
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return 'Your location';
    return [result.name, result.admin1, result.country].filter(Boolean).join(', ');
  } catch {
    return 'Your location';
  }
}

function describeWeather(code: number): string {
  if (code === 0) return 'CLEAR';
  if ([1, 2, 3].includes(code)) return 'CLOUDY';
  if ([45, 48].includes(code)) return 'FOGGY';
  if ([51, 53, 55, 56, 57].includes(code)) return 'DRIZZLE';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'RAINY';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'SNOWY';
  if ([95, 96, 99].includes(code)) return 'STORMY';
  return 'LOCAL WEATHER';
}

function LoadingScreen() {
  return <div className="loading-screen"><img className="loading-logo" src="/StyleUpLogo.png" alt="StyleUp" /><p>A better way to get dressed.</p><div className="loading-line" /></div>;
}

function MatchesScreen({ items, matchIndex, onNext }: { items: ClothingItem[]; matchIndex: number; onNext: () => void }) {
  if (items.length === 0) return <div className="empty-state"><div className="empty-mark">+</div><h2>Your closet is waiting</h2><p>Upload a clothing photo to start making matches from pieces you own.</p></div>;

  const match = matchIdeas[matchIndex];
  return <>
    <div className="intro-row"><div><h2>What are we wearing?</h2><p>A few ideas, styled from what you own.</p></div><div className="sun-mark" aria-hidden="true">☼</div></div>
    <article className="match-card" style={{ backgroundColor: match.accent }}>
      <div className="match-card-topline"><span>STYLE NOTE 0{matchIndex + 1}</span><span>SPRING / 18°</span></div>
      <h3>{match.title}</h3><p>{match.detail}</p>
      <div className="outfit-preview" aria-hidden="true"><div className="preview-piece preview-top" /><div className="preview-piece preview-bottom" /><div className="preview-piece preview-shoes" /></div>
      <button className="primary-button" type="button" onClick={onNext}>SHOW ANOTHER LOOK <span aria-hidden="true">→</span></button>
    </article>
    <div className="section-heading"><h4>YOUR CLOSET</h4><span>{String(items.length).padStart(2, '0')} PIECES</span></div>
    <div className="item-grid">{items.map((item) => <ClothingCard item={item} key={`${item.name}-${item.imageUrl || item.color}`} />)}</div>
  </>;
}

function ClothingCard({ item }: { item: ClothingItem }) {
  return <article className="item-card"><div className={`item-image${item.imageUrl ? ' has-photo' : ''}`} style={{ backgroundColor: item.color, backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }}><div className="item-shape" style={{ backgroundColor: item.tone }} /></div><span>{item.category}</span><p>{item.name}</p></article>;
}

function AddClothingScreen({ items, state, setState, onItemSaved }: { items: ClothingItem[]; state: AddClothingState; setState: Dispatch<SetStateAction<AddClothingState>>; onItemSaved: (item: ClothingItem) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAnalyzing, error, analysis } = state;

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setState((current) => ({ ...current, isAnalyzing: true, error: '', analysis: null }));

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/analyze-clothing', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to analyze that photo.');
      const imageUrl = await readImage(file);
      setState((current) => ({ ...current, analysis: result, isAnalyzing: false, error: '' }));
      onItemSaved({ name: `${result.color} ${result.category}`, category: categoryMap[result.category as Analysis['category']], color: '#E8E0D0', tone: '#9C805A', imageUrl });
    } catch (uploadError) {
      setState((current) => ({ ...current, error: uploadError instanceof Error ? uploadError.message : 'Unable to analyze that photo.', isAnalyzing: false }));
    } finally {
      event.target.value = '';
    }
  }

  return <>
    <h2>Add to your closet</h2><p className="page-subtitle">Start with the pieces you reach for most.</p>
    <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleUpload} />
    <button className={`upload-panel${isAnalyzing ? ' analyzing' : ''}`} type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}>
      <span className="upload-circle">{isAnalyzing ? '…' : '+'}</span>
      <strong>{isAnalyzing ? 'Reading your piece' : 'Upload a photo'}</strong>
      <span>{isAnalyzing ? 'StyleUp is identifying the details' : 'Take a photo or choose from your camera roll'}</span>
    </button>
    {error && <p className="upload-error" role="alert">{error}</p>}
    {analysis && <article className="analysis-result"><div><span className="result-label">STYLEUP FOUND</span><h3>{analysis.category}</h3></div><div className="result-grid"><span>COLOR<strong>{analysis.color}</strong></span><span>STYLE<strong>{analysis.style}</strong></span><span>PATTERN<strong>{analysis.pattern}</strong></span><span>FORMALITY<strong>{analysis.formality}</strong></span></div><button className="primary-button" type="button" onClick={() => setState((current) => ({ ...current, analysis: null }))}>ADD ANOTHER PHOTO <span aria-hidden="true">+</span></button></article>}
    <div className="category-heading-row"><h4 className="category-heading">YOUR CLOSET BY CATEGORY</h4><span>PHOTO-SORTED</span></div>
    <div className="category-list">{categories.map((category, index) => { const categoryItems = items.filter((item) => item.category === category.toUpperCase()); return <section className="category-section" key={category}><button className="category-row" type="button" onClick={() => fileInputRef.current?.click()}><span className="category-dot" style={{ backgroundColor: categoryTones[index] }} /><span>{category}<small>{categoryItems.length ? `${categoryItems.length} ${categoryItems.length === 1 ? 'piece' : 'pieces'}` : 'Ready for your first piece'}</small></span><span aria-hidden="true">+</span></button>{categoryItems.length > 0 && <div className="category-items">{categoryItems.map((item) => <ClothingCard item={item} key={`${item.name}-${item.imageUrl || item.color}`} />)}</div>}</section>; })}</div>
  </>;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The photo could not be saved.'));
    reader.readAsDataURL(file);
  });
}

function TabButton({ label, symbol, active, onClick }: { label: string; symbol: string; active: boolean; onClick: () => void }) {
  return <button className={`tab-button${active ? ' active' : ''}`} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}><span className="tab-symbol">{symbol}</span><span>{label}</span></button>;
}
