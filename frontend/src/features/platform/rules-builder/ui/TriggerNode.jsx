import { Position } from "reactflow";

import RuleNodeCard from "./RuleNodeCard";

export default function TriggerNode({ data }) {
  return (
    <RuleNodeCard
      color="#2563eb"
      data={data}
      sourcePosition={Position.Right}
      targetPosition={Position.Left}
    />
  );
}
