import {
  RegularChun,
  RegularHaku,
  RegularHatsu,
  RegularMan1,
  RegularMan2,
  RegularMan3,
  RegularMan4,
  RegularMan5,
  RegularMan6,
  RegularMan7,
  RegularMan8,
  RegularMan9,
  RegularNan,
  RegularPei,
  RegularPin1,
  RegularPin2,
  RegularPin3,
  RegularPin4,
  RegularPin5,
  RegularPin6,
  RegularPin7,
  RegularPin8,
  RegularPin9,
  RegularShaa,
  RegularSou1,
  RegularSou2,
  RegularSou3,
  RegularSou4,
  RegularSou5,
  RegularSou6,
  RegularSou7,
  RegularSou8,
  RegularSou9,
  RegularTon,
} from "riichi-mahjong-tiles";
import { RefreshCw, Sparkles } from "lucide-react";
import { type ComponentType, type DragEvent, type SVGProps, useMemo, useState } from "react";
import {
  classifyTiles,
  Candidate,
  dealGame,
  GameState,
  isMeldCandidate,
  Meld,
  Pile,
  scoreSummary,
  Tile,
  topTile,
} from "./game";

type DragPayload =
  | { from: "pile"; pileId: string; tileId: string }
  | { from: "candidate"; candidateId: string };

type TileComponent = ComponentType<SVGProps<SVGSVGElement>>;

const suitedTileComponents: Record<"man" | "pin" | "sou", TileComponent[]> = {
  man: [
    RegularMan1,
    RegularMan2,
    RegularMan3,
    RegularMan4,
    RegularMan5,
    RegularMan6,
    RegularMan7,
    RegularMan8,
    RegularMan9,
  ],
  pin: [
    RegularPin1,
    RegularPin2,
    RegularPin3,
    RegularPin4,
    RegularPin5,
    RegularPin6,
    RegularPin7,
    RegularPin8,
    RegularPin9,
  ],
  sou: [
    RegularSou1,
    RegularSou2,
    RegularSou3,
    RegularSou4,
    RegularSou5,
    RegularSou6,
    RegularSou7,
    RegularSou8,
    RegularSou9,
  ],
};

const honorTileComponents: Record<number, TileComponent> = {
  1: RegularTon,
  2: RegularNan,
  3: RegularShaa,
  4: RegularPei,
  5: RegularHaku,
  6: RegularHatsu,
  7: RegularChun,
};

function App() {
  const [game, setGame] = useState<GameState>(() => dealGame());
  const selectedTiles = useMemo(
    () => visibleSingleTiles(game).filter((tile) => game.selectedIds.includes(tile.id)),
    [game],
  );
  const scoring = useMemo(
    () => scoreSummary(game.melds, game.pair, game.lastTile),
    [game.melds, game.pair, game.lastTile],
  );

  const restart = () => setGame(dealGame());

  const commitTileIds = (tileIds?: string[]) => {
    setGame((current) => commitTilesFromState(current, tileIds ?? current.selectedIds));
  };

  const toggleSelection = (tile: Tile, pileId: string) => {
    setGame((current) => {
      if (current.cleared) return current;
      const pile = current.piles.find((item) => item.id === pileId);
      if (topTile(pile ?? { id: "", tiles: [] })?.id !== tile.id) return current;

      const selected = current.selectedIds.includes(tile.id)
        ? current.selectedIds.filter((id) => id !== tile.id)
        : [...current.selectedIds, tile.id].slice(-3);

      return { ...current, selectedIds: selected };
    });
  };

  const commitSelected = () => {
    commitTileIds();
  };

  const onDragStart = (event: DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropToStage = (event: DragEvent) => {
    event.preventDefault();
    const payload = readPayload(event);
    if (payload?.from === "candidate") {
      setGame((current) => sendCandidatePairToStage(current, payload.candidateId));
      return;
    }

    if (payload?.from === "pile") {
      setGame((current) => ({
        ...current,
        selectedIds: current.selectedIds.includes(payload.tileId)
          ? current.selectedIds
          : [...current.selectedIds, payload.tileId].slice(-3),
      }));
      window.setTimeout(commitSelected, 0);
      return;
    }
    commitSelected();
  };

  const onDropToTableauTile = (event: DragEvent, targetTile: Tile, targetPileId: string) => {
    event.preventDefault();
    const payload = readPayload(event);
    if (!payload) return;

    setGame((current) => {
      if (current.cleared) return current;

      const targetPile = current.piles.find((pile) => pile.id === targetPileId);
      if (topTile(targetPile ?? { id: "", tiles: [] })?.id !== targetTile.id) return current;

      if (payload.from === "candidate") {
        const candidate = current.candidates.find((item) => item.id === payload.candidateId);
        if (!candidate) return current;

        const tiles = [...candidate.tiles, targetTile];
        const kind = classifyTiles(tiles);
        if (!kind || kind === "pair") {
          return {
            ...current,
            message: "その牌では候補を面子にできません。",
          };
        }

        return commitCandidateFromState(current, candidate.id, targetTile);
      }

      if (payload.tileId === targetTile.id) return current;

      const sourcePile = current.piles.find((pile) => pile.id === payload.pileId);
      if (current.candidates.some((candidate) => candidate.pileId === targetPileId)) {
        return {
          ...current,
          message: "この山の上にはすでに面子候補があります。候補に3枚目を重ねてください。",
        };
      }
      if (topTile(sourcePile ?? { id: "", tiles: [] })?.id !== payload.tileId) return current;

      const candidateTiles = [targetTile, topTile(sourcePile!)].filter(Boolean) as Tile[];

      if (isMeldCandidate(candidateTiles)) {
        return createCandidateFromState(current, payload.pileId, targetPileId);
      }

      return {
        ...current,
        selectedIds: candidateTiles.map((tile) => tile.id),
        message: "その2枚は面子候補になりません。",
      };
    });
  };

  const onDropToCandidate = (event: DragEvent, candidate: Candidate) => {
    event.preventDefault();
    const payload = readPayload(event);
    if (!payload || payload.from !== "pile") return;

    setGame((current) => {
      if (current.cleared) return current;

      const sourcePile = current.piles.find((pile) => pile.id === payload.pileId);
      const tile = topTile(sourcePile ?? { id: "", tiles: [] });
      const currentCandidate = current.candidates.find((item) => item.id === candidate.id);
      if (!tile || tile.id !== payload.tileId || !currentCandidate) return current;

      const tiles = [...currentCandidate.tiles, tile];
      const kind = classifyTiles(tiles);
      if (!kind || kind === "pair") {
        return {
          ...current,
          message: "その牌では候補を面子にできません。",
        };
      }

      return commitCandidateFromState(current, currentCandidate.id, tile);
    });
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>麻雀ソリティア</h1>
          <p>{game.message}</p>
        </div>
        <button className="icon-button" onClick={restart} type="button" title="新しいゲーム">
          <RefreshCw size={20} />
        </button>
      </header>

      {!game.cleared && <section className="solitaire-table" aria-label="14の山">
        {game.piles.map((pile, index) => {
          const tile = topTile(pile);
          const selected = tile ? game.selectedIds.includes(tile.id) : false;
          const pileCandidate = game.candidates.find((candidate) => candidate.pileId === pile.id);
          const canUseTile = tile && !pileCandidate;

          return (
            <div
              className="tableau-pile"
              key={pile.id}
              onDragOver={(event) => (tile || pileCandidate) && event.preventDefault()}
              onDrop={(event) => {
                if (pileCandidate) {
                  onDropToCandidate(event, pileCandidate);
                } else if (tile) {
                  onDropToTableauTile(event, tile, pile.id);
                }
              }}
            >
              <div className="pile-label">山 {index + 1}</div>
              <div className="stack-depth" aria-hidden="true">
                {pile.tiles.slice(0, -1).map((hiddenTile, hiddenIndex) => (
                  <span
                    className="stack-card"
                    key={hiddenTile.id}
                    style={{ transform: `translateY(${Math.min(hiddenIndex, 12) * 2}px)` }}
                  />
                ))}
              </div>
              {pileCandidate ? (
                <div className="pile-candidates">
                  <div
                    className="candidate-stack on-pile"
                    draggable={!game.cleared}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={(event) =>
                      onDragStart(event, { from: "candidate", candidateId: pileCandidate.id })
                    }
                    onDrop={(event) => onDropToCandidate(event, pileCandidate)}
                  >
                    {pileCandidate.tiles.map((candidateTile, candidateIndex) => (
                      <span
                        className="candidate-tile"
                        key={candidateTile.id}
                        style={{ transform: `translateX(${candidateIndex * 20}px)` }}
                      >
                        <TileView tile={candidateTile} compact />
                      </span>
                    ))}
                  </div>
                  {classifyTiles(pileCandidate.tiles) === "pair" && !game.pair && (
                    <button
                      className="pair-send-button"
                      onClick={() =>
                        setGame((current) => sendCandidatePairToStage(current, pileCandidate.id))
                      }
                      type="button"
                    >
                      雀頭へ
                    </button>
                  )}
                </div>
              ) : null}
              {canUseTile ? (
                <button
                  className={`tableau-tile ${selected ? "selected" : ""}`}
                  draggable={!game.cleared}
                  onClick={() => toggleSelection(tile, pile.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) =>
                    onDragStart(event, { from: "pile", pileId: pile.id, tileId: tile.id })
                  }
                  onDrop={(event) => onDropToTableauTile(event, tile, pile.id)}
                  type="button"
                >
                  <TileView tile={tile} />
                </button>
              ) : pileCandidate ? null : (
                <div className="empty-pile">空</div>
              )}
              <div className="pile-count">{pile.tiles.length}</div>
            </div>
          );
        })}
      </section>}

      <section className="play-area">
        <div
          className={`stage ${game.cleared ? "cleared" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropToStage}
        >
          <div className="section-title">ステージ</div>
          <button
            className="commit-button"
            disabled={selectedTiles.length < 2 || game.cleared}
            onClick={commitSelected}
            type="button"
          >
            <Sparkles size={18} />
            確定
          </button>

          <div className="meld-grid">
            {game.melds.map((meld) => (
              <MeldView key={meld.id} meld={meld} />
            ))}
            {Array.from({ length: 4 - game.melds.length }, (_, index) => (
              <div className="meld-slot" key={`slot-${index}`}>
                面子
              </div>
            ))}
            {game.pair ? (
              <MeldView meld={game.pair} />
            ) : (
              <div className="meld-slot pair-slot">雀頭</div>
            )}
          </div>

          {game.cleared && (
            <div className="score-panel clear-panel">
              <div className="clear-burst" aria-hidden="true" />
              <div className="clear-title">CLEAR</div>
              <p className="clear-copy">4面子1雀頭が完成しました。</p>
              <div className="section-title">役判定</div>
              {scoring.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <div className="cleared-hand">
                {game.hand.map((tile) => (
                  <TileView key={tile.id} tile={tile} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function visibleTiles(piles: Pile[]): Tile[] {
  return piles.flatMap((pile) => {
    const tile = topTile(pile);
    return tile ? [tile] : [];
  });
}

function visibleSingleTiles(game: GameState): Tile[] {
  const blockedPileIds = new Set(game.candidates.map((candidate) => candidate.pileId));
  return game.piles.flatMap((pile) => {
    if (blockedPileIds.has(pile.id)) return [];
    const tile = topTile(pile);
    return tile ? [tile] : [];
  });
}

function commitTilesFromState(current: GameState, tileIds: string[]): GameState {
  const targetIds = uniqueIds(tileIds);
  const tiles = visibleTiles(current.piles).filter((tile) => targetIds.includes(tile.id));
  const kind = classifyTiles(tiles);

  if (!kind) {
    return {
      ...current,
      selectedIds: targetIds.slice(-3),
      message: "選択した牌は有効な面子または雀頭ではありません。",
    };
  }

  if (kind === "pair" && current.pair) {
    return {
      ...current,
      selectedIds: targetIds,
      message: "雀頭はすでに確定済みです。",
    };
  }

  if (kind !== "pair" && current.melds.length >= 4) {
    return {
      ...current,
      selectedIds: targetIds,
      message: "面子は4組までです。",
    };
  }

  const meld: Meld = {
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    tiles: sortTilesForMeld(tiles),
  };
  const nextMelds = kind === "pair" ? current.melds : [...current.melds, meld];
  const nextPair = kind === "pair" ? meld : current.pair;
  const cleared = nextMelds.length === 4 && Boolean(nextPair);
  const usedIds = new Set(tiles.map((tile) => tile.id));

  return {
    ...current,
    piles: current.piles.map((pile) => {
      const tile = topTile(pile);
      return tile && usedIds.has(tile.id) ? { ...pile, tiles: pile.tiles.slice(0, -1) } : pile;
    }),
    hand: [...current.hand, ...tiles],
    selectedIds: [],
    melds: nextMelds,
    pair: nextPair,
    lastTile: tiles[tiles.length - 1] ?? current.lastTile,
    cleared,
    message: cleared
      ? "クリアです。最後に動かした牌を自摸牌として役判定に進みます。"
      : `${kindLabel(kind)}をステージへ送りました。`,
  };
}

function createCandidateFromState(
  current: GameState,
  sourcePileId: string,
  targetPileId: string,
): GameState {
  const sourcePile = current.piles.find((pile) => pile.id === sourcePileId);
  const targetPile = current.piles.find((pile) => pile.id === targetPileId);
  const sourceTile = sourcePile ? topTile(sourcePile) : undefined;
  const targetTile = targetPile ? topTile(targetPile) : undefined;
  const tiles = [targetTile, sourceTile].filter(Boolean) as Tile[];

  if (!isMeldCandidate(tiles)) {
    return {
      ...current,
      selectedIds: tiles.map((tile) => tile.id),
      message: "その2枚は面子候補になりません。",
    };
  }

  return {
    ...current,
    piles: current.piles.map((pile) =>
      pile.id === sourcePileId ? { ...pile, tiles: pile.tiles.slice(0, -1) } : pile,
    ),
    candidates: [
      ...current.candidates,
      {
        id: `candidate-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        pileId: targetPileId,
        tiles: sortTilesForMeld(tiles),
      },
    ],
    selectedIds: [],
    message: `${tiles.map((tile) => tile.label).join("・")}を面子候補として重ねました。下の牌がめくれます。`,
  };
}

function commitCandidateFromState(
  current: GameState,
  candidateId: string,
  addedTile: Tile,
): GameState {
  const candidate = current.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    return current;
  }

  const tiles = [...candidate.tiles, addedTile];
  const kind = classifyTiles(tiles);

  if (!kind || kind === "pair") {
    return {
      ...current,
      message: "その牌では候補を面子にできません。",
    };
  }

  if (current.melds.length >= 4) {
    return {
      ...current,
      message: "面子は4組までです。",
    };
  }

  const meld: Meld = {
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    tiles: sortTilesForMeld(tiles),
  };
  const nextMelds = [...current.melds, meld];
  const cleared = nextMelds.length === 4 && Boolean(current.pair);

  return {
    ...current,
    piles: current.piles.map((pile) => {
      const tile = topTile(pile);
      if (tile?.id === addedTile.id) {
        return { ...pile, tiles: pile.tiles.slice(0, -1) };
      }
      if (pile.id === candidate.pileId) {
        return { ...pile, tiles: pile.tiles.slice(0, -1) };
      }
      return pile;
    }),
    candidates: current.candidates.filter((item) => item.id !== candidateId),
    hand: [...current.hand, ...tiles],
    melds: nextMelds,
    selectedIds: [],
    lastTile: addedTile,
    cleared,
    message: cleared
      ? "クリアです。最後に動かした牌を自摸牌として役判定に進みます。"
      : `${kindLabel(kind)}をステージへ送りました。`,
  };
}

function sendCandidatePairToStage(current: GameState, candidateId: string): GameState {
  const candidate = current.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    return current;
  }

  const kind = classifyTiles(candidate.tiles);
  if (kind !== "pair") {
    return {
      ...current,
      message: "雀頭として送れるのは同じ牌2枚の候補だけです。",
    };
  }

  if (current.pair) {
    return {
      ...current,
      message: "雀頭はすでに確定済みです。",
    };
  }

  const pair: Meld = {
    id: `pair-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "pair",
    tiles: sortTilesForMeld(candidate.tiles),
  };
  const cleared = current.melds.length === 4;

  return {
    ...current,
    piles: current.piles.map((pile) =>
      pile.id === candidate.pileId ? { ...pile, tiles: pile.tiles.slice(0, -1) } : pile,
    ),
    candidates: current.candidates.filter((item) => item.id !== candidateId),
    hand: [...current.hand, ...candidate.tiles],
    pair,
    selectedIds: [],
    lastTile: candidate.tiles[candidate.tiles.length - 1] ?? current.lastTile,
    cleared,
    message: cleared
      ? "クリアです。最後に動かした牌を自摸牌として役判定に進みます。"
      : "暗刻候補を雀頭としてステージへ送りました。",
  };
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function sortTilesForMeld(tiles: Tile[]): Tile[] {
  return [...tiles].sort((left, right) => tileSortValue(left) - tileSortValue(right));
}

function tileSortValue(tile: Tile): number {
  const suitOrder: Record<Tile["suit"], number> = {
    man: 0,
    pin: 1,
    sou: 2,
    honor: 3,
  };

  return suitOrder[tile.suit] * 10 + tile.value;
}

function readPayload(event: DragEvent): DragPayload | null {
  try {
    return JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
  } catch {
    return null;
  }
}

function kindLabel(kind: Meld["kind"]): string {
  if (kind === "sequence") return "順子";
  if (kind === "triplet") return "刻子";
  return "雀頭";
}

function TileView({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  const TileAsset = resolveTileAsset(tile);

  return (
    <span className={`tile ${compact ? "compact" : ""}`} title={tile.label}>
      <TileAsset aria-label={tile.label} role="img" />
    </span>
  );
}

function resolveTileAsset(tile: Tile): TileComponent {
  if (tile.suit === "honor") {
    return honorTileComponents[tile.value];
  }

  return suitedTileComponents[tile.suit][tile.value - 1];
}

function MeldView({ meld }: { meld: Meld }) {
  return (
    <div className="meld">
      <span className="meld-kind">{kindLabel(meld.kind)}</span>
      <div>
        {meld.tiles.map((tile) => (
          <TileView key={tile.id} tile={tile} compact />
        ))}
      </div>
    </div>
  );
}

export default App;
