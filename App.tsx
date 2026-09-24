import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Tab = 'matches' | 'add';

type ClothingItem = {
  name: string;
  category: string;
  color: string;
  tone: string;
};

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

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    const loadingTimer = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(loadingTimer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR DIGITAL CLOSET</Text>
            <Text style={styles.wordmark}>StyleUp</Text>
          </View>
          <View style={styles.weatherBadge}>
            <Text style={styles.weatherValue}>18°</Text>
            <Text style={styles.weatherLabel}>TODAY</Text>
          </View>
        </View>

        {activeTab === 'matches' ? (
          <MatchesScreen
            matchIndex={matchIndex}
            onNext={() => setMatchIndex((current) => (current + 1) % matchIdeas.length)}
          />
        ) : (
          <AddClothingScreen />
        )}

        <View style={styles.tabBar}>
          <TabButton
            label="MAKE A MATCH"
            symbol="+"
            active={activeTab === 'matches'}
            onPress={() => setActiveTab('matches')}
          />
          <TabButton
            label="ADD CLOTHING"
            symbol="↑"
            active={activeTab === 'add'}
            onPress={() => setActiveTab('add')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar style="dark" />
      <View style={styles.logoPlaceholder}>
        <Text style={styles.logoPlaceholderText}>YOUR LOGO</Text>
      </View>
      <Text style={styles.loadingCaption}>A better way to get dressed.</Text>
      <View style={styles.loadingLine} />
    </SafeAreaView>
  );
}

function MatchesScreen({ matchIndex, onNext }: { matchIndex: number; onNext: () => void }) {
  const currentMatch = matchIdeas[matchIndex];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.introRow}>
        <View>
          <Text style={styles.pageTitle}>What are we wearing?</Text>
          <Text style={styles.pageSubtitle}>A few ideas, styled from what you own.</Text>
        </View>
        <View style={styles.sunMark}>
          <Text style={styles.sunMarkText}>☼</Text>
        </View>
      </View>

      <View style={[styles.matchCard, { backgroundColor: currentMatch.accent }]}>
        <View style={styles.matchCardTopline}>
          <Text style={styles.cardLabel}>STYLE NOTE 0{matchIndex + 1}</Text>
          <Text style={styles.cardLabel}>SPRING / 18°</Text>
        </View>
        <Text style={styles.matchTitle}>{currentMatch.title}</Text>
        <Text style={styles.matchDetail}>{currentMatch.detail}</Text>
        <View style={styles.outfitPreview}>
          <View style={[styles.previewPiece, styles.previewTop]} />
          <View style={[styles.previewPiece, styles.previewBottom]} />
          <View style={[styles.previewPiece, styles.previewShoes]} />
        </View>
        <Pressable style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>SHOW ANOTHER LOOK  →</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>RECENTLY ADDED</Text>
        <Text style={styles.sectionCount}>04 PIECES</Text>
      </View>
      <View style={styles.itemGrid}>
        {clothingItems.map((item) => (
          <View style={styles.itemCard} key={item.name}>
            <View style={[styles.itemImage, { backgroundColor: item.color }]}>
              <View style={[styles.itemShape, { backgroundColor: item.tone }]} />
            </View>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <Text style={styles.itemName}>{item.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function AddClothingScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Add to your closet</Text>
      <Text style={styles.pageSubtitle}>Start with the pieces you reach for most.</Text>

      <Pressable
        style={styles.uploadPanel}
        onPress={() => Alert.alert('Add a clothing item', 'Photo upload will connect here next.')}
      >
        <View style={styles.uploadCircle}>
          <Text style={styles.uploadSymbol}>+</Text>
        </View>
        <Text style={styles.uploadTitle}>Upload a photo</Text>
        <Text style={styles.uploadDetail}>Take a photo or choose from your camera roll</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>OR START WITH A CATEGORY</Text>
      <View style={styles.categoryList}>
        {['Tops', 'Bottoms', 'Layers', 'Shoes', 'Accessories'].map((category, index) => (
          <Pressable
            style={styles.categoryRow}
            key={category}
            onPress={() => Alert.alert(category, `Add your first ${category.toLowerCase()} piece.`)}
          >
            <View style={[styles.categoryDot, { backgroundColor: clothingItems[index % clothingItems.length].tone }]} />
            <Text style={styles.categoryName}>{category}</Text>
            <Text style={styles.categoryArrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function TabButton({ label, symbol, active, onPress }: { label: string; symbol: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.activeTabButton]} onPress={onPress}>
      <Text style={[styles.tabSymbol, active && styles.activeTabText]}>{symbol}</Text>
      <Text style={[styles.tabLabel, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F2EA' },
  appShell: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F2EA', padding: 32 },
  logoPlaceholder: { width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: '#B9A88D', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoPlaceholderText: { color: '#2F3934', fontSize: 15, letterSpacing: 2.5, fontWeight: '600' },
  loadingCaption: { color: '#756F65', fontSize: 15, letterSpacing: 0.3 },
  loadingLine: { position: 'absolute', bottom: 48, width: 42, height: 2, backgroundColor: '#C66B4B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  eyebrow: { color: '#8B847A', fontSize: 10, letterSpacing: 1.6, fontWeight: '600' },
  wordmark: { color: '#29342F', fontSize: 31, fontWeight: '700', letterSpacing: -0.7, marginTop: 3 },
  weatherBadge: { alignItems: 'flex-end', paddingTop: 3 },
  weatherValue: { color: '#C66B4B', fontSize: 20, fontWeight: '700' },
  weatherLabel: { color: '#8B847A', fontSize: 9, letterSpacing: 1.2, marginTop: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 130 },
  introRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, marginBottom: 20 },
  pageTitle: { color: '#29342F', fontSize: 27, fontWeight: '700', letterSpacing: -0.6 },
  pageSubtitle: { color: '#817A70', fontSize: 14, marginTop: 7, lineHeight: 20 },
  sunMark: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#E8D8BB', alignItems: 'center', justifyContent: 'center' },
  sunMarkText: { color: '#9A7654', fontSize: 24 },
  matchCard: { minHeight: 355, borderRadius: 6, padding: 21, overflow: 'hidden', position: 'relative' },
  matchCardTopline: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: '#526158', fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  matchTitle: { color: '#29342F', fontSize: 38, fontWeight: '700', letterSpacing: -1, marginTop: 27 },
  matchDetail: { color: '#526158', fontSize: 14, marginTop: 4 },
  outfitPreview: { height: 145, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  previewPiece: { position: 'absolute' },
  previewTop: { width: 82, height: 86, backgroundColor: '#F1ECE2', borderTopLeftRadius: 35, borderTopRightRadius: 35, top: 7 },
  previewBottom: { width: 105, height: 65, backgroundColor: '#72838A', bottom: 4, transform: [{ rotate: '3deg' }] },
  previewShoes: { width: 48, height: 14, backgroundColor: '#5B4234', bottom: -1, left: 96, borderRadius: 7 },
  primaryButton: { alignSelf: 'flex-start', backgroundColor: '#29342F', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 2 },
  primaryButtonText: { color: '#F6F2EA', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 29, marginBottom: 12 },
  sectionTitle: { color: '#837B70', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  sectionCount: { color: '#B0A79A', fontSize: 10, letterSpacing: 1.1 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  itemCard: { width: '47%' },
  itemImage: { height: 118, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  itemShape: { width: 61, height: 75, borderTopLeftRadius: 25, borderTopRightRadius: 25, opacity: 0.85 },
  itemCategory: { color: '#A09789', fontSize: 9, letterSpacing: 1.1, fontWeight: '700', marginTop: 9 },
  itemName: { color: '#3A443F', fontSize: 14, marginTop: 3 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#29342F', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 4 },
  activeTabButton: { backgroundColor: '#46554D' },
  tabSymbol: { color: '#9BA89F', fontSize: 20, lineHeight: 22 },
  tabLabel: { color: '#9BA89F', fontSize: 9, letterSpacing: 1.1, fontWeight: '700', marginTop: 5 },
  activeTabText: { color: '#F4EDE1' },
  uploadPanel: { borderWidth: 1, borderColor: '#D3C7B5', borderStyle: 'dashed', borderRadius: 5, minHeight: 250, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 35, backgroundColor: '#F2ECE1' },
  uploadCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#D7B69A', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  uploadSymbol: { color: '#573D31', fontSize: 31, fontWeight: '300', lineHeight: 34 },
  uploadTitle: { color: '#29342F', fontSize: 19, fontWeight: '700' },
  uploadDetail: { color: '#817A70', fontSize: 13, marginTop: 7 },
  categoryList: { marginTop: 11 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2D9CC', paddingVertical: 16 },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  categoryName: { flex: 1, color: '#3A443F', fontSize: 16 },
  categoryArrow: { color: '#92745C', fontSize: 19 },
});
