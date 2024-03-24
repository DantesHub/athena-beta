import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue,
  useAIState
} from 'ai/rsc'

import {
  BotCard,
  BotMessage
} from '@/components/genUI/message'

import {
  Events
} from '@/components/genUI/events'

import {
  spinner
} from '@/components/genUI/spinner'

import { SpinnerMessage, UserMessage } from '@/components/genUI/message'

import OpenAI from 'openai'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { Chat } from '@/lib/types'
import { ObsidianLoader } from "langchain/document_loaders/fs/obsidian"; 
import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

let cachedVectorStore: PineconeStore | null = null;

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export type AIState = {
  chatId: string
  messages: Message[],
  obsidianVectorStore: PineconeStore | null
}


async function setupVectorStore() {
  'use server'
  const pinecone = new Pinecone({
    apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!,
  });
  const pineconeIndex = pinecone.Index(
    process.env.NEXT_PUBLIC_PINECONE_INDEX!
  );

  const existingVectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({
      openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    }),
    { pineconeIndex }
  );

  console.log(existingVectorStore, "Existing vector store");
  
  console.log("Existing vector store fetched successfully");
  const aiState = getMutableAIState<typeof AI>()
  

    // const updatedState = {
    //   ...aiState.get(),
    //   messages: [
    //     ...aiState.get().messages,
    //     {
    //       id: nanoid(),
    //       role: 'user',
    //       content: ""
    //     }
    //   ],
    //   obsidianVectorStore: existingVectorStore,
    // }

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'assistant',
          content: ""
        }
      ],
      obsidianVectorStore: existingVectorStore
    })

    cachedVectorStore = existingVectorStore
  console.log("AI state after update:", aiState.get());
  console.log("Existing vector store set successfully");

}

async function submitUserMessage(content: string) {
  'use server'
  console.log("geguman34")
  const aiState = getMutableAIState<typeof AI>()



  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''  
  })
  
  
  // Search the Obsidian vector store based on the user's message
  const obsidianVectorStore = aiState.get().obsidianVectorStore;
  console.log(cachedVectorStore, "obsidian vector store")

  var searchResults
  if(cachedVectorStore) {
     searchResults = await cachedVectorStore?.similaritySearch(content, 3);
  } 

  // Combine the search results into a single string
  const contextText = searchResults?.map(result => result.pageContent).join('\n\n');

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ],
    obsidianVectorStore: obsidianVectorStore,
  })
  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `...`,
      },
      {
        role: 'user',
        content: `Here is some additional context from my knowledge base:\n\n${contextText}\n\nPlease use this information to help answer the following question:\n\n${content}`,
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
  })

  return {
    id: nanoid(),
    display: ui
  }
}


export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    setupVectorStore
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [], obsidianVectorStore: null },
  unstable_onGetUIState: async () => {
    'use server'

    const aiState = getAIState()

    if (aiState) {
      const uiState = getUIStateFromAIState(aiState)
      return uiState
    }
  },
  unstable_onSetAIState: async ({ state, done }) => {
    'use server'

    const { chatId, messages } = state

    const createdAt = new Date()
    const userId = 'defaultUser'
    const path = `/chat/${chatId}`
    const title = messages[0].content.substring(0, 100)

    const chat: Chat = {
      id: chatId,
      title,
      userId,
      createdAt,
      messages,
      path
    }
  }
})




export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display: message.role === 'function' ? (
        <BotCard>
          <Events props={JSON.parse(message.content)} />
        </BotCard>
      ) : message.role === 'user' ? (
        <UserMessage>{message.content}</UserMessage>
      ) : (
        <BotMessage content={message.content} />
      )
    }));
};


// initializeObsidianIndex()

// Move the logic from unstable_onInit to a separate function


// Call the initializeObsidianIndex function separately


