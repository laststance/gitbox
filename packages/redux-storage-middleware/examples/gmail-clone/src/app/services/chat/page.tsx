'use client'

import ServicePageLayout from '@/components/services/ServicePageLayout'

const ChatIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#34A853"
      d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
    />
  </svg>
)

const messages = [
  {
    sender: 'Alice',
    text: 'Hey! Did you check out the new localStorage middleware?',
    time: '10:30 AM',
    isMe: false,
  },
  {
    sender: 'You',
    text: 'Yes! It works great with Next.js SSR',
    time: '10:32 AM',
    isMe: true,
  },
  {
    sender: 'Alice',
    text: 'The hydration handling is really smooth',
    time: '10:33 AM',
    isMe: false,
  },
  {
    sender: 'You',
    text: 'Agreed! Navigate away and come back - state persists!',
    time: '10:35 AM',
    isMe: true,
  },
]

export default function ChatPage() {
  return (
    <ServicePageLayout
      serviceName="Chat"
      serviceIcon={ChatIcon}
      serviceColor="#34A853"
    >
      <div className="h-[calc(100vh-200px)] flex flex-col max-w-2xl mx-auto">
        <div className="flex-1 p-4 space-y-4 overflow-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.isMe ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}
              >
                {!msg.isMe && (
                  <p className="text-xs text-gray-400 mb-1">{msg.sender}</p>
                )}
                <p>{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">{msg.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full bg-gray-800 rounded-full px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
    </ServicePageLayout>
  )
}
