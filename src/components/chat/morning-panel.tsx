
'use client'
import * as React from 'react'

import { useAIState, useActions, useUIState } from 'ai/rsc'
import type { AI } from '@/lib/chat/actions'
import { nanoid } from 'nanoid'
import {UserMessage} from '@/components/genUI/message'
import { useEffect } from 'react'

export function MorningPanel() {
  const [messages, setMessages] = useUIState<typeof AI>()
  const { submitUserMessage, startMorningRoutine } = useActions()
  const [aiState, setAIState] = useAIState<typeof AI>()
  useEffect(() => {
    const runGratitude = async () => {
        console.log(aiState.messages, "new brokies");        
    };
  
    runGratitude();
  }, [aiState.messages]);
  const exampleMessages = [
    // TODO: - at the top we have your character.
    // check box for habits => hours focused, morning routine checked. To-dos completed. Words written. 
    // can be replaced with Wind Down Routine
    {
      heading: '🙏 Gratitude',
      subheading: 'what are you thankful for today?',
      message:  (
        <>
          🙏 Remember to think small, reflect on obstacles you've overcome, the people who've helped you along the way, & your basic needs being met: eyesight, health, education, etc<br />
          --------------------------------------------------------<br />
          Today I'm grateful for...
        </>
      )
    },
    {
      heading: '📋 My Affirmations',
      subheading: 'List your affirmations',
      message: 'List My Affirmations'
    },
    {
      heading: '💭 Journal Observations',
      subheading: 'Brain dump / clear your head',
      message: `I'm gonna start a journaling session`
      // Two options
      // at the end: do you want my thoughts on this?
      // do you want me to extract insights to save for later? 
    },
    {
      heading: '📙 Spaced Repetition',
      subheading: `Review Your Flashcards`,
      message: `Start spaced repetition session`
    }
  ]

  return (
    <div className="mx-auto sm:max-w-2xl sm:px-4 mt-4">
    <div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:px-0">
      {exampleMessages.map((example, index) => {
        const isGratefulFor = aiState.messages.some(
          (message) => message.content.includes("Today I'm grateful for") && example.heading === '🙏 Gratitude'
        );
  
        return (
          <div
            key={example.heading}
            className={`cursor-pointer rounded-lg border bg-white p-4 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${
              index > 1 && "hidden md:block"
            } ${isGratefulFor ? "opacity-50" : ""}`}
            onClick={async () => {
              setMessages((currentMessages) => [
                ...currentMessages,
                {
                  id: nanoid(),
                  display: <UserMessage>{example.message}</UserMessage>,
                },
              ]);
              setAIState(({ ...aiState, messages: [
                ...aiState.messages,
                {
                  id: nanoid(),
                  role: "system",
                  content: "Writing Gratitude",
                },
              ]}));
  
      
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{example.heading}</div>
                <div className="text-sm text-zinc-600">{example.subheading}</div>
              </div>
              {isGratefulFor && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
  
  )
}
