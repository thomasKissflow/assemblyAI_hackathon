export type DishId = string;
export type DishKind = 'curry' | 'rice' | 'bread' | 'roast' | 'fish' | 'veg' | 'pasta' | 'soup' | 'salad' | 'dessert' | 'other';
export const DISH_KINDS: DishKind[] = ['curry', 'rice', 'bread', 'roast', 'fish', 'veg', 'pasta', 'soup', 'salad', 'dessert', 'other'];

export interface RecipeStep {
  id: string;
  label: string;
  call: string;
  minutes: number;
}

export interface Recipe {
  id: DishId;
  name: string;
  short: string;
  /** A dish photo for built-ins; custom recipes use their kind's plate art (kindPhoto). */
  photo: string;
  kind: DishKind;
  steps: RecipeStep[];
  ingredients?: string[];
  /** Saved by the cook (lives in the browser's library). */
  custom?: boolean;
  /** For a cook's customised copy of a built-in recipe. */
  basedOn?: DishId;
  updatedAt?: number;
}

export interface Menu {
  id: string;
  label: string;
  dishes: DishId[];
  custom?: boolean;
}

export const kindPhoto = (kind: DishKind) => `/dishes/kinds/${kind}.svg`;

const step = (id: string, label: string, call: string, minutes: number): RecipeStep => ({ id, label, call, minutes });

export const BUILTIN_RECIPES: Recipe[] = [
  {
    id: 'chicken_curry', name: 'Chicken curry', short: 'curry', photo: '/dishes/chicken_curry.jpg', kind: 'curry',
    steps: [
      step('base', 'Fry onions, ginger & garlic', 'Curry on. Onions, ginger and garlic in the pan.', 8),
      step('chicken', 'Add chicken & spices', 'Chicken and spices into the curry.', 7),
      step('simmer', 'Simmer with tomatoes', 'Tomatoes in. Curry down to a low simmer.', 20),
    ],
  },
  {
    id: 'jeera_rice', name: 'Jeera rice', short: 'rice', photo: '/dishes/jeera_rice.jpg', kind: 'rice',
    steps: [
      step('soak', 'Rinse & soak rice', 'Rice. Rinse it and leave it to soak.', 10),
      step('temper', 'Cumin in ghee, add rice & water', 'Cumin into hot ghee, then rice and water.', 3),
      step('steam', 'Boil, then steam on low', 'Rice to the boil, then lid on, lowest heat.', 15),
      step('rest', 'Rest, lid on', 'Rice off the heat. Keep the lid on.', 5),
    ],
  },
  {
    id: 'garlic_naan', name: 'Garlic naan', short: 'naan', photo: '/dishes/garlic_naan.jpg', kind: 'bread',
    steps: [
      step('dough', 'Mix & knead dough', 'Naan. Mix and knead the dough.', 6),
      step('rest', 'Rest dough', 'Cover the naan dough. Let it rest.', 20),
      step('cook', 'Roll & cook naan', 'Roll the naan. Hot pan, one at a time.', 10),
      step('butter', 'Brush with garlic butter', 'Garlic butter on the naan.', 2),
    ],
  },
  {
    id: 'roast_potatoes', name: 'Roast potatoes', short: 'potatoes', photo: '/dishes/roast_potatoes.jpg', kind: 'roast',
    steps: [
      step('prep', 'Peel & chop potatoes', 'Potatoes. Peel and chop them.', 6),
      step('parboil', 'Parboil potatoes', 'Potatoes into boiling water.', 8),
      step('roast', 'Roast in the oven', 'Potatoes into the oven.', 30),
    ],
  },
  {
    id: 'salmon', name: 'Salmon', short: 'salmon', photo: '/dishes/salmon.jpg', kind: 'fish',
    steps: [
      step('season', 'Season the salmon', 'Salmon. Season it.', 4),
      step('bake', 'Bake the salmon', 'Salmon into the oven.', 14),
      step('rest', 'Rest the salmon', 'Salmon out. Let it rest.', 3),
    ],
  },
  {
    id: 'green_beans', name: 'Green beans', short: 'beans', photo: '/dishes/green_beans.jpg', kind: 'veg',
    steps: [
      step('trim', 'Trim the beans', 'Beans. Trim them.', 5),
      step('blanch', 'Blanch the beans', 'Beans into boiling water.', 4),
      step('toss', 'Toss in butter & lemon', 'Beans out. Butter and lemon.', 2),
    ],
  },
];

export const RECIPES: Record<DishId, Recipe> = Object.fromEntries(BUILTIN_RECIPES.map(r => [r.id, r]));

export const BUILTIN_MENUS: Menu[] = [
  { id: 'indian', label: 'Indian dinner', dishes: ['chicken_curry', 'jeera_rice', 'garlic_naan'] },
  { id: 'western', label: 'Western dinner', dishes: ['salmon', 'roast_potatoes', 'green_beans'] },
];

export const MENUS: Record<string, Menu> = Object.fromEntries(BUILTIN_MENUS.map(m => [m.id, m]));

/** The built-in recipes of a built-in menu, in order. */
export function menuRecipes(menuId: string): Recipe[] {
  return MENUS[menuId].dishes.map(id => RECIPES[id]);
}
