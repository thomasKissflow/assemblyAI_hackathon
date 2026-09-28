export type DishId = 'chicken_curry' | 'jeera_rice' | 'garlic_naan' | 'roast_potatoes' | 'salmon' | 'green_beans';
export type MenuId = 'indian' | 'western';

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
  photo: string;
  steps: RecipeStep[];
}

const step = (id: string, label: string, call: string, minutes: number): RecipeStep => ({ id, label, call, minutes });

export const RECIPES: Record<DishId, Recipe> = {
  chicken_curry: {
    id: 'chicken_curry', name: 'Chicken curry', short: 'curry', photo: '/dishes/chicken_curry.jpg',
    steps: [
      step('base', 'Fry onions, ginger & garlic', 'Curry on. Onions, ginger and garlic in the pan.', 8),
      step('chicken', 'Add chicken & spices', 'Chicken and spices into the curry.', 7),
      step('simmer', 'Simmer with tomatoes', 'Tomatoes in. Curry down to a low simmer.', 20),
    ],
  },
  jeera_rice: {
    id: 'jeera_rice', name: 'Jeera rice', short: 'rice', photo: '/dishes/jeera_rice.jpg',
    steps: [
      step('soak', 'Rinse & soak rice', 'Rice. Rinse it and leave it to soak.', 10),
      step('temper', 'Cumin in ghee, add rice & water', 'Cumin into hot ghee, then rice and water.', 3),
      step('steam', 'Boil, then steam on low', 'Rice to the boil, then lid on, lowest heat.', 15),
      step('rest', 'Rest, lid on', 'Rice off the heat. Keep the lid on.', 5),
    ],
  },
  garlic_naan: {
    id: 'garlic_naan', name: 'Garlic naan', short: 'naan', photo: '/dishes/garlic_naan.jpg',
    steps: [
      step('dough', 'Mix & knead dough', 'Naan. Mix and knead the dough.', 6),
      step('rest', 'Rest dough', 'Cover the naan dough. Let it rest.', 20),
      step('cook', 'Roll & cook naan', 'Roll the naan. Hot pan, one at a time.', 10),
      step('butter', 'Brush with garlic butter', 'Garlic butter on the naan.', 2),
    ],
  },
  roast_potatoes: {
    id: 'roast_potatoes', name: 'Roast potatoes', short: 'potatoes', photo: '/dishes/roast_potatoes.jpg',
    steps: [
      step('prep', 'Peel & chop potatoes', 'Potatoes. Peel and chop them.', 6),
      step('parboil', 'Parboil potatoes', 'Potatoes into boiling water.', 8),
      step('roast', 'Roast in the oven', 'Potatoes into the oven.', 30),
    ],
  },
  salmon: {
    id: 'salmon', name: 'Salmon', short: 'salmon', photo: '/dishes/salmon.jpg',
    steps: [
      step('season', 'Season the salmon', 'Salmon. Season it.', 4),
      step('bake', 'Bake the salmon', 'Salmon into the oven.', 14),
      step('rest', 'Rest the salmon', 'Salmon out. Let it rest.', 3),
    ],
  },
  green_beans: {
    id: 'green_beans', name: 'Green beans', short: 'beans', photo: '/dishes/green_beans.jpg',
    steps: [
      step('trim', 'Trim the beans', 'Beans. Trim them.', 5),
      step('blanch', 'Blanch the beans', 'Beans into boiling water.', 4),
      step('toss', 'Toss in butter & lemon', 'Beans out. Butter and lemon.', 2),
    ],
  },
};

export const MENUS: Record<MenuId, { label: string; dishes: DishId[] }> = {
  indian: { label: 'Indian dinner', dishes: ['chicken_curry', 'jeera_rice', 'garlic_naan'] },
  western: { label: 'Western dinner', dishes: ['salmon', 'roast_potatoes', 'green_beans'] },
};
