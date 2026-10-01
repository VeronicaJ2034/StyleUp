'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

type Tab = 'matches' | 'add' | 'account';
type ClothingItem = { name: string; category: string; color: string; tone: string; imageUrl?: string };
type Analysis = { category: string; color: string; secondaryColor: string | null; pattern: string; style: string; formality: string };
type WeatherState = { temperature: number; description: string };
type Account = { id: string; fullName: string; email: string; birthday: string; closetItems: ClothingItem[] };

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
  const [matchIndex, setMatchIndex] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState('');

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

  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  const closetItems = activeAccount?.closetItems ?? [];

  function createAccount(account: Omit<Account, 'id' | 'closetItems'>) {
    const newAccount: Account = { ...account, id: `${Date.now()}`, closetItems: [] };
    setAccounts((current) => [...current, newAccount]);
    setActiveAccountId(newAccount.id);
    setActiveTab('matches');
  }

  function updateCloset(item: ClothingItem) {
    if (!activeAccount) return;
    setAccounts((current) => current.map((account) => account.id === activeAccount.id ? { ...account, closetItems: [item, ...account.closetItems] } : account));
  }

  function removeFromCloset(item: ClothingItem) {
    if (!activeAccount || !window.confirm(`Remove ${item.name} from your closet?`)) return;
    setAccounts((current) => current.map((account) => account.id === activeAccount.id
      ? { ...account, closetItems: account.closetItems.filter((closetItem) => closetItem !== item) }
      : account));
  }

  function signIn(accountId: string) {
    setActiveAccountId(accountId);
    setActiveTab('matches');
  }

  function signOut() {
    setActiveAccountId('');
    setActiveTab('account');
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
            <div className="screen-content">
              {activeTab === 'account' ? <AccountScreen accounts={accounts} activeAccount={activeAccount} onCreate={createAccount} onSignIn={signIn} onSignOut={signOut} /> : !activeAccount ? <SignedOutScreen onOpenAccount={() => setActiveTab('account')} /> : activeTab === 'matches' ? <MatchesScreen items={closetItems} matchIndex={matchIndex} onNext={() => setMatchIndex((current) => (current + 1) % matchIdeas.length)} onRemove={removeFromCloset} /> : <AddClothingScreen items={closetItems} onItemSaved={updateCloset} onRemove={removeFromCloset} />}
            </div>
            <nav className="tab-bar" aria-label="Closet sections">
              <TabButton label="MAKE A MATCH" symbol="+" active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} />
              <TabButton label="ADD CLOTHING" symbol="↑" active={activeTab === 'add'} onClick={() => setActiveTab('add')} />
              <TabButton label="ACCOUNT" symbol="○" active={activeTab === 'account'} onClick={() => setActiveTab('account')} />
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

function AccountScreen({ accounts, activeAccount, onCreate, onSignIn, onSignOut }: { accounts: Account[]; activeAccount?: Account; onCreate: (account: Omit<Account, 'id' | 'closetItems'>) => void; onSignIn: (accountId: string) => void; onSignOut: () => void }) {
  const [mode, setMode] = useState<'create' | 'signIn'>('create');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeAccount || accounts.length > 0) setMode('signIn');
  }, [activeAccount, accounts.length]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim() || !email.trim() || !birthday) { setError('Add your name, email, and birthday to continue.'); return; }
    onCreate({ fullName: fullName.trim(), email: email.trim().toLowerCase(), birthday });
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = accounts.find((item) => item.email === signInEmail.trim().toLowerCase());
    if (!account) { setError('No local account was found for that email.'); return; }
    setError('');
    onSignIn(account.id);
  }

  return <div className="account-screen">
    <div className="account-heading"><div><p className="eyebrow">YOUR STYLE PROFILE</p><h2>{activeAccount ? activeAccount.fullName : 'Your account'}</h2></div><div className="account-avatar">{activeAccount ? activeAccount.fullName.charAt(0).toUpperCase() : '?'}</div></div>
    {activeAccount && <div className="profile-summary"><span>EMAIL<strong>{activeAccount.email}</strong></span><span>BIRTHDAY<strong>{activeAccount.birthday}</strong></span><span>CLOSET<strong>{activeAccount.closetItems.length} {activeAccount.closetItems.length === 1 ? 'piece' : 'pieces'}</strong></span><button className="secondary-button" type="button" onClick={onSignOut}>SIGN OUT</button></div>}
    <div className="account-switcher"><button className={mode === 'create' ? 'selected' : ''} type="button" onClick={() => { setMode('create'); setError(''); }}>CREATE ACCOUNT</button><button className={mode === 'signIn' ? 'selected' : ''} type="button" onClick={() => { setMode('signIn'); setError(''); }}>SIGN IN</button></div>
    {mode === 'create' ? <form className="account-form" onSubmit={handleCreate}><label>FULL NAME<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex Morgan" /></label><label>EMAIL<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" /></label><label>BIRTHDAY<input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></label><button className="primary-button" type="submit">CREATE MY CLOSET <span aria-hidden="true">→</span></button></form> : <form className="account-form" onSubmit={handleSignIn}><label>EMAIL<input type="email" value={signInEmail} onChange={(event) => setSignInEmail(event.target.value)} placeholder="alex@example.com" /></label><button className="primary-button" type="submit">SIGN IN <span aria-hidden="true">→</span></button></form>}
    {error && <p className="account-error" role="alert">{error}</p>}
    <p className="account-note">Accounts are currently saved on this device. Production sign-in will need a secure auth and database service.</p>
  </div>;
}

function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadWeather = async () => {
      if (!navigator.geolocation) {
        setStatus('error');
        return;
      }

      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
            current: 'temperature_2m,weather_code',
            temperature_unit: 'fahrenheit',
            timezone: 'auto',
          });
          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
          if (!response.ok) throw new Error('Weather request failed');

          const data = await response.json();
          if (!isActive) return;
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            description: describeWeather(data.current.weather_code),
          });
          setStatus('ready');
        } catch {
          if (isActive) setStatus('error');
        }
      }, () => {
        if (isActive) setStatus('error');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 });
    };

    void loadWeather();
    return () => { isActive = false; };
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh((value) => value + 1), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const label = status === 'ready' ? weather?.description ?? 'LOCAL WEATHER' : status === 'loading' ? 'YOUR AREA' : 'TAP TO RETRY';
  return (
    <button
      className="weather-badge"
      type="button"
      onClick={() => { if (status === 'error') { setStatus('loading'); setRefresh((value) => value + 1); } }}
      aria-label={status === 'ready' && weather ? `${weather.temperature} degrees, ${weather.description} in your location` : 'Get weather for your location'}
      title={status === 'error' ? 'Allow location access to see local weather' : 'Current weather at your location'}
    >
      <strong>{weather ? `${weather.temperature}°F` : status === 'loading' ? '···' : '—'}</strong>
      <span>{label}</span>
    </button>
  );
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

function MatchesScreen({ items, matchIndex, onNext, onRemove }: { items: ClothingItem[]; matchIndex: number; onNext: () => void; onRemove: (item: ClothingItem) => void }) {
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
    <div className="item-grid">{items.map((item) => <ClothingCard item={item} key={`${item.name}-${item.imageUrl || item.color}`} onRemove={onRemove} />)}</div>
  </>;
}

function ClothingCard({ item, onRemove }: { item: ClothingItem; onRemove: (item: ClothingItem) => void }) {
  return <article className="item-card"><div className={`item-image${item.imageUrl ? ' has-photo' : ''}`} style={{ backgroundColor: item.color, backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }}><div className="item-shape" style={{ backgroundColor: item.tone }} /><button className="remove-item-button" type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.name} from your closet`} title="Remove from closet">×</button></div><span>{item.category}</span><p>{item.name}</p></article>;
}

function AddClothingScreen({ items, onItemSaved, onRemove }: { items: ClothingItem[]; onItemSaved: (item: ClothingItem) => void; onRemove: (item: ClothingItem) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/analyze-clothing', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to analyze that photo.');
      const imageUrl = await readImage(file);
      setAnalysis(result);
      onItemSaved({ name: `${result.color} ${result.category}`, category: categoryMap[result.category as Analysis['category']], color: '#E8E0D0', tone: '#9C805A', imageUrl });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to analyze that photo.');
    } finally {
      setIsAnalyzing(false);
      event.target.value = '';
    }
  }

  return <>
    <h2 className="add-page-heading">Add to your closet</h2><p className="page-subtitle">Start with the pieces you reach for most.</p>
    <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleUpload} />
    <button className={`upload-panel${isAnalyzing ? ' analyzing' : ''}`} type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}>
      <span className="upload-circle">{isAnalyzing ? '…' : '+'}</span>
      <strong>{isAnalyzing ? 'Reading your piece' : 'Upload a photo'}</strong>
      <span>{isAnalyzing ? 'StyleUp is identifying the details' : 'Take a photo or choose from your camera roll'}</span>
    </button>
    {error && <p className="upload-error" role="alert">{error}</p>}
    {analysis && <article className="analysis-result"><div><span className="result-label">STYLEUP FOUND</span><h3>{analysis.category}</h3></div><div className="result-grid"><span>COLOR<strong>{analysis.color}</strong></span><span>STYLE<strong>{analysis.style}</strong></span><span>PATTERN<strong>{analysis.pattern}</strong></span><span>FORMALITY<strong>{analysis.formality}</strong></span></div><button className="primary-button" type="button" onClick={() => setAnalysis(null)}>ADD ANOTHER PHOTO <span aria-hidden="true">+</span></button></article>}
    <div className="category-heading-row"><h4 className="category-heading">YOUR CLOSET BY CATEGORY</h4><span>PHOTO-SORTED</span></div>
    <div className="category-list">{categories.map((category, index) => { const categoryItems = items.filter((item) => item.category === category.toUpperCase()); return <section className="category-section" key={category}><button className="category-row" type="button" onClick={() => fileInputRef.current?.click()}><span className="category-dot" style={{ backgroundColor: categoryTones[index] }} /><span>{category}<small>{categoryItems.length ? `${categoryItems.length} ${categoryItems.length === 1 ? 'piece' : 'pieces'}` : 'Ready for your first piece'}</small></span><span aria-hidden="true">+</span></button>{categoryItems.length > 0 && <div className="category-items">{categoryItems.map((item) => <ClothingCard item={item} key={`${item.name}-${item.imageUrl || item.color}`} onRemove={onRemove} />)}</div>}</section>; })}</div>
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
