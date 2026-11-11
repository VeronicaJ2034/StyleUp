'use client';

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useId, useRef, useState } from 'react';
import ProfileAccount from '../components/ProfileAccount';
import ShoppingScreen from '../components/ShoppingScreen';
import { supabase } from '../lib/supabase';

type Tab = 'matches' | 'shopping' | 'outfits' | 'add' | 'friends' | 'try-on';
type ClothingItem = { id?: string; recordId?: string; name: string; category: string; color: string; tone: string; imageUrl?: string };
type Analysis = { category: string; color: string; secondaryColor: string | null; pattern: string; style: string; formality: string };
type OutfitRecommendation = { title: string; description: string; itemIds: string[] };
type AddClothingState = { isAnalyzing: boolean; error: string; analysis: Analysis | null };

const initialAddClothingState: AddClothingState = { isAnalyzing: false, error: '', analysis: null };

const categories = ['Tops', 'Pants', 'Jackets', 'Shoes'];
const categoryTones = ['#8D86C0', '#7A91B2', '#A38BC0', '#8A9DB7'];
const categoryMap: Record<Analysis['category'], string> = { shirt: 'TOPS', jacket: 'JACKETS', pants: 'PANTS', shoes: 'SHOES' };

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getFileHash(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
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

function summarizeOutfitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const details = message.toLowerCase();
  if (
    details.includes('quota')
    || details.includes('resource_exhausted')
    || details.includes('rate limit')
    || details.includes('high demand')
    || details.includes('temporarily unavailable')
    || details.includes('service unavailable')
    || details.includes('503')
  ) {
    return 'The AI service is temporarily busy or unavailable. Please try creating outfit recommendations again in a moment.';
  }
  if (details.includes('network') || details.includes('timeout') || details.includes('connection') || details.includes('unusable')) {
    return 'The outfit service could not be reached. Please try again later.';
  }
  return 'We could not create outfit recommendations. Please try again later.';
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [addClothingState, setAddClothingState] = useState<AddClothingState>(initialAddClothingState);
  const [outfitRecommendations, setOutfitRecommendations] = useState<OutfitRecommendation[]>([]);
  const [isGeneratingOutfits, setIsGeneratingOutfits] = useState(false);
  const [outfitError, setOutfitError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(['Instagram']);

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
      recordId: item.id,
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

    if (item.imageUrl) {
      const { data: existingItems, error: duplicateCheckError } = await client
        .from('closet_items')
        .select('id, image_url')
        .eq('user_id', currentUserId);

      if (duplicateCheckError) {
        throw new Error(`Unable to check your closet before saving: ${duplicateCheckError.message}`);
      } else {
        const itemPhotoPath = getClosetPhotoPath(item.imageUrl);
        const existingItem = itemPhotoPath
          ? existingItems.find((existing) => getClosetPhotoPath(existing.image_url) === itemPhotoPath)
          : undefined;
        if (existingItem) {
          const { error: updateError } = await client
            .from('closet_items')
            .update({
              name: item.name,
              category: normalizeCategory(item.category),
              color: item.color,
              tone: item.tone,
              image_url: item.imageUrl,
            })
            .eq('id', existingItem.id)
            .eq('user_id', currentUserId);

          if (updateError) {
            throw new Error(`Unable to update this closet item: ${updateError.message}`);
          }

          await refreshCloset(currentUserId);
          return;
        }
      }
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
      throw new Error(`Unable to save this closet item: ${error.message}`);
    }

    const { data, error: refreshError } = await client
      .from('closet_items')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (refreshError) {
      throw new Error(`The item was saved, but the closet could not be refreshed: ${refreshError.message}`);
    }

    setClosetItems((data ?? []).map((entry) => ({
      id: entry.id,
      recordId: entry.id,
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
    setOutfitRecommendations([]);
  }

  async function renameClosetItem(item: ClothingItem, name: string) {
    const client = supabase;
    let recordId = item.recordId;

    if (client && userId) {
      if (recordId) {
        const { data, error } = await client
          .from('closet_items')
          .update({ name })
          .eq('id', recordId)
          .eq('user_id', userId)
          .select('id');
        if (error) throw new Error(`Unable to rename this closet item: ${error.message}`);
        if (!data?.length) throw new Error('This closet item could not be found. Refresh your closet and try again.');
      } else {
        recordId = makeId();
        const { error } = await client.from('closet_items').insert({
          id: recordId,
          user_id: userId,
          name,
          category: normalizeCategory(item.category),
          color: item.color,
          tone: item.tone,
          image_url: item.imageUrl ?? null,
        });
        if (error) throw new Error(`Unable to save this closet item name: ${error.message}`);
      }
    }

    setClosetItems((current) => current.map((currentItem) => (
      (item.id ? currentItem.id === item.id : currentItem === item)
        ? { ...currentItem, recordId: recordId ?? currentItem.recordId, name }
        : currentItem
    )));
  }

  async function generateOutfits() {
    if (closetItems.length === 0) {
      setOutfitError('Add clothing to your closet before creating outfits.');
      return;
    }

    setIsGeneratingOutfits(true);
    setOutfitError('');
    setOutfitRecommendations([]);

    try {
      const response = await fetch('/api/recommend-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: closetItems.filter((item): item is ClothingItem & { id: string; imageUrl: string } => Boolean(item.id && item.imageUrl)),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create outfit recommendations.');
      setOutfitRecommendations(result.outfits as OutfitRecommendation[]);
    } catch (error) {
      console.error('Outfit recommendation request failed:', error);
      setOutfitError(summarizeOutfitError(error));
    } finally {
      setIsGeneratingOutfits(false);
    }
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
              {activeTab === 'matches' ? <MatchesScreen items={closetItems} onDelete={deleteClosetItem} onRename={renameClosetItem} /> : activeTab === 'shopping' ? <ShoppingScreen closetItems={closetItems} outfitRecommendations={outfitRecommendations} /> : activeTab === 'outfits' ? <OutfitsScreen items={closetItems} recommendations={outfitRecommendations} isGenerating={isGeneratingOutfits} error={outfitError} onGenerate={generateOutfits} onRename={renameClosetItem} /> : activeTab === 'add' ? <AddClothingScreen items={closetItems} state={addClothingState} setState={setAddClothingState} onDelete={deleteClosetItem} onRename={renameClosetItem} onItemSaved={async (item) => {
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
                setOutfitRecommendations([]);
                setOutfitError('');
              }} /> : activeTab === 'friends' ? <FriendsScreen connectedPlatforms={connectedPlatforms} onTogglePlatform={(platform) => setConnectedPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])} /> : <TryOnScreen items={closetItems} userId={userId} />}
            </div>
            <nav className="tab-bar" aria-label="Closet sections">
              <TabButton label="CLOSET" symbol="+" active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} />
              <TabButton label="SHOPPING" symbol="▱" active={activeTab === 'shopping'} onClick={() => setActiveTab('shopping')} />
              <TabButton label="OUTFITS" symbol="✦" active={activeTab === 'outfits'} onClick={() => setActiveTab('outfits')} />
              <TabButton label="ADD CLOTHING" symbol="↑" active={activeTab === 'add'} onClick={() => setActiveTab('add')} />
              <TabButton label="FRIENDS" symbol="♡" active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} />
              <TabButton label="TRY ON" symbol="◌" active={activeTab === 'try-on'} onClick={() => setActiveTab('try-on')} />
            </nav>
          </>}
        </div>
      </section>
    </main>
  );
}

const socialPlatforms = [
  { name: 'Instagram', icon: '◎', tone: '#d96c8a', description: 'Find style friends and share inspiration.' },
  { name: 'Snapchat', icon: '👻', tone: '#c7a82e', description: 'See what your friends are trying on.' },
];

function FriendsScreen({ connectedPlatforms, onTogglePlatform }: { connectedPlatforms: string[]; onTogglePlatform: (platform: string) => void }) {
  const [search, setSearch] = useState('');
  const [addedFriends, setAddedFriends] = useState<string[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<{ name: string; handle: string; initials: string; style: string; color: string; inspiration: string; status?: string } | null>(null);
  const friends = [
    { name: 'Maya Chen', handle: '@mayastyle', initials: 'MC', style: 'Minimal · Vintage', color: '#d8c1b8', inspiration: 'Maya finds inspiration in vintage markets and clean, everyday layers.', status: 'NEW LOOK' },
    { name: 'Jordan Ellis', handle: '@jordan.e', initials: 'JE', style: 'Streetwear · Colorful', color: '#b9c8d8', inspiration: 'Jordan mixes bright colors, relaxed silhouettes, and statement sneakers.', status: '2 NEW OUTFITS' },
    { name: 'Sofia Rivera', handle: '@sofiar', initials: 'SR', style: 'Classic · Soft tailoring', color: '#d2c4d8', inspiration: 'Sofia loves polished basics, soft tailoring, and thoughtful accessories.', status: 'INSPIRATION' },
  ];
  const recommendations = [
    { name: 'Avery Brooks', handle: '@averyedits', initials: 'AB', style: 'Modern · Neutral', color: '#c7d0c2', inspiration: 'Avery builds calm, modern looks around neutral tones and simple shapes.' },
    { name: 'Nia Williams', handle: '@niawears', initials: 'NW', style: 'Bold · Eclectic', color: '#d8bd9f', inspiration: 'Nia experiments with unexpected prints, color, and playful vintage finds.' },
  ];
  const visibleFriends = friends.filter((friend) => `${friend.name} ${friend.handle}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="social-page">
    <div className="social-heading"><div><h2>Friends</h2></div><span className="social-count">{friends.length} FRIENDS</span></div>
    <div className="platform-list">
      {socialPlatforms.map((platform) => {
        const isConnected = connectedPlatforms.includes(platform.name);
        return <button className={`platform-card${isConnected ? ' connected' : ''}`} key={platform.name} type="button" onClick={() => onTogglePlatform(platform.name)}>
          <span className="platform-icon" style={{ backgroundColor: platform.tone }}>{platform.icon}</span>
          <span className="platform-copy"><strong>{platform.name}</strong><small>{isConnected ? 'Connected · find friends' : platform.description}</small></span>
          <span className="platform-action">{isConnected ? '✓' : 'CONNECT'}</span>
        </button>;
      })}
    </div>
    <div className="friend-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or username" aria-label="Search friends" /></div>
    <div className="section-heading friends-section-heading"><h4>STYLE FRIENDS</h4></div>
    <div className="friend-list">{visibleFriends.map((friend) => <button className="friend-card" key={friend.handle} type="button" onClick={() => setSelectedFriend(friend)} aria-label={`View ${friend.name}'s profile`}>
      <div className="friend-avatar" style={{ backgroundColor: friend.color }}>{friend.initials}</div>
      <div className="friend-details"><strong>{friend.name}</strong><small>{friend.handle}</small><span>{friend.style}</span></div>
      <span className="friend-profile-hint">PROFILE<br /><b>→</b></span>
    </button>)}</div>
    {visibleFriends.length === 0 && <p className="social-empty">No style friends found yet.</p>}
    <div className="section-heading recommendations-heading"><h4>SUGGESTED FOR YOU</h4></div>
    <div className="friend-list recommendation-list">{recommendations.map((friend) => {
      const isAdded = addedFriends.includes(friend.handle);
      return <article className="friend-card" key={friend.handle} onClick={() => setSelectedFriend(friend)}>
        <div className="friend-avatar" style={{ backgroundColor: friend.color }}>{friend.initials}</div>
        <div className="friend-details"><strong>{friend.name}</strong><small>{friend.handle}</small><span>{friend.style}</span></div>
        <button className={`add-friend-button${isAdded ? ' added' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); setAddedFriends((current) => isAdded ? current.filter((handle) => handle !== friend.handle) : [...current, friend.handle]); }}>{isAdded ? '✓ ADDED' : '+ ADD'}</button>
      </article>;
    })}</div>
    {selectedFriend && <div className="friend-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedFriend(null); }}>
      <section className="friend-profile-panel" role="dialog" aria-modal="true" aria-labelledby="friend-profile-title">
        <button className="friend-profile-close" type="button" onClick={() => setSelectedFriend(null)} aria-label="Close friend profile">×</button>
        <div className="friend-profile-avatar" style={{ backgroundColor: selectedFriend.color }}>{selectedFriend.initials}</div>
        <p className="eyebrow">STYLE FRIEND</p>
        <h3 id="friend-profile-title">{selectedFriend.name}</h3>
        <p className="friend-profile-handle">{selectedFriend.handle}</p>
        <div className="friend-profile-style">{selectedFriend.style}</div>
        <div className="friend-profile-stats"><span><strong>24</strong> OUTFITS</span><span><strong>18</strong> SAVED LOOKS</span><span><strong>4</strong> SHARED TAGS</span></div>
        <p className="friend-profile-note">{selectedFriend.inspiration}</p>
        <button className="primary-button" type="button" onClick={() => setSelectedFriend(null)}>DONE</button>
      </section>
    </div>}
  </div>;
}

type ModelProfile = { presentation: string; hairType: string; hairLength: string; hairColor: string; skinTone: string; eyeColor: string; height: string; weight: string };

const defaultModelProfile: ModelProfile = { presentation: 'Woman', hairType: 'Wavy', hairLength: 'Medium', hairColor: '#4b342c', skinTone: '#c99578', eyeColor: '#3d302a', height: '', weight: '' };
const modelProfileKeys: (keyof ModelProfile)[] = ['presentation', 'hairType', 'hairLength', 'hairColor', 'skinTone', 'eyeColor', 'height', 'weight'];

function sanitizeModelProfile(profile: Record<string, unknown>): Partial<ModelProfile> {
  const sanitized: Partial<ModelProfile> = {};
  for (const key of modelProfileKeys) {
    const value = profile[key];
    if (typeof value === 'string') sanitized[key] = value;
  }
  return sanitized;
}

function TryOnScreen({ items, userId }: { items: ClothingItem[]; userId: string | null }) {
  const [selectedCategory, setSelectedCategory] = useState<'tops' | 'bottoms' | 'shoes'>('tops');
  const [outfitColors, setOutfitColors] = useState({ tops: '#7a91b2', bottoms: '#35485d', shoes: '#242b31' });
  const [selectedClothing, setSelectedClothing] = useState<Partial<Record<'tops' | 'bottoms' | 'shoes', ClothingItem>>>({});
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [modelProfile, setModelProfile] = useState<ModelProfile>(defaultModelProfile);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const options = selectedCategory === 'tops' ? ['#7a91b2', '#c68b82', '#d7c7a7'] : selectedCategory === 'bottoms' ? ['#35485d', '#675a78', '#b89f7c'] : ['#242b31', '#f0eee8', '#9c805a'];
  const categoryItems = items.filter((item) => normalizeCategory(item.category) === normalizeCategory(selectedCategory === 'tops' ? 'Tops' : selectedCategory === 'bottoms' ? 'Pants' : 'Shoes'));
  const modelHeight = typeof modelProfile.height === 'string' ? modelProfile.height : '';
  const heightParts = modelHeight.match(/(\d+)\D+(\d+)/);
  const heightInches = heightParts ? Number(heightParts[1]) * 12 + Number(heightParts[2]) : Number.parseInt(modelHeight, 10);
  const heightScale = Number.isFinite(heightInches) ? Math.min(1.16, Math.max(.86, heightInches / 66 || 1)) : 1;
  const weightValue = Number.parseInt(modelProfile.weight, 10);
  const modelWidth = Number.isFinite(weightValue) ? Math.min(1.1, Math.max(.9, 1 + (weightValue - 140) / 1200)) : 1;
  const hairShape = modelProfile.hairType === 'Straight' ? '48% 48% 8% 8%' : modelProfile.hairType === 'Curly' ? '50%' : modelProfile.hairType === 'Coily' ? '45% 45% 20% 20%' : '48% 48% 25% 25%';
  const hairHeight = modelProfile.hairLength === 'Long' ? '78px' : modelProfile.hairLength === 'Short' ? '48px' : '82px';
  const hairWidth = modelProfile.hairLength === 'Long' ? '82px' : '73px';
  const selectedPiece = selectedClothing[selectedCategory];
  const clothingStyle = (category: 'tops' | 'bottoms' | 'shoes') => ({
    backgroundColor: outfitColors[category],
    ...(selectedClothing[category]?.imageUrl ? { backgroundImage: `url(${selectedClothing[category]?.imageUrl})` } : {}),
  });

  useEffect(() => {
    let isActive = true;
    const loadModelProfile = async () => {
      let savedProfile: Partial<ModelProfile> | null = null;
      if (supabase && userId) {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Unable to load try-on profile:', error.message);
        } else if (data.user?.id === userId) {
          const metadata = data.user.user_metadata;
          savedProfile = sanitizeModelProfile({
            presentation: metadata.model_presentation,
            hairType: metadata.hair_type,
            hairLength: metadata.hair_length,
            hairColor: metadata.hair_color,
            skinTone: metadata.skin_tone,
            eyeColor: metadata.eye_color,
            height: metadata.height,
            weight: metadata.weight,
          });
        }
      } else {
        const localProfile = window.localStorage.getItem('styleup-model-profile');
        if (localProfile) {
          try {
            const parsedProfile: unknown = JSON.parse(localProfile);
            if (parsedProfile && typeof parsedProfile === 'object' && !Array.isArray(parsedProfile)) {
              savedProfile = sanitizeModelProfile(parsedProfile as Record<string, unknown>);
            }
          } catch {
            window.localStorage.removeItem('styleup-model-profile');
          }
        }
      }
      if (isActive && savedProfile) {
        setModelProfile((current) => ({ ...current, ...savedProfile }));
      }
    };
    void loadModelProfile();
    return () => { isActive = false; };
  }, [userId]);

  async function saveModelProfile() {
    setIsSavingProfile(true);
    setProfileMessage('');
    if (supabase && userId) {
      const { error } = await supabase.auth.updateUser({
        data: {
          model_presentation: modelProfile.presentation,
          hair_type: modelProfile.hairType,
          hair_length: modelProfile.hairLength,
          hair_color: modelProfile.hairColor,
          skin_tone: modelProfile.skinTone,
          eye_color: modelProfile.eyeColor,
          height: modelProfile.height,
          weight: modelProfile.weight,
        },
      });
      if (error) {
        setIsSavingProfile(false);
        setProfileMessage('Your profile could not be saved. Please try again.');
        return;
      }
    } else {
      window.localStorage.setItem('styleup-model-profile', JSON.stringify(modelProfile));
    }
    setIsSavingProfile(false);
    setProfileMessage('Saved');
  }

  return <div className="try-on-page">
    <div className="try-on-heading"><div><h2>Try it on</h2></div></div>
    <div className="avatar-stage">
      <div className="avatar-glow" />
      <div className={`model-figure ${modelProfile.presentation === 'Man' ? 'masculine' : 'feminine'}`} style={{ transform: `scaleX(${modelWidth}) scaleY(${heightScale})` }}>
        <div className={`model-head ${modelProfile.presentation === 'Man' ? 'masculine' : 'feminine'}`} style={{ backgroundColor: modelProfile.skinTone }}><span className={`model-hair${modelProfile.presentation === 'Woman' ? ' hair-feminine' : ''}${modelProfile.hairLength === 'Long' ? ' hair-long' : ''}`} style={{ backgroundColor: modelProfile.hairColor, borderRadius: hairShape, height: hairHeight, width: hairWidth }} /><span className="model-face" style={{ backgroundColor: modelProfile.skinTone }} /><span className="model-eye left" style={{ backgroundColor: modelProfile.eyeColor }} /><span className="model-eye right" style={{ backgroundColor: modelProfile.eyeColor }} /><span className="model-nose" /><span className="model-mouth" /></div>
        <div className="model-neck" style={{ backgroundColor: modelProfile.skinTone }} /><div className="model-torso"><div className="model-arm left" style={{ backgroundColor: modelProfile.skinTone }} /><div className="model-arm right" style={{ backgroundColor: modelProfile.skinTone }} /><div className={`model-top${selectedClothing.tops?.imageUrl ? ' has-closet-photo' : ''}`} style={clothingStyle('tops')} /></div><div className={`model-bottom${selectedClothing.bottoms?.imageUrl ? ' has-closet-photo' : ''}`} style={clothingStyle('bottoms')} /><div className="model-feet" style={{ color: outfitColors.shoes }}><span className={selectedClothing.shoes?.imageUrl ? 'has-closet-photo' : ''} style={clothingStyle('shoes')} /><span className={selectedClothing.shoes?.imageUrl ? 'has-closet-photo' : ''} style={clothingStyle('shoes')} /></div>
      </div>
    </div>
    <div className="try-on-controls">
      <div className="control-row">{(['tops', 'bottoms', 'shoes'] as const).map((category) => <button key={category} className={selectedCategory === category ? 'selected' : ''} type="button" onClick={() => setSelectedCategory(category)}>{category === 'tops' ? 'TOP' : category === 'bottoms' ? 'BOTTOM' : 'SHOES'}</button>)}</div>
      <div className="color-row">{options.map((color) => <button key={color} className={`color-swatch${outfitColors[selectedCategory] === color ? ' selected' : ''}`} style={{ backgroundColor: color }} type="button" onClick={() => setOutfitColors((current) => ({ ...current, [selectedCategory]: color }))} aria-label={`Choose ${color}`} />)}</div>
      {categoryItems.length > 0 && <div className="closet-try-on-list">{categoryItems.map((item) => <button className={`closet-try-on-item${selectedPiece?.id === item.id ? ' selected' : ''}`} key={item.id ?? item.imageUrl ?? item.name} type="button" onClick={() => setSelectedClothing((current) => ({ ...current, [selectedCategory]: item }))} aria-label={`Try on ${item.name}`}><span style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined, backgroundColor: item.color }} /><small>{item.name}</small></button>)}</div>}
      <p className="try-on-selection">{selectedPiece ? `${selectedPiece.name} is on your model` : categoryItems.length ? 'Choose a closet piece to try it on' : 'Add a closet photo to try it on here'}</p>
    </div>
    <button className="profile-setup-button" type="button" onClick={() => setShowProfileForm((current) => !current)}>{showProfileForm ? 'HIDE STYLE PROFILE' : 'PERSONALIZE YOUR MODEL'} <span>{showProfileForm ? '−' : '+'}</span></button>
    {showProfileForm && <div className="model-profile-card"><strong>Model details</strong><div className="model-profile-grid"><label>MODEL<select value={modelProfile.presentation} onChange={(event) => setModelProfile((current) => ({ ...current, presentation: event.target.value }))}><option>Woman</option><option>Man</option></select></label><label>HAIR LENGTH<select value={modelProfile.hairLength} onChange={(event) => setModelProfile((current) => ({ ...current, hairLength: event.target.value }))}><option>Short</option><option>Medium</option><option>Long</option></select></label><label>HAIR TYPE<select value={modelProfile.hairType} onChange={(event) => setModelProfile((current) => ({ ...current, hairType: event.target.value }))}><option>Straight</option><option>Wavy</option><option>Curly</option><option>Coily</option></select></label><label>HAIR COLOR<select value={modelProfile.hairColor} onChange={(event) => setModelProfile((current) => ({ ...current, hairColor: event.target.value }))}><option value="#171313">Black</option><option value="#4b342c">Brown</option><option value="#c7a66a">Blonde</option><option value="#8e4938">Red</option></select></label><label>SKIN TONE<select value={modelProfile.skinTone} onChange={(event) => setModelProfile((current) => ({ ...current, skinTone: event.target.value }))}><option value="#f0c7a8">Light</option><option value="#c99578">Warm</option><option value="#81543f">Deep</option></select></label><label>EYE COLOR<select value={modelProfile.eyeColor} onChange={(event) => setModelProfile((current) => ({ ...current, eyeColor: event.target.value }))}><option value="#3d302a">Brown</option><option value="#47768a">Blue</option><option value="#4f765e">Green</option><option value="#766044">Hazel</option></select></label><label>HEIGHT<input value={modelProfile.height} onChange={(event) => setModelProfile((current) => ({ ...current, height: event.target.value }))} placeholder={`5' 6"`} /></label><label>WEIGHT<input value={modelProfile.weight} onChange={(event) => setModelProfile((current) => ({ ...current, weight: event.target.value }))} placeholder="140 lb" /></label></div><button className="primary-button" type="button" onClick={() => void saveModelProfile()} disabled={isSavingProfile}>{isSavingProfile ? 'SAVING…' : 'SAVE STYLE PROFILE'}</button>{profileMessage && <p className="try-on-profile-message" role="status">{profileMessage}</p>}</div>}
  </div>;
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

type WeatherReport = { temperature: number; code: number; rainChance: number; windSpeed: number; location: string };
type WeatherLocation = { name: string; latitude: number; longitude: number };
type OutfitTip = { icon: string; condition: string; title: string; advice: string; image: string; alt: string };

function getOutfitTip(weather: WeatherReport): OutfitTip {
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weather.code) || weather.rainChance >= 45) {
    return { icon: '🌧️', condition: 'RAIN EXPECTED', title: 'Rain-ready layers', advice: 'Bring a waterproof coat and umbrella to stay dry on your way out.', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=85', alt: 'Photograph of a black leather jacket' };
  }
  if (weather.temperature <= 50 || [71, 73, 75, 77, 85, 86].includes(weather.code)) {
    return { icon: '🧥', condition: 'CHILLY OUT', title: 'A warm extra layer', advice: 'Reach for a warm coat and layer up—especially if you will be outside for a while.', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=85', alt: 'Photograph of a warm rust-colored jacket on a hanger' };
  }
  if (weather.temperature >= 72 && [0, 1, 2, 3].includes(weather.code)) {
    return { icon: '☀️', condition: 'BRIGHT & WARM', title: 'Keep it light', advice: 'Choose breathable clothes, and bring a hat and sunglasses for extra sun protection.', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85', alt: 'Photograph of a person in a casual outfit wearing sunglasses' };
  }
  return { icon: '☁️', condition: 'MILD WEATHER', title: 'Easy layers', advice: 'A comfortable outfit with a light jacket gives you an easy layer if the breeze picks up.', image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=85', alt: 'Photograph of shirts hanging on a clothing rack' };
}

function describeWeatherCode(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Local weather';
}

function WeatherBadge() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [savedLocation, setSavedLocation] = useState<WeatherLocation | null>(null);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<WeatherLocation[]>([]);
  const [locationError, setLocationError] = useState('');
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('styleup-weather-location');
      if (saved) setSavedLocation(JSON.parse(saved) as WeatherLocation);
    } catch {
      window.localStorage.removeItem('styleup-weather-location');
    }
  }, []);

  async function loadWeatherAt(latitude: number, longitude: number, location: string) {
    setStatus('loading');
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,weather_code,precipitation,wind_speed_10m',
        daily: 'precipitation_probability_max',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'auto',
        forecast_days: '1',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error('Weather request failed');
      const data = await response.json();
      const report = {
        temperature: Math.round(Number(data.current.temperature_2m)),
        code: Number(data.current.weather_code),
        rainChance: Number(data.daily?.precipitation_probability_max?.[0] ?? 0),
        windSpeed: Math.round(Number(data.current.wind_speed_10m ?? 0)),
        location,
      };
      if (!Number.isFinite(report.temperature) || !Number.isFinite(report.code)) throw new Error('Weather data was unavailable');
      setWeather(report);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  function loadWeather() {
    if (savedLocation) {
      void loadWeatherAt(savedLocation.latitude, savedLocation.longitude, savedLocation.name);
      return;
    }
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void loadWeatherAt(coords.latitude, coords.longitude, 'Your current location'),
      () => setStatus('error'),
      { timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function searchLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = locationQuery.trim();
    if (!query) return;
    setIsSearchingLocations(true);
    setLocationError('');
    setLocationResults([]);
    try {
      const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      if (!response.ok) throw new Error('Location search failed');
      const data = await response.json();
      const results: WeatherLocation[] = (data.results ?? []).map((result: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
        name: [result.name, result.admin1, result.country].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(', '),
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      }));
      setLocationResults(results);
      if (results.length === 0) setLocationError('No matching places found. Try a nearby city or town.');
    } catch {
      setLocationError('Couldn’t search for that location. Please try again.');
    } finally {
      setIsSearchingLocations(false);
    }
  }

  function selectLocation(location: WeatherLocation) {
    setSavedLocation(location);
    window.localStorage.setItem('styleup-weather-location', JSON.stringify(location));
    setLocationSearchOpen(false);
    setLocationResults([]);
    setLocationQuery('');
    void loadWeatherAt(location.latitude, location.longitude, location.name);
  }

  function useCurrentLocation() {
    setSavedLocation(null);
    window.localStorage.removeItem('styleup-weather-location');
    setLocationSearchOpen(false);
    setLocationResults([]);
    setLocationQuery('');
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void loadWeatherAt(coords.latitude, coords.longitude, 'Your current location'),
      () => setStatus('error'),
      { timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  }

  function togglePanel() {
    const shouldOpen = !panelOpen;
    setPanelOpen(shouldOpen);
    if (shouldOpen && status !== 'loading') loadWeather();
  }

  const outfit = weather ? getOutfitTip(weather) : null;

  return (
    <div className="weather-wrapper">
      <button
        className="weather-badge"
        type="button"
        onClick={togglePanel}
        aria-expanded={panelOpen}
        aria-label={weather ? `Weather outfit suggestion, ${weather.temperature} degrees` : 'Get a weather-based outfit suggestion'}
        title="Get a weather-based outfit suggestion"
      >
        <strong>{weather ? `${weather.temperature}°F` : '☁️'}</strong>
        <span>{weather ? 'OUTFIT TIP' : 'WEATHER TIP'}</span>
      </button>

      {panelOpen && (
        <div className="weather-panel weather-recommendation-panel" role="dialog" aria-label="Local weather and outfit suggestion">
          <div className="weather-panel-header">
            <div className="weather-panel-location">
              <p className="weather-label">WEATHER-BASED OUTFIT</p>
              <h3>What to wear today</h3>
              <small>{weather?.location ?? (savedLocation?.name || 'Uses your location only to check local weather')}</small>
            </div>
            <button type="button" className="close-panel" onClick={() => setPanelOpen(false)} aria-label="Close outfit suggestion">×</button>
          </div>

          <button type="button" className="weather-location-toggle" onClick={() => { setLocationSearchOpen(!locationSearchOpen); setLocationError(''); }}>
            {locationSearchOpen ? 'CANCEL LOCATION CHANGE' : 'CHANGE LOCATION'}
          </button>
          {locationSearchOpen && <form className="weather-form" onSubmit={searchLocations}>
            <label htmlFor="weather-location-search">CITY OR POSTAL CODE</label>
            <div className="location-input-wrap"><input id="weather-location-search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="e.g. Portland, OR" autoComplete="off" />
              {locationResults.length > 0 && <ul className="location-suggestions" aria-label="Location search results">{locationResults.map((location) => <li key={`${location.latitude},${location.longitude}`}><button type="button" className="location-suggestion" onClick={() => selectLocation(location)}>{location.name}</button></li>)}</ul>}
            </div>
            <div className="weather-form-actions"><button className="primary-button small-button" type="submit" disabled={isSearchingLocations}>{isSearchingLocations ? 'SEARCHING…' : 'SEARCH'}</button>{savedLocation && <button className="secondary-button small-button" type="button" onClick={useCurrentLocation}>USE MY LOCATION</button>}</div>
            {locationError && <p className="weather-location-error" role="status">{locationError}</p>}
          </form>}
          {status === 'loading' && <p className="weather-empty" role="status">Checking weather…</p>}
          {status === 'error' && <div className="weather-error-state"><p className="weather-empty">Couldn’t get your weather. Try again or choose a different location.</p><button type="button" className="secondary-button weather-demo-button" onClick={loadWeather}>TRY AGAIN</button></div>}
          {status === 'ready' && weather && outfit && <>
            <div className="weather-panel-snapshot">
              <div><span className="weather-mini-label">OUTSIDE</span><strong>{outfit.icon} {describeWeatherCode(weather.code)}</strong></div>
              <div><span className="weather-mini-label">TEMP</span><strong>{weather.temperature}°F</strong></div>
            </div>
            <img className="weather-outfit-image" src={outfit.image} alt={outfit.alt} />
            <span className="weather-photo-credit">Clothing photo via Unsplash</span>
            <h4 className="weather-outfit-title">{outfit.title}</h4>
            <p className="weather-advice">{outfit.advice}</p>
            <div className="weather-panel-grid"><span>RAIN CHANCE<strong>{weather.rainChance}%</strong></span><span>WIND<strong>{weather.windSpeed} mph</strong></span></div>
            <button type="button" className="secondary-button weather-demo-button" onClick={loadWeather}>REFRESH WEATHER ↻</button>
          </>}
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><img className="loading-logo" src="/StyleUpLogo.png" alt="StyleUp" /><p>A better way to get dressed.</p><div className="loading-line" /></div>;
}

function MatchesScreen({ items, onDelete, onRename }: { items: ClothingItem[]; onDelete: (item: ClothingItem) => Promise<void>; onRename: (item: ClothingItem, name: string) => Promise<void> }) {
  if (items.length === 0) return <div className="empty-state"><div className="empty-mark">+</div><h2>Your closet is waiting</h2><p>Upload a clothing photo to start making matches from pieces you own.</p></div>;

  const galleryCategories = [...categories, ...Array.from(new Set(
    items
      .map((item) => item.category.trim())
      .filter((category) => category && !categories.some((knownCategory) => normalizeCategory(knownCategory) === normalizeCategory(category))),
  ))];

  return <>
    <div className="intro-row"><h2>Your closet</h2><span className="closet-piece-count">{String(items.length).padStart(2, '0')} PIECES</span></div>
    <div className="categorized-gallery">{galleryCategories.map((category) => {
      const categoryItems = items.filter((item) => normalizeCategory(item.category) === normalizeCategory(category));
      if (categoryItems.length === 0) return null;
      return <section className="gallery-category" key={category}>
        <div className="gallery-category-heading"><h4>{category}</h4><span>{categoryItems.length} {categoryItems.length === 1 ? 'PIECE' : 'PIECES'}</span></div>
        <div className="item-grid">{categoryItems.map((item) => <ClothingCard item={item} onDelete={onDelete} onRename={onRename} key={item.id ?? item.imageUrl ?? item.name} />)}</div>
      </section>;
    })}</div>
  </>;
}

function OutfitsScreen({ items, recommendations, isGenerating, error, onGenerate, onRename }: { items: ClothingItem[]; recommendations: OutfitRecommendation[]; isGenerating: boolean; error: string; onGenerate: () => Promise<void>; onRename: (item: ClothingItem, name: string) => Promise<void> }) {
  const itemById = new Map(items.map((item) => [item.id, item]));

  return <>
    <h2 className="outfit-page-heading">Outfit recommendations</h2>
    <p className="page-subtitle">Built from the clothes currently in your closet.</p>
    <button className="primary-button outfit-generate-button" type="button" onClick={() => void onGenerate()} disabled={isGenerating || items.length === 0}>
      {isGenerating ? 'CREATING OUTFITS…' : recommendations.length ? 'CREATE NEW OUTFITS' : 'CREATE OUTFITS'}
    </button>
    {error && <p className="upload-error outfit-error" role="alert">{error}</p>}
    {!error && !isGenerating && recommendations.length === 0 && <p className="outfit-empty">Create recommendations to see complete looks using your current closet images.</p>}
    <div className="outfit-list">{recommendations.map((outfit) => {
      const outfitItems = outfit.itemIds.map((id) => itemById.get(id)).filter((item): item is ClothingItem => Boolean(item));
      return <article className="outfit-recommendation" key={`${outfit.title}-${outfit.itemIds.join('-')}`}>
        <h3>{outfit.title}</h3>
        <p>{outfit.description}</p>
        <div className="outfit-items">{outfitItems.map((item) => <ClothingCard item={item} onRename={onRename} key={item.id ?? item.imageUrl ?? item.name} />)}</div>
      </article>;
    })}</div>
  </>;
}

function ClothingCard({ item, onDelete, onRename }: { item: ClothingItem; onDelete?: (item: ClothingItem) => Promise<void>; onRename: (item: ClothingItem, name: string) => Promise<void> }) {
  const nameInputId = useId();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const [renameError, setRenameError] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      setRenameError('Enter a name for this item.');
      return;
    }
    if (name === item.name) {
      setIsEditingName(false);
      setRenameError('');
      return;
    }

    setIsSavingName(true);
    setRenameError('');
    try {
      await onRename(item, name);
      setIsEditingName(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Unable to rename this item.');
    } finally {
      setIsSavingName(false);
    }
  }

  function cancelNameEdit() {
    setDraftName(item.name);
    setRenameError('');
    setIsEditingName(false);
  }

  return <article className="item-card"><div className={`item-image${item.imageUrl ? ' has-photo' : ''}`} style={{ backgroundColor: item.color, backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }}><div className="item-shape" style={{ backgroundColor: item.tone }} />{onDelete && <button className="remove-item-button" type="button" onClick={() => void onDelete(item)} aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`}>×</button>}</div>{isEditingName ? <form className="item-name-edit" onSubmit={(event) => void saveName(event)}><label className="visually-hidden" htmlFor={nameInputId}>Clothing item name</label><input id={nameInputId} autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') cancelNameEdit(); }} disabled={isSavingName} maxLength={80} /><div><button type="submit" disabled={isSavingName}>{isSavingName ? 'Saving…' : 'Save'}</button><button type="button" onClick={cancelNameEdit} disabled={isSavingName}>Cancel</button></div>{renameError && <p className="item-name-error" role="alert">{renameError}</p>}</form> : <button className="item-name-button" type="button" onClick={() => { setDraftName(item.name); setRenameError(''); setIsEditingName(true); }} aria-label={`Rename ${item.name}`} title="Click to rename">{item.name}</button>}</article>;
}

function AddClothingScreen({ items, state, setState, onDelete, onRename, onItemSaved }: { items: ClothingItem[]; state: AddClothingState; setState: Dispatch<SetStateAction<AddClothingState>>; onDelete: (item: ClothingItem) => Promise<void>; onRename: (item: ClothingItem, name: string) => Promise<void>; onItemSaved: (item: ClothingItem) => Promise<void> }) {
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
          const fileHash = await getFileHash(file);
          const fileName = `${user.id}/${fileHash}`;
          const { error: uploadError } = await supabase.storage
            .from('closet-photos')
            .upload(fileName, file, { upsert: true, cacheControl: '3600', contentType: file.type });

          if (uploadError) throw new Error(uploadError.message);

          const { data } = supabase.storage.from('closet-photos').getPublicUrl(fileName);
          imageUrl = `${data.publicUrl}?v=${Date.now()}`;
        } else {
          imageUrl = await readImage(file);
        }
      } else {
        imageUrl = await readImage(file);
      }

      setState((current) => ({ ...current, analysis: result, isAnalyzing: false, error: '' }));
      await onItemSaved({ name: `${result.color} ${result.category}`, category: normalizeCategory(categoryMap[result.category as Analysis['category']]), color: '#E8E0D0', tone: '#9C805A', imageUrl });
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
    <div className="category-list">{categories.map((category, index) => { const categoryItems = items.filter((item) => item.category === category.toUpperCase()); const isExpanded = expandedCategories.includes(category); const categoryId = `category-${category.toLowerCase()}`; return <section className="category-section" key={category}><button className="category-row" type="button" onClick={() => toggleCategory(category)} aria-expanded={isExpanded} aria-controls={categoryId}><span className="category-dot" style={{ backgroundColor: categoryTones[index] }} /><span>{category}<small>{categoryItems.length ? `${categoryItems.length} ${categoryItems.length === 1 ? 'piece' : 'pieces'}` : 'Ready for your first piece'}</small></span><span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button>{isExpanded && <div className="category-items" id={categoryId}>{categoryItems.length ? categoryItems.map((item) => <ClothingCard item={item} key={item.id ?? item.imageUrl ?? item.name} onDelete={onDelete} onRename={onRename} />) : <p className="category-empty">No {category.toLowerCase()} in your closet yet.</p>}</div>}</section>; })}</div>
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
