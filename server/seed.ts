import { db } from "./db";
import { categories } from "@shared/schema";

export async function seedDatabase() {
  console.log('Seeding database...');

  const defaultCategories = [
    { name: 'Plumbing', description: 'Plumbing services and repairs' },
    { name: 'Electrical', description: 'Electrical work and installations' },
    { name: 'Carpentry', description: 'Wood work and furniture' },
    { name: 'Painting', description: 'Interior and exterior painting' },
    { name: 'Cleaning', description: 'House and office cleaning' },
    { name: 'Gardening', description: 'Garden maintenance and landscaping' },
    { name: 'HVAC', description: 'Heating, ventilation, and air conditioning' },
    { name: 'Roofing', description: 'Roof repair and installation' },
    { name: 'Masonry', description: 'Brick and stone work' },
    { name: 'Moving', description: 'Relocation and moving services' },
  ];

  try {
    // Check if categories already exist
    const existingCategories = await db.select().from(categories);
    
    if (existingCategories.length === 0) {
      await db.insert(categories).values(defaultCategories);
      console.log('✅ Categories seeded successfully');
    } else {
      console.log('ℹ️  Categories already exist, skipping seed');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
