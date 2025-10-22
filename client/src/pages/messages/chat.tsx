import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Send, ArrowLeft, Paperclip, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Message } from '@shared/schema';

export default function Chat() {
  const [, params] = useRoute('/messages/:jobId');
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', params?.jobId],
    enabled: !!params?.jobId,
  });

  const { data: messages, isLoading } = useQuery<(Message & { sender: any })[]>({
    queryKey: ['/api/messages', params?.jobId],
    enabled: !!params?.jobId,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest('POST', '/api/messages', {
        jobId: params?.jobId,
        messageText: text,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', params?.jobId] });
      setMessageText('');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessageMutation.mutate(messageText);
    }
  };

  const otherUser = job?.requesterId === user?.id ? job?.provider : job?.requester;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl h-[calc(100vh-8rem)]">
      <Card className="h-full flex flex-col">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherUser?.profilePhotoUrl} />
              <AvatarFallback>{otherUser?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="font-semibold">{otherUser?.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{job?.title}</p>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <Skeleton className="h-16 w-64 rounded-2xl" />
              </div>
            ))
          ) : messages && messages.length > 0 ? (
            messages.map((message) => {
              const isSender = message.senderId === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isSender ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isSender
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.messageText}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isSender ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
