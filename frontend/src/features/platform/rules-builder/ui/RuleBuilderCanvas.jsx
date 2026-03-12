import { Box } from "@mui/material";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

import ActionNode from "./ActionNode";
import ConditionNode from "./ConditionNode";
import TriggerNode from "./TriggerNode";

const nodeTypes = {
  triggerNode: TriggerNode,
  conditionNode: ConditionNode,
  actionNode: ActionNode,
};

export default function RuleBuilderCanvas({ nodes, edges, onNodeSelect }) {
  return (
    <Box
      sx={{
        height: 420,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
        <Background gap={18} size={1.2} />
      </ReactFlow>
    </Box>
  );
}
