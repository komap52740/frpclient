import { Position } from "reactflow";

import RuleNodeCard from "./RuleNodeCard";

export default function ConditionNode({ data }) {
  return (
    <RuleNodeCard
      color="#7c3aed"
      data={data}
      sourcePosition={Position.Right}
      targetPosition={Position.Left}
    />
  );
}
