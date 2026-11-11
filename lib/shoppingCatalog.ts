import shoppingImageNames from './shoppingImages.json';
import shoppingWomenImageNames from './shoppingWomenImages.json';

export type ShoppingCategory = 'TOPS' | 'PANTS' | 'JACKETS' | 'SHOES';
export type ShoppingSection = 'men' | 'women';

export type ShoppingStore = { id: string; name: string; initials: string; logoUrl: string; priceAdjustment: number };
export type ShoppingReview = { author: string; title: string; text: string };

export type ShoppingProduct = {
  id: string;
  section: ShoppingSection;
  storeId: string;
  name: string;
  category: ShoppingCategory;
  price: number;
  imageUrl: string;
  description: string;
  material: string;
  fit: string;
  rating: number;
  reviewCount: number;
  reviews: ShoppingReview[];
};

export const shoppingStores: ShoppingStore[] = [
  { id: 'nike', name: 'Nike', initials: 'N', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.nike.com&sz=128', priceAdjustment: 8 },
  { id: 'lululemon', name: 'lululemon', initials: 'L', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.lululemon.com&sz=128', priceAdjustment: 20 },
  { id: 'hm', name: 'H&M', initials: 'H&M', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.hm.com&sz=128', priceAdjustment: -6 },
  { id: 'under-armour', name: 'Under Armour', initials: 'UA', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.underarmour.com&sz=128', priceAdjustment: 4 },
  { id: 'american-eagle', name: 'American Eagle', initials: 'AE', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.ae.com&sz=128', priceAdjustment: 2 },
  { id: 'old-navy', name: 'Old Navy', initials: 'ON', logoUrl: 'https://www.google.com/s2/favicons?domain_url=https://oldnavy.gap.com&sz=128', priceAdjustment: -12 },
];

const categories: ShoppingCategory[] = ['TOPS', 'PANTS', 'JACKETS', 'SHOES'];

const pricesByCategory: Record<ShoppingCategory, number[]> = {
  TOPS: [26, 24, 48, 58, 52],
  PANTS: [58, 48, 64, 54, 58],
  JACKETS: [72, 78, 88, 76, 96],
  SHOES: [72, 96, 48, 84, 88],
};

const categoryDetails: Record<ShoppingCategory, { material: string; fit: string; description: string }> = {
  TOPS: { material: 'Soft cotton blend', fit: 'Easy everyday fit', description: 'An easy layer made for repeat wear. Pair it with relaxed denim, training pants, or a favorite jacket for a comfortable, considered look.' },
  PANTS: { material: 'Comfort stretch fabric', fit: 'Mid-rise, relaxed through the leg', description: 'A versatile bottom designed to work across casual days and laid-back plans. Style it with a simple top and your everyday shoes.' },
  JACKETS: { material: 'Lightweight woven blend', fit: 'Room for comfortable layering', description: 'A useful extra layer that brings texture and a little polish to everyday outfits. Wear it open over a tee or zipped up when the weather turns.' },
  SHOES: { material: 'Textile and durable rubber', fit: 'Cushioned everyday feel', description: 'An easy-to-style pair for everyday wear. The clean profile works with denim, relaxed trousers, and active looks alike.' },
};

const sampleReviews: ShoppingReview[] = [
  { author: 'Jamie R.', title: 'A new go-to', text: 'Comfortable, easy to style, and just what I wanted for everyday wear.' },
  { author: 'Taylor M.', title: 'Really pleased', text: 'The fit feels great and it works with more of my closet than I expected.' },
  { author: 'Alex P.', title: 'Would recommend', text: 'A thoughtful everyday piece. I have already worked it into a few outfits.' },
];

const sections: ShoppingSection[] = ['men', 'women'];
const imageNames: Record<ShoppingSection, Record<string, string>> = {
  men: shoppingImageNames,
  women: shoppingWomenImageNames,
};

export const shoppingProducts: ShoppingProduct[] = sections.flatMap((section) => shoppingStores.flatMap((store) => categories.flatMap((category) => (
  pricesByCategory[category].map((price, index) => {
    const details = categoryDetails[category];
    const basePrice = price + store.priceAdjustment + (index % 3) * 2;
    const baseId = `${store.id}-${category.toLowerCase()}-${String(index + 1).padStart(2, '0')}`;
    const id = section === 'men' ? baseId : `women-${baseId}`;
    const imageName = imageNames[section][id];
    if (!imageName) throw new Error(`Missing shopping image for ${id}`);

    return {
      id,
      section,
      storeId: store.id,
      name: imageName.charAt(0).toUpperCase() + imageName.slice(1),
      category,
      price: Math.max(12, basePrice),
      imageUrl: `/shopping/${id}.jpg${section === 'women' ? '?v=2' : ''}`,
      description: details.description,
      material: details.material,
      fit: details.fit,
      rating: 4.8,
      reviewCount: 126 + index * 7,
      reviews: sampleReviews,
    };
  })
))));
