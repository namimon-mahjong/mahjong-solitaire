import { Riichi } from "riichi-ts";

export type Suit = "man" | "pin" | "sou" | "honor";
export type GroupKind = "sequence" | "triplet" | "pair";

export type Tile = {
  id: string;
  suit: Suit;
  value: number;
  label: string;
  short: string;
};

export type Meld = {
  id: string;
  kind: GroupKind;
  tiles: Tile[];
};

export type Candidate = {
  id: string;
  pileId: string;
  tiles: Tile[];
};

export type Pile = {
  id: string;
  tiles: Tile[];
};

export type GameState = {
  piles: Pile[];
  hand: Tile[];
  selectedIds: string[];
  candidates: Candidate[];
  melds: Meld[];
  pair: Meld | null;
  lastTile: Tile | null;
  message: string;
  cleared: boolean;
};

const suited: Array<{ suit: Suit; label: string }> = [
  { suit: "man", label: "萬" },
  { suit: "pin", label: "筒" },
  { suit: "sou", label: "索" },
];

const honors = [
  { value: 1, label: "東" },
  { value: 2, label: "南" },
  { value: 3, label: "西" },
  { value: 4, label: "北" },
  { value: 5, label: "白" },
  { value: 6, label: "發" },
  { value: 7, label: "中" },
];

export function createDeck(): Tile[] {
  const tiles: Tile[] = [];

  for (const family of suited) {
    for (let value = 1; value <= 9; value += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({
          id: `${family.suit}-${value}-${copy}`,
          suit: family.suit,
          value,
          label: `${value}${family.label}`,
          short: `${value}${family.label[0]}`,
        });
      }
    }
  }

  for (const honor of honors) {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({
        id: `honor-${honor.value}-${copy}`,
        suit: "honor",
        value: honor.value,
        label: honor.label,
        short: honor.label,
      });
    }
  }

  return tiles;
}

export function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function dealGame(): GameState {
  const deck = shuffle(createDeck());
  const piles: Pile[] = Array.from({ length: 14 }, (_, index) => ({
    id: `pile-${index}`,
    tiles: [],
  }));

  deck.forEach((tile, index) => {
    piles[index % piles.length].tiles.push(tile);
  });

  return {
    piles,
    hand: [],
    selectedIds: [],
    candidates: [],
    melds: [],
    pair: null,
    lastTile: null,
    message: "14の山の一番上に見えている牌を重ね、面子候補を山の中で作ります。",
    cleared: false,
  };
}

export function isMeldCandidate(tiles: Tile[]): boolean {
  if (tiles.length !== 2) {
    return false;
  }

  const [left, right] = tiles;
  if (sameTile(left, right)) {
    return true;
  }

  if (left.suit === "honor" || right.suit === "honor") {
    return false;
  }

  if (left.suit !== right.suit) {
    return false;
  }

  const distance = Math.abs(left.value - right.value);
  return distance === 1 || distance === 2;
}

export function topTile(pile: Pile): Tile | undefined {
  return pile.tiles[pile.tiles.length - 1];
}

export function classifyTiles(tiles: Tile[]): GroupKind | null {
  if (tiles.length === 2) {
    return sameTile(tiles[0], tiles[1]) ? "pair" : null;
  }

  if (tiles.length !== 3) {
    return null;
  }

  const [first, second, third] = tiles;
  if (sameTile(first, second) && sameTile(second, third)) {
    return "triplet";
  }

  if (tiles.some((tile) => tile.suit === "honor")) {
    return null;
  }

  const sameSuit = tiles.every((tile) => tile.suit === first.suit);
  const values = tiles.map((tile) => tile.value).sort((a, b) => a - b);
  const consecutive = values[0] + 1 === values[1] && values[1] + 1 === values[2];

  return sameSuit && consecutive ? "sequence" : null;
}

export function sameTile(left: Tile, right: Tile): boolean {
  return left.suit === right.suit && left.value === right.value;
}

export function scoreSummary(melds: Meld[], pair: Meld | null, lastTile: Tile | null): string[] {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...(pair?.tiles ?? [])];
  const riichiLines = calculateRiichiScore(allTiles, lastTile);
  if (riichiLines.length > 0) {
    return riichiLines;
  }

  const lines: string[] = ["riichi-ts: 和了形として判定できませんでした"];
  const triplets = melds.filter((meld) => meld.kind === "triplet");
  const sequences = melds.filter((meld) => meld.kind === "sequence");

  if (melds.length === 4 && pair) {
    lines.push("和了: 4面子1雀頭");
  }
  if (triplets.length >= 3) {
    lines.push("対々寄り: 刻子が3組以上");
  }
  if (sequences.length === 4) {
    lines.push("平和寄り: 順子4組");
  }
  if (lastTile) {
    lines.push(`自摸牌: ${lastTile.label}`);
  }

  return lines.length > 0 ? lines : ["役なし: PoCスコア"];
}

function calculateRiichiScore(tiles: Tile[], lastTile: Tile | null): string[] {
  if (tiles.length !== 14) {
    return [];
  }

  const orderedTiles = moveLastTileToEnd(tiles, lastTile).map(tileToRiichiIndex);
  const hand = new Riichi(
    orderedTiles,
    [],
    {
      bakaze: 27,
      jikaze: 27,
      firstTake: false,
      riichi: false,
      ippatsu: false,
      daburuRiichi: false,
      lastTake: false,
      afterKan: false,
    },
  );
  hand.disableHairi();

  const result = hand.calc();
  if (result.error || !result.isAgari) {
    return [];
  }

  const yaku = Object.entries(result.yaku).map(
    ([name, han]) => `${yakuLabel(name)} ${han}飜`,
  );

  return [
    `riichi-ts: ${result.name || "和了"} ${result.han}飜${result.fu}符 ${result.ten}点`,
    ...(yaku.length > 0 ? yaku : ["役なし"]),
    ...(lastTile ? [`自摸牌: ${lastTile.label}`] : []),
  ];
}

function moveLastTileToEnd(tiles: Tile[], lastTile: Tile | null): Tile[] {
  if (!lastTile) {
    return tiles;
  }

  const index = tiles.findIndex((tile) => tile.id === lastTile.id);
  if (index < 0) {
    return tiles;
  }

  return [...tiles.slice(0, index), ...tiles.slice(index + 1), tiles[index]];
}

function tileToRiichiIndex(tile: Tile): number {
  if (tile.suit === "man") {
    return tile.value - 1;
  }
  if (tile.suit === "pin") {
    return 8 + tile.value;
  }
  if (tile.suit === "sou") {
    return 17 + tile.value;
  }
  return 26 + tile.value;
}

function yakuLabel(name: string): string {
  const labels: Record<string, string> = {
    menzentsumo: "門前清自摸和",
    riichi: "立直",
    pinfu: "平和",
    tanyao: "断么九",
    iipeikou: "一盃口",
    haku: "白",
    hatsu: "發",
    chun: "中",
    chanta: "混全帯么九",
    ittsu: "一気通貫",
    sanshoku: "三色同順",
    toitoi: "対々和",
    sanankou: "三暗刻",
    honitsu: "混一色",
    chinitsu: "清一色",
    chiitoitsu: "七対子",
    daisangen: "大三元",
    suuankou: "四暗刻",
  };

  return labels[name] ?? name;
}
