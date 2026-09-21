import PageHeader from '../../components/common/PageHeader';
import ChatWorkspace from '../../features/chat/ChatWorkspace';

const MessagesPage = () => (
  <div>
    <PageHeader
      title="Messages"
      subtitle="Real-time conversations with organizers, exhibitors and attendees. Typing indicators and read receipts update live."
    />
    <ChatWorkspace />
  </div>
);

export default MessagesPage;
