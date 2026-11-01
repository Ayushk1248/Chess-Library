"use client";

import { Chessboard } from "react-chessboard";

export function RepertoirePreview() {
  return (
    <figure className="product-preview" id="board-preview">
      <figcaption className="preview-heading"><span>Sicilian Defense</span><span>Example repertoire</span></figcaption>
      <div className="preview-body">
        <div><Chessboard options={{ id: "homepage-preview", position: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3", allowDragging: false, darkSquareStyle: { backgroundColor: "var(--color-board-dark)" }, lightSquareStyle: { backgroundColor: "var(--color-board-light)" }, animationDurationInMs: 0 }} /></div>
        <div className="preview-moves"><h3>Main line</h3><p><span>1.</span><span>e4</span><span>c5</span></p><p><span>2.</span><span>Nf3</span><span>d6</span></p></div>
      </div>
      <p className="preview-caption">A position, its moves, and room for every sideline.</p>
    </figure>
  );
}
