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
    ingredients: [
      '700 g chicken thighs, diced', '2 onions, finely chopped', '1 thumb of ginger and 4 garlic cloves, grated',
      '400 g chopped tomatoes', '2 tsp garam masala', '1 tsp each of turmeric, cumin and chilli powder', '3 tbsp oil',
      'Salt and fresh coriander',
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
    ingredients: ['300 g basmati rice', '600 ml water', '2 tbsp ghee', '2 tsp cumin seeds', '1 bay leaf', '1 tsp salt'],
  },
  {
    id: 'garlic_naan', name: 'Garlic naan', short: 'naan', photo: '/dishes/garlic_naan.jpg', kind: 'bread',
    steps: [
      step('dough', 'Mix & knead dough', 'Naan. Mix and knead the dough.', 6),
      step('rest', 'Rest dough', 'Cover the naan dough. Let it rest.', 20),
      step('cook', 'Roll & cook naan', 'Roll the naan. Hot pan, one at a time.', 10),
      step('butter', 'Brush with garlic butter', 'Garlic butter on the naan.', 2),
    ],
    ingredients: [
      '500 g plain flour', '200 g plain yoghurt', '120 ml warm milk', '1 tsp baking powder', '1 tsp each of sugar and salt',
      '4 garlic cloves, minced', '50 g butter, melted', 'Fresh coriander',
    ],
  },
  {
    id: 'roast_potatoes', name: 'Roast potatoes', short: 'potatoes', photo: '/dishes/roast_potatoes.jpg', kind: 'roast',
    steps: [
      step('prep', 'Peel & chop potatoes', 'Potatoes. Peel and chop them.', 6),
      step('parboil', 'Parboil potatoes', 'Potatoes into boiling water.', 8),
      step('roast', 'Roast in the oven', 'Potatoes into the oven.', 30),
    ],
    ingredients: [
      '1.2 kg floury potatoes', '4 tbsp olive oil or goose fat', '1 tbsp semolina or flour', '4 garlic cloves, bashed',
      '2 sprigs of rosemary', 'Salt and pepper',
    ],
  },
  {
    id: 'salmon', name: 'Salmon', short: 'salmon', photo: '/dishes/salmon.jpg', kind: 'fish',
    steps: [
      step('season', 'Season the salmon', 'Salmon. Season it.', 4),
      step('bake', 'Bake the salmon', 'Salmon into the oven.', 14),
      step('rest', 'Rest the salmon', 'Salmon out. Let it rest.', 3),
    ],
    ingredients: [
      '4 salmon fillets, about 150 g each', '2 tbsp olive oil', '1 lemon', '2 garlic cloves, minced', 'Fresh dill or parsley',
      'Salt and pepper',
    ],
  },
  {
    id: 'green_beans', name: 'Green beans', short: 'beans', photo: '/dishes/green_beans.jpg', kind: 'veg',
    steps: [
      step('trim', 'Trim the beans', 'Beans. Trim them.', 5),
      step('blanch', 'Blanch the beans', 'Beans into boiling water.', 4),
      step('toss', 'Toss in butter & lemon', 'Beans out. Butter and lemon.', 2),
    ],
    ingredients: ['400 g green beans', '25 g butter', 'Half a lemon, juiced', '1 garlic clove, sliced (optional)', 'Flaky salt', 'Black pepper'],
  },
  {
    id: 'tomato_pasta', name: 'Spaghetti pomodoro', short: 'pasta', photo: '/dishes/tomato_pasta.jpg', kind: 'pasta',
    steps: [
      step('sauce', 'Start the tomato sauce', 'Pasta sauce on. Garlic in olive oil, then the tomatoes.', 6),
      step('simmer', 'Simmer the sauce', 'Sauce down to a gentle simmer.', 12),
      step('boil', 'Cook the spaghetti', 'Spaghetti into salted boiling water.', 10),
      step('toss', 'Toss pasta in the sauce', 'Spaghetti into the sauce. Toss it with a splash of pasta water.', 2),
    ],
    ingredients: [
      '400 g spaghetti', '2 tins (800 g) whole plum tomatoes', '4 garlic cloves, sliced', '4 tbsp olive oil',
      'A handful of basil', '40 g parmesan, grated', 'Salt and a pinch of sugar',
    ],
  },
  {
    id: 'garlic_bread', name: 'Garlic bread', short: 'bread', photo: '/dishes/garlic_bread.jpg', kind: 'bread',
    steps: [
      step('butter', 'Mix garlic butter', 'Garlic bread. Mash the butter with garlic and parsley.', 4),
      step('spread', 'Butter & wrap the loaf', 'Butter onto the bread, then wrap it in foil.', 3),
      step('bake', 'Bake the bread', 'Garlic bread into the oven.', 12),
    ],
    ingredients: ['1 baguette', '100 g soft butter', '4 garlic cloves, crushed', '2 tbsp chopped parsley', 'A pinch of salt'],
  },
  {
    id: 'green_salad', name: 'Green salad', short: 'salad', photo: '/dishes/green_salad.jpg', kind: 'salad',
    steps: [
      step('wash', 'Wash & dry the leaves', 'Salad. Wash and dry the leaves.', 5),
      step('dress', 'Whisk the dressing', 'Whisk the salad dressing.', 3),
      step('toss', 'Dress & toss', 'Dress the salad and toss it.', 2),
    ],
    ingredients: [
      '200 g mixed salad leaves', 'Half a cucumber, sliced', '3 tbsp olive oil', '1 tbsp lemon juice or white wine vinegar',
      '1 tsp Dijon mustard', 'Salt and pepper',
    ],
  },
  {
    id: 'dal_tadka', name: 'Dal tadka', short: 'dal', photo: '/dishes/dal_tadka.jpg', kind: 'curry',
    steps: [
      step('rinse', 'Rinse the dal', 'Dal. Rinse it till the water runs clear.', 3),
      step('cook', 'Pressure cook with turmeric', 'Dal into the pressure cooker with turmeric and salt.', 15),
      step('tadka', 'Make the tadka', 'Tadka. Ghee, cumin, garlic and chilli, then pour it over the dal.', 5),
      step('finish', 'Simmer & finish', 'Dal down to a simmer. Coriander on top.', 5),
    ],
    ingredients: [
      '250 g toor dal (split pigeon peas)', '1 litre water', 'Half a tsp turmeric', '2 tbsp ghee', '1 tsp cumin seeds',
      '4 garlic cloves, sliced', '2 dried red chillies', 'Salt and fresh coriander',
    ],
  },
  {
    id: 'aloo_gobi', name: 'Aloo gobi', short: 'gobi', photo: '/dishes/aloo_gobi.jpg', kind: 'veg',
    steps: [
      step('chop', 'Chop potato & cauliflower', 'Aloo gobi. Chop the potato and cauliflower.', 8),
      step('fry', 'Fry with spices', 'Potato and cauliflower into the pan with the spices.', 7),
      step('cook', 'Cover & cook on low', 'Lid on the aloo gobi. Low heat.', 15),
    ],
    ingredients: [
      '1 small cauliflower, in florets', '3 medium potatoes, cubed', '1 onion, sliced', '1 tsp cumin seeds',
      'Half a tsp turmeric', '1 tsp garam masala', '3 tbsp oil', 'Salt and fresh coriander',
    ],
  },
  {
    id: 'roti', name: 'Roti', short: 'roti', photo: '/dishes/roti.jpg', kind: 'bread',
    steps: [
      step('dough', 'Knead the dough', 'Roti. Knead the dough.', 5),
      step('rest', 'Rest the dough', 'Cover the roti dough. Let it rest.', 15),
      step('cook', 'Roll & cook roti', 'Roll the roti. Hot tawa, one at a time.', 10),
    ],
    ingredients: ['300 g chapati atta (wholemeal flour)', '200 ml warm water', '1 tbsp oil', 'Half a tsp salt', 'Ghee for brushing'],
  },
];

export const RECIPES: Record<DishId, Recipe> = Object.fromEntries(BUILTIN_RECIPES.map(r => [r.id, r]));

export const BUILTIN_MENUS: Menu[] = [
  { id: 'indian', label: 'Indian dinner', dishes: ['chicken_curry', 'jeera_rice', 'garlic_naan'] },
  { id: 'western', label: 'Western dinner', dishes: ['salmon', 'roast_potatoes', 'green_beans'] },
  { id: 'pasta', label: 'Weeknight pasta', dishes: ['tomato_pasta', 'garlic_bread', 'green_salad'] },
  { id: 'veg', label: 'Dal & roti night', dishes: ['dal_tadka', 'aloo_gobi', 'roti'] },
];

export const MENUS: Record<string, Menu> = Object.fromEntries(BUILTIN_MENUS.map(m => [m.id, m]));

/** The built-in recipes of a built-in menu, in order. */
export function menuRecipes(menuId: string): Recipe[] {
  return MENUS[menuId].dishes.map(id => RECIPES[id]);
}
