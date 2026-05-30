import type { CityNodeLayout } from "../mapMetroLayout";

type Props = {
  node: CityNodeLayout;
  here: boolean;
  selected: boolean;
  uiScale: number;
  onClick: () => void;
};

export function MapLabel({ node, here, selected, uiScale, onClick }: Props) {
  const size = Math.max(7, 11 * uiScale);
  return (
    <text
      className={`map-label${selected ? " selected" : ""}${here ? " here" : ""}`}
      x={node.labelX}
      y={node.labelY}
      textAnchor={node.labelAnchor}
      fontSize={size}
      onClick={onClick}
    >
      {node.shortName}
    </text>
  );
}
