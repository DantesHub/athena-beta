'use client'
// import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import * as React from 'react'
import { initializeObsidianIndex } from '@/app/actions'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Session } from '@/lib/types'
import { Message } from '@/lib/chat/actions'
import { ChatList } from '@/components/chat/chat-list'
import { cn } from '@/lib/utils'
import { useUIState } from 'ai/rsc'
import { EmptyScreen } from '@/components/empty-screen'
import { ChatScrollAnchor } from '@/components/chat/chat-scroll-anchor'
import { ChatPanel } from './chat-panel'
import { cache } from 'react'

const loadIndex = cache(async () => {
  console.log("brokies")
  return await initializeObsidianIndex()
})

export interface ChatProps extends React.ComponentProps<'div'> {
    initialMessages?: Message[]
    id?: string
    session?: Session
    missingKeys: string[]
  }

export function Chat({ id, className, session, missingKeys }: ChatProps) {
    const router = useRouter()
    const path = usePathname()
    const [input, setInput] = useState('')
    const [messages] = useUIState()

    const isLoading = true


    React.useEffect(() => {
      const loadIndexAsync = async () => {
        console.log("Before loading index")
        try {
          await loadIndex();
          console.log("After loading index")
        } catch (error) {
          console.error("Error loading index:", error)
        }
      };
      loadIndexAsync();
    }, [])
  
  
    return (
        <>
          <div className={cn('pb-[200px] pt-4 md:pt-10', className)}>
            {messages.length ? (
              <>
                <ChatList messages={messages} isShared={false} session={session} />
                <ChatScrollAnchor trackVisibility={isLoading} />
              </>
            ) : (
              <EmptyScreen setInput={setInput} />
            )}
          </div>
          <ChatPanel id={id} input={input} setInput={setInput} />

        </>
      )
}