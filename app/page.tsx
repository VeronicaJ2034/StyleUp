'use client';

import { useEffect, useState } from 'react';

type Tab = 'matches' | 'add';
type ClothingItem = { name: string; category: string; color: string; tone: string };
type WeatherState = { temperature: number; description: string };

const clothingItems: ClothingItem[] = [
  { name: 'Linen shirt', category: 'TOPS', color: '#E8E0D0', tone: '#9C805A' },
  { name: 'Wide-leg denim', category: 'BOTTOMS', color: '#CAD6D8', tone: '#526A6D' },
  { name: 'Everyday blazer', category: 'LAYERS', color: '#D5CEC7', tone: '#665A55' },
  { name: 'Leather loafers', category: 'SHOES', color: '#9A6B4C', tone: '#483126' },
];

const matchIdeas = [
  { title: 'Soft structure', detail: 'Linen shirt + wide-leg denim', accent: '#B8C7BD' },
  { title: 'Between seasons', detail: 'Blazer + loafers + denim', accent: '#D9B9A4' },
  { title: 'Quiet weekend', detail: 'Build a relaxed look from your closet', accent: '#D3C1A6' },
];
const categories = ['Tops', 'Bottoms', 'Layers', 'Shoes', 'Accessories'];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="stage">
      <section className="phone-frame" aria-label="StyleUp phone preview">
        <div className="device-island" aria-hidden="true" />
        <div className="phone-screen">
          {isLoading ? <LoadingScreen /> : <>
            <header className="app-header">
              <div><p className="eyebrow">YOUR DIGITAL CLOSET</p><h1>StyleUp</h1></div>
              <WeatherBadge />
            </header>
            <div className="screen-content">
              {activeTab === 'matches' ? <MatchesScreen matchIndex={matchIndex} onNext={() => setMatchIndex((current) => (current + 1) % matchIdeas.length)} /> : <AddClothingScreen />}
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
  return <div className="loading-screen"><div className="logo-placeholder">YOUR LOGO</div><p>A better way to get dressed.</p><div className="loading-line" /></div>;
}

function MatchesScreen({ matchIndex, onNext }: { matchIndex: number; onNext: () => void }) {
  const match = matchIdeas[matchIndex];
  return <>
    <div className="intro-row"><div><h2>What are we wearing?</h2><p>A few ideas, styled from what you own.</p></div><div className="sun-mark" aria-hidden="true">☼</div></div>
    <article className="match-card" style={{ backgroundColor: match.accent }}>
      <div className="match-card-topline"><span>STYLE NOTE 0{matchIndex + 1}</span><span>SPRING / 18°</span></div>
      <h3>{match.title}</h3><p>{match.detail}</p>
      <div className="outfit-preview" aria-hidden="true"><div className="preview-piece preview-top" /><div className="preview-piece preview-bottom" /><div className="preview-piece preview-shoes" /></div>
      <button className="primary-button" type="button" onClick={onNext}>SHOW ANOTHER LOOK <span aria-hidden="true">→</span></button>
    </article>
    <div className="section-heading"><h4>RECENTLY ADDED</h4><span>04 PIECES</span></div>
    <div className="item-grid">{clothingItems.map((item) => <article className="item-card" key={item.name}><div className="item-image" style={{ backgroundColor: item.color }}><div className="item-shape" style={{ backgroundColor: item.tone }} /></div><span>{item.category}</span><p>{item.name}</p></article>)}</div>
  </>;
}

function AddClothingScreen() {
  return <>
    <h2>Add to your closet</h2><p className="page-subtitle">Start with the pieces you reach for most.</p>
    <button className="upload-panel" type="button" onClick={() => window.alert('Photo upload will connect here next.')}><span className="upload-circle">+</span><strong>Upload a photo</strong><span>Take a photo or choose from your camera roll</span></button>
    <h4 className="category-heading">OR START WITH A CATEGORY</h4>
    <div className="category-list">{categories.map((category, index) => <button className="category-row" type="button" key={category} onClick={() => window.alert(`Add your first ${category.toLowerCase()} piece.`)}><span className="category-dot" style={{ backgroundColor: clothingItems[index % clothingItems.length].tone }} /><span>{category}</span><span aria-hidden="true">→</span></button>)}</div>
  </>;
}

function TabButton({ label, symbol, active, onClick }: { label: string; symbol: string; active: boolean; onClick: () => void }) {
  return <button className={`tab-button${active ? ' active' : ''}`} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}><span className="tab-symbol">{symbol}</span><span>{label}</span></button>;
}
