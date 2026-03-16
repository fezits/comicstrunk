import { TEST_PREFIX } from './test-constants';

export const HEROES: string[] = [
  // Marvel
  'Wolverine', 'Storm', 'Spider-Man', 'Iron Man', 'Captain America',
  'Thor', 'Hulk', 'Black Widow', 'Hawkeye', 'Scarlet Witch',
  'Vision', 'Ant-Man', 'Wasp', 'Black Panther', 'Doctor Strange',
  'Deadpool', 'Cable', 'Gambit', 'Rogue', 'Cyclops',
  'Jean Grey', 'Beast', 'Nightcrawler', 'Colossus', 'Psylocke',
  'Daredevil', 'Punisher', 'Ghost Rider', 'Silver Surfer', 'Thanos',
  'Magneto', 'Mystique', 'Venom', 'Carnage', 'Moon Knight',
  'She-Hulk', 'Ms Marvel', 'Nova', 'Star-Lord', 'Gamora',
  'Drax', 'Groot', 'Rocket',
  // DC
  'Batman', 'Superman', 'Wonder Woman', 'Flash', 'Aquaman',
  'Green Lantern', 'Cyborg', 'Shazam', 'Hawkgirl', 'Martian Manhunter',
  'Nightwing', 'Batgirl', 'Robin', 'Red Hood', 'Starfire',
  'Raven', 'Beast Boy', 'Deathstroke', 'Joker', 'Harley Quinn',
  'Catwoman', 'Poison Ivy', 'Supergirl', 'Green Arrow', 'Black Canary',
  'Constantine', 'Zatanna', 'Swamp Thing',
  // Manga
  'Goku', 'Naruto', 'Luffy', 'Ichigo', 'Vegeta',
  'Sasuke', 'Zoro', 'Tanjiro', 'Deku', 'Gon',
  'Killua', 'Levi', 'Eren', 'Saitama', 'Light Yagami',
  // Brazilian Comics (Turma da Monica)
  'Monica', 'Cebolinha', 'Cascao', 'Magali', 'Chico Bento',
  'Papa-Capim', 'Penadinho', 'Horacio', 'Piteco', 'Astronauta',
  'Bidu', 'Floquinho',
];

export const SERIES_PREFIXES: string[] = [
  'The Amazing', 'The Incredible', 'Secret Wars', 'Chronicles of',
  'The Spectacular', 'The Uncanny', 'New', 'Ultimate', 'Legends of',
  'Adventures of', 'Tales of', 'The Mighty', 'Dark', 'Infinite',
  'Saga of', 'The Invincible', 'Rise of', 'Fall of', 'Return of',
  'World of', 'Age of', 'Dawn of', 'Reign of', 'War of',
];

export const PUBLISHERS: string[] = [
  'Marvel Comics', 'DC Comics', 'Panini', 'JBC', 'NewPOP',
  'Abril', 'Globo', 'Conrad', 'Devir', 'Mythos',
  'Image Comics', 'Dark Horse', 'IDW Publishing', 'Boom! Studios',
  'Valiant', 'Dynamite', 'Titan Comics', 'Viz Media', 'Kodansha',
  'Shueisha', 'Shogakukan', 'MSP (Mauricio de Sousa)',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function generateCharacterName(): string {
  return `${TEST_PREFIX}${randomFrom(HEROES)}_${uniqueSuffix()}`;
}

export function generateSeriesTitle(): string {
  return `${TEST_PREFIX}${randomFrom(SERIES_PREFIXES)} ${randomFrom(HEROES)}_${uniqueSuffix()}`;
}

export function generateCatalogTitle(editionNumber?: number): string {
  const num = editionNumber ?? Math.floor(Math.random() * 500) + 1;
  return `${TEST_PREFIX}${randomFrom(HEROES)} #${num}_${uniqueSuffix()}`;
}

export function randomPublisher(): string {
  return randomFrom(PUBLISHERS);
}

export function generateUserName(): string {
  return `${TEST_PREFIX}${randomFrom(HEROES)} Fan_${uniqueSuffix()}`;
}

export function generateTestEmail(): string {
  return `${TEST_PREFIX}${uniqueSuffix()}@e2e-test.com`;
}
