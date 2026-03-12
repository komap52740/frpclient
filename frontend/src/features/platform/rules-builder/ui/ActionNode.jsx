import { Position } from "reactflow";

import RuleNodeCard from "./RuleNodeCard";

export default function ActionNode({ data }) {
  return (
    <RuleNodeCard
      color="#0f766e"
      data={data}
      sourcePosition={Position.Right}
      targetPosition={Position.Left}
    />
  );
}
