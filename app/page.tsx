'use client';

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from 'react';
import ProfileAccount from '../components/ProfileAccount';
import { supabase } from '../lib/supabase';

type Tab = 'matches' | 'add';
type ClothingItem = { id?: string; name: string; category: string; color: string; tone: string; imageUrl?: string };
type Analysis = { category: string; color: string; secondaryColor: string | null; pattern: string; style: string; formality: string };
type WeatherState = { temperature: number; description: string; rainChance: number; humidity: number; windSpeed: number; locationName: string; latitude: number; longitude: number };
type GeoSearchResult = { name: string; country?: string; admin1?: string; latitude: number; longitude: number };
type AddClothingState = { isAnalyzing: boolean; error: string; analysis: Analysis | null };

const initialAddClothingState: AddClothingState = { isAnalyzing: false, error: '', analysis: null };

const matchIdeas = [
  { title: 'Soft structure', detail: 'A considered look from your closet', accent: '#FFF0B8' },
  { title: 'Between seasons', detail: 'A fresh combination from what you own', accent: '#DCEAF5' },
  { title: 'Quiet weekend', detail: 'Build a relaxed look from your closet', accent: '#E6E3F2' },
];
const categories = ['Tops', 'Pants', 'Jackets', 'Shoes'];
const categoryTones = ['#8D86C0', '#7A91B2', '#A38BC0', '#8A9DB7'];
const categoryMap: Record<Analysis['category'], string> = { shirt: 'TOPS', jacket: 'JACKETS', pants: 'PANTS', shoes: 'SHOES' };

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getClosetPhotoPath(imageUrl?: string) {
  const publicPath = '/storage/v1/object/public/closet-photos/';
  const pathStart = imageUrl?.indexOf(publicPath) ?? -1;
  if (!imageUrl || pathStart < 0) return null;
  return decodeURIComponent(imageUrl.slice(pathStart + publicPath.length).split('?')[0]);
}

function normalizeCategory(value: string) {
  return value.trim().toUpperCase();
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [matchIndex, setMatchIndex] = useState(0);
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [addClothingState, setAddClothingState] = useState<AddClothingState>(initialAddClothingState);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false);

  const refreshCloset = async (currentUserId: string | null) => {
    const client = supabase;
    if (!client || !currentUserId) {
      const savedItems = window.localStorage.getItem('styleup-closet');
      if (savedItems) {
        const parsedItems = JSON.parse(savedItems) as ClothingItem[];
        setClosetItems(parsedItems.filter((item) => item.imageUrl));
      } else {
        setClosetItems([]);
      }
      return;
    }

    const { data, error } = await client
      .from('closet_items')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading closet items:', error.message);
      setClosetItems([]);
      return;
    }

    const mappedRows = (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      category: normalizeCategory(String(item.category ?? '')),
      color: item.color,
      tone: item.tone,
      imageUrl: item.image_url ?? undefined,
    }));

    if (mappedRows.length > 0) {
      setClosetItems(mappedRows);
      return;
    }

    const { data: userData } = await client.auth.getUser();
    const fallbackUserId = userData.user?.id ?? currentUserId;
    const { data: bucketFiles, error: bucketError } = await client.storage.from('closet-photos').list(fallbackUserId ?? '', { limit: 200 });
    if (bucketError || !bucketFiles) {
      setClosetItems([]);
      return;
    }

    const bucketItems = bucketFiles
      .filter((file) => file.name && !file.name.startsWith('.'))
      .map((file) => {
        const fullPath = fallbackUserId ? `${fallbackUserId}/${file.name}` : file.name;
        const { data: publicData } = client.storage.from('closet-photos').getPublicUrl(fullPath);
        return {
          id: file.id ?? file.name,
          name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
          category: 'SHOES',
          color: '#E8E0D0',
          tone: '#9C805A',
          imageUrl: publicData.publicUrl,
        };
      });

    setClosetItems(bucketItems);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isActive = true;

    const syncSession = async () => {
      const { data: { session } } = await client.auth.getSession();
      if (!isActive) return;
      const activeUserId = session?.user?.id ?? null;
      setUserId(activeUserId);
      void refreshCloset(activeUserId);
    };

    void syncSession();

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      const activeUserId = session?.user?.id ?? null;
      setUserId(activeUserId);
      void refreshCloset(activeUserId);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || userId) return;

    const savedItems = window.localStorage.getItem('styleup-closet');
    if (savedItems) {
      const parsedItems = JSON.parse(savedItems) as ClothingItem[];
      setClosetItems(parsedItems.filter((item) => item.imageUrl));
    } else {
      setClosetItems([]);
    }
  }, [userId]);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) {
      if (!isLoading) window.localStorage.setItem('styleup-closet', JSON.stringify(closetItems));
      return;
    }

    let isActive = true;

    const loadCloset = async () => {
      if (!isActive) return;
      await refreshCloset(userId);
    };

    void loadCloset();
    return () => { isActive = false; };
  }, [isLoading, userId]);

  async function saveClosetItem(item: ClothingItem) {
    const client = supabase;
    if (!client) {
      setClosetItems((current) => [item, ...current]);
      return;
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    const currentUserId = userData.user?.id ?? userId;

    if (!currentUserId) {
      setClosetItems((current) => [item, ...current]);
      return;
    }

    const record = {
      id: item.id ?? makeId(),
      user_id: currentUserId,
      name: item.name,
      category: normalizeCategory(item.category),
      color: item.color,
      tone: item.tone,
      image_url: item.imageUrl ?? null,
    };

    if (userError) {
      console.error('Error getting user for closet save:', userError.message);
    }

    const { error } = await client.from('closet_items').insert(record).select();
    if (error) {
      console.error('Error saving closet item:', error.message);
      return;
    }

    const { data } = await client
      .from('closet_items')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    setClosetItems((data ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: normalizeCategory(String(entry.category ?? '')),
      color: entry.color,
      tone: entry.tone,
      imageUrl: entry.image_url ?? undefined,
    })));
  }

  async function deleteClosetItem(item: ClothingItem) {
    const client = supabase;
    if (client && userId && item.id) {
      const { error } = await client.from('closet_items').delete().eq('id', item.id).eq('user_id', userId);
      if (error) {
        console.error('Error deleting closet item:', error.message);
        return;
      }

      const photoPath = getClosetPhotoPath(item.imageUrl);
      if (photoPath) {
        const { error: photoError } = await client.storage.from('closet-photos').remove([photoPath]);
        if (photoError) console.error('Error deleting closet photo:', photoError.message);
      }
    }

    setClosetItems((current) => current.filter((currentItem) => item.id ? currentItem.id !== item.id : currentItem !== item));
  }

  useEffect(() => {
    setIsDarkMode(window.localStorage.getItem('styleup-theme') === 'dark');
    setHasLoadedTheme(true);
  }, []);

  useEffect(() => {
    if (hasLoadedTheme) window.localStorage.setItem('styleup-theme', isDarkMode ? 'dark' : 'light');
  }, [hasLoadedTheme, isDarkMode]);

  return (
    <main className="stage">
      <section className="phone-frame" aria-label="StyleUp phone preview">
        <div className="device-island" aria-hidden="true" />
        <div className={`phone-screen${isDarkMode ? ' dark-mode' : ''}`}>
          {isLoading ? <LoadingScreen /> : <>
            <header className="app-header">
              <div className="brand-lockup"><ProfileAccount /></div>
              <div className="header-actions">
                <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode((current) => !current)} />
                <WeatherBadge />
              </div>
            </header>
            <div className="screen-content">
              {activeTab === 'matches' ? <MatchesScreen items={closetItems} userId={userId} matchIndex={matchIndex} onNext={() => setMatchIndex((current) => (current + 1) % matchIdeas.length)} onDelete={deleteClosetItem} /> : <AddClothingScreen items={closetItems} userId={userId} state={addClothingState} setState={setAddClothingState} onDelete={deleteClosetItem} onItemSaved={async (item) => {
                const savedItem = { ...item, id: item.id ?? makeId() };
                if (!supabase) {
                  setClosetItems((current) => [savedItem, ...current]);
                  return;
                }

                const { data: userData } = await supabase.auth.getUser();
                if (!userData.user) {
                  setClosetItems((current) => [savedItem, ...current]);
                  return;
                }

                await saveClosetItem(savedItem);
              }} />}
            </div>
            <nav className="tab-bar" aria-label="Closet sections">
              <TabButton label="MAKE A MATCH" symbol="+" active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} />
              <TabButton label="ADD CLOTHING" symbol="↑" active={activeTab === 'add'} onClick={() => setActiveTab('add')} />
            </nav>
          </>}
        </div>
      </section>
    </main>
  );
}

function ThemeToggle({ isDarkMode, onToggle }: { isDarkMode: boolean; onToggle: () => void }) {
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      aria-pressed={isDarkMode}
      title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      <span aria-hidden="true">{isDarkMode ? '☾' : '☼'}</span>
    </button>
  );
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

  const loadCurrentLocationWeather = (openPanel = true) => {
    setPanelOpen(openPanel);
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    setStatus('loading');
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
      setPanelOpen(false);
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
                              setPanelOpen(false);
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
              <button type="button" className="secondary-button small-button" onClick={() => loadCurrentLocationWeather(false)}>USE MY LOCATION</button>
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

function MatchesScreen({ items, userId, matchIndex, onNext, onDelete }: { items: ClothingItem[]; userId: string | null; matchIndex: number; onNext: () => void; onDelete: (item: ClothingItem) => Promise<void> }) {
  if (items.length === 0) return <div className="empty-state"><div className="empty-mark">+</div><h2>Your closet is waiting</h2><p>Upload a clothing photo to start making matches from pieces you own.</p><p className="debug-session">Signed in: {userId ? 'yes' : 'no'} {userId ? `• user ${userId.slice(0, 8)}` : ''} • closet rows: {items.length}</p></div>;

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
    <div className="item-grid">{items.map((item) => <ClothingCard item={item} onDelete={onDelete} key={`${item.name}-${item.imageUrl || item.color}`} />)}</div>
  </>;
}

function ClothingCard({ item, onDelete }: { item: ClothingItem; onDelete: (item: ClothingItem) => Promise<void> }) {
  return <article className="item-card"><div className={`item-image${item.imageUrl ? ' has-photo' : ''}`} style={{ backgroundColor: item.color, backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }}><div className="item-shape" style={{ backgroundColor: item.tone }} /><button className="remove-item-button" type="button" onClick={() => void onDelete(item)} aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`}>×</button></div><span>{item.category}</span><p>{item.name}</p></article>;
}

function AddClothingScreen({ items, userId, state, setState, onDelete, onItemSaved }: { items: ClothingItem[]; userId: string | null; state: AddClothingState; setState: Dispatch<SetStateAction<AddClothingState>>; onDelete: (item: ClothingItem) => Promise<void>; onItemSaved: (item: ClothingItem) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  function toggleCategory(category: string) {
    setExpandedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

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

      let imageUrl = '';
      if (supabase) {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (user) {
          const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9-_\.]/g, '-')}`;
          const { error: uploadError } = await supabase.storage
            .from('closet-photos')
            .upload(fileName, file, { upsert: true, cacheControl: '3600', contentType: file.type });

          if (uploadError) throw new Error(uploadError.message);

          const { data } = supabase.storage.from('closet-photos').getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        } else {
          imageUrl = await readImage(file);
        }
      } else {
        imageUrl = await readImage(file);
      }

      setState((current) => ({ ...current, analysis: result, isAnalyzing: false, error: '' }));
      onItemSaved({ name: `${result.color} ${result.category}`, category: normalizeCategory(categoryMap[result.category as Analysis['category']]), color: '#E8E0D0', tone: '#9C805A', imageUrl });
    } catch (uploadError) {
      setState((current) => ({ ...current, error: uploadError instanceof Error ? uploadError.message : 'Unable to analyze that photo.', isAnalyzing: false }));
    } finally {
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
    <div className="category-heading-row"><h4 className="category-heading">YOUR CLOSET BY CATEGORY</h4></div>
    <div className="category-list">{categories.map((category, index) => { const categoryItems = items.filter((item) => item.category === category.toUpperCase()); const isExpanded = expandedCategories.includes(category); const categoryId = `category-${category.toLowerCase()}`; return <section className="category-section" key={category}><button className="category-row" type="button" onClick={() => toggleCategory(category)} aria-expanded={isExpanded} aria-controls={categoryId}><span className="category-dot" style={{ backgroundColor: categoryTones[index] }} /><span>{category}<small>{categoryItems.length ? `${categoryItems.length} ${categoryItems.length === 1 ? 'piece' : 'pieces'}` : 'Ready for your first piece'}</small></span><span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button>{isExpanded && <div className="category-items" id={categoryId}>{categoryItems.length ? categoryItems.map((item) => <ClothingCard item={item} key={`${item.name}-${item.imageUrl || item.color}`} onDelete={onDelete} />) : <p className="category-empty">No {category.toLowerCase()} in your closet yet.</p>}</div>}</section>; })}</div>
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
