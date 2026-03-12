import { ChatProvider } from "../features/chat/providers/ChatProvider";
import ChatPanelContent from "../features/chat/ui/ChatPanelContent";

export default function ChatPanel(props) {
  return (
    <ChatProvider {...props}>
      <ChatPanelContent />
    </ChatProvider>
  );
}
