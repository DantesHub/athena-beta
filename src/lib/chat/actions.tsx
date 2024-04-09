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
import { InMemoryFileStore } from "langchain/stores/file/in_memory";

import {
  BotCard,
  BotMessage
} from '@/components/genUI/message'

import {
  Events
} from '@/components/genUI/events'
import { nanoid } from 'ai';
import { spinner } from '@/components/genUI/spinner'
import { z } from "zod"
import { SpinnerMessage, UserMessage, SystemMessage } from '@/components/genUI/message'
import { StoredMessage, mapStoredMessagesToChatMessages } from "@langchain/core/messages";
import OpenAI from 'openai'
import { Chat } from '@/lib/types'
import { ObsidianLoader } from "langchain/document_loaders/fs/obsidian"; 
import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from '@langchain/openai';
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { AutoGPT } from "langchain/experimental/autogpt";
import { initializeObsidianIndex } from "@/app/actions";
let cachedVectorStore: PineconeStore | null = null;
let myGPT: AutoGPT | null = null;
export let mddbClient: MarkdownDB | null = null;
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { ReadFileTool, WriteFileTool } from "langchain/tools";
import {MemoryVectorStore} from "langchain/vectorstores/memory";
import { runOpenAICompletion } from'@/lib/utils'
import  GenTable  from "@/components/genUI/table"
import { mainPrompt } from '@/lib/utils/prompts'
import { MorningPanel } from '@/components/chat/morning-panel';
import { updateDailyAPI } from './tasks';
import { startMorningRoutine } from './morning';
import { getTodayFormattedDate, getTime } from '../utils/data-helper';
async function setupVectorStore() {
  'use server'
  if (cachedVectorStore) return
  try {
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
    cachedVectorStore = existingVectorStore
    console.log("Existing vector store set successfully");
  } catch (error) {
    console.log("Initializing vector store");
    const documents = await initializeObsidianIndex() || [];

    const pinecone = new Pinecone({
      apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!,
    });
    const pineconeIndex = pinecone.Index(
      process.env.NEXT_PUBLIC_PINECONE_INDEX!
    );

    const vectorStore = await PineconeStore.fromDocuments(
      documents,
      new OpenAIEmbeddings({
        openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      }),
      {
        pineconeIndex,
        maxConcurrency: 5,
      }
    );
    console.log(vectorStore, "Vector store initialized");
  }
}

async function initializeMDDB() {
  try {
    const client = new MarkdownDB({
      client: "sqlite3",
      connection: {
        filename: "/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/markdown.db",
      },
    });
    console.log("Initializing MarkdownDB");
    const clientPromise = client.init();
    mddbClient = await clientPromise;
  } catch (error) {
    console.error("Error initializing MarkdownDB:", error);
    throw error;
  }
}

export async function queryMDDB(query: String) {
  if (!mddbClient) {
     await initializeMDDB();
  }

  try {
    const result = await mddbClient?.db.raw(query)
    console.log("result", result)
    return result;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}

async function updateDaily(query: "") {
  try {
    const result = await mddbClient?.db.raw(query)
    console.log("result", result)
    return result;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}



async function initializeAutoGPT() {
  'use server'
  const aiState = getMutableAIState<typeof AI>()

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''  
  });
  const store = new InMemoryFileStore();
  if (!cachedVectorStore) {
    console.log("No cached vector store found, initializing...");
    await setupVectorStore();
  }

  const tools = [
    new ReadFileTool({ store }),
    new WriteFileTool({ store }),
    new SerpAPI(process.env.NEXT_PUBLIC_SERPAPI_API_KEY!, {
      location: "San Francisco,California,United States",
      hl: "en",
      gl: "us",
    }),
  ];
  const embeds = new OpenAIEmbeddings({ openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY });
  const getDefaultRetriever = () => {
    const defaultVectorStore = new MemoryVectorStore(embeds);
    return defaultVectorStore.asRetriever();
  };
  myGPT = AutoGPT.fromLLMAndTools(
    new ChatOpenAI({ temperature: 0, openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY }),
    tools,    
    {
      memory: cachedVectorStore ? cachedVectorStore.asRetriever() : getDefaultRetriever(),
       aiName: "Athena",
      aiRole: "Assistant",
      humanInTheLoop: true,
      maxIterations: 3
    }
  );
}



// TODO: -update vectorstore method
async function runAutoGPT(content: string) {
  'use server'
  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>;
  let textNode: undefined | React.ReactNode;
  const aiState = getMutableAIState<typeof AI>();

  if (!myGPT) {
    await initializeAutoGPT();
  }

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''  
  })

  const store = new InMemoryFileStore();
  if (!cachedVectorStore) {
    console.log("No cached vector store found, initializing...");
    await setupVectorStore();
  }

  var searchResults
  if(cachedVectorStore) {
     searchResults = await cachedVectorStore?.similaritySearch(content, 3);
  } 

  // Combine the search results into a single string
  const contextText = searchResults?.map(result => result.pageContent).join('\n\n');
 
  const updatedMessageHistory = aiState.get().messages.map((message: any) => {
    const baseMessage: StoredMessage = {
      type: 'message', // You may need to adjust this based on your application's needs
      data: {
        content: message.content,
        name: message.name,
        role: message.role, // Assuming 'role' exists in your 'message' object
        tool_call_id: undefined, // Assuming 'tool_call_id' is not available in your 'message' object
        additional_kwargs: {},
        response_metadata: {},
      },
    };
    return baseMessage;
  });

  const finalMessages = mapStoredMessagesToChatMessages(updatedMessageHistory);
  myGPT!.fullMessageHistory = finalMessages;

  
    const result = await myGPT!.run([content]);
  console.log(result, "result")

    const ui = render({
      model: 'gpt-3.5-turbo-1106',
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
        })),
      ],    

      text: ({ content, done, delta }) => {
        if (!textStream) {
          textStream = createStreamableValue('')
          textNode =      
           <div>
          <p className="flex-1 space-y-2 text-2xl"  style={{ fontSize: '28px' }}>Your Weekly Goals</p>
          <hr className="" style={{ opacity: 0.3, margin: "4px" }} />
          <BotMessage>{content}</BotMessage>
          <MorningPanel/>
          </div>
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
    // Update the UI with the latest result
    textNode = ui;

  return {
    id: nanoid(),
    display: textNode
  }
}

async function submitUserMessage(content: string) {
  'use server'
  const aiState = getMutableAIState<typeof AI>()
  console.log(aiState.get().inMorningSession, "mother beeps45")
  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''  
  })
  var finalContent = content
  const reply = createStreamableUI(
    <BotMessage className="items-center">{spinner}</BotMessage>
  );

  if (!cachedVectorStore) {
    console.log("No cached vector store found, initializing...");
    await setupVectorStore();
  }

  var searchResults
  if(cachedVectorStore) {
     searchResults = await cachedVectorStore?.similaritySearch(content, 3);
  } 

  if (aiState.get().inMorningSession) {
    if (aiState.get().messages.length >= 2) {
    const lastUserMessage = aiState.get().messages[aiState.get().messages.length - 1];
    console.log(aiState.get().messages, "last user message")
    if (lastUserMessage.content.includes("Writing Gratitude")) {
        // update todays markdown file with gratitude
        const formattedDate = getTodayFormattedDate();
        const time = getTime();
          try {
            const response = await fetch('http://localhost:3000/api/insertMarkdown', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filePath: `/Daily/${formattedDate}`,
                newContent: `${time} Gratitude Logged: \n - gratitude:: ${content} \n --------------------`,
              }),
            });
        
            if (response.ok) {
              console.log('Markdown updated successfully');
            } else {
              console.error('Error inserting markdown:', response.statusText);
            }
          } catch (error) {
            console.error('Error updating task:', error);
          }

        finalContent = `Today I'm grateful for ${content}. Don't ask me for anything else just say that you've noted my gratitude. `

     }
   }
  } 


  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: finalContent
      }
    ]
  });

  var updatedPrompt = mainPrompt
  updatedPrompt += "**IMPORTANT****** if user says something random like ate mcdonalds for dinner, or refactoring code, run function update_daily. Do not run this function if they wrote about what they're grateeful for."

  const completion = runOpenAICompletion(openai, {
    model: "gpt-4-0125-preview",
    stream: true,
    messages: [
      {
        role: "system",
        content: updatedPrompt,
      },
      ...aiState.get().messages.map((info: any) => ({
        role: info.role,
        content: info.content,
        name: info.name,
      })),
    ],    
    functions: [
      {
        name: "query_data",
        description: `Gets the results for a query about the data`,
        parameters: zOpenAIQueryResponse,
      },
      {
        name: "query_tasks",
        description: `Gets the results for a query about user tasks`,
        parameters: zOpenAIQueryResponse,
      },
      {
        name: "update_daily",
        description: `Update Daily Note`,
        parameters: zOpenAIQueryResponse,
      },
    ],
    temperature: 0,
  });

  completion.onTextContent(async (content: string, isFinal: boolean) => {   
    if (finalContent.includes("Today I'm grateful for")) {
      reply.update(      
            <div>
            <BotMessage>
               {content}
            </BotMessage>
            <MorningPanel/>
            </div>
      );    
    } else {
      reply.update(      
        <BotMessage>
          {content}
        </BotMessage>
      );    
    }
   
    if (isFinal) {
      reply.done();
      aiState.done({
        ...aiState.get(),
        messages: [
          ...aiState.get().messages,
          {
            id: nanoid(),
            role: 'assistant',
            content: content
          }
        ]
      })
    }
  });


    completion.onFunctionCall(
      "update_daily",
      async (input: OpenAIQueryResponse) => {
        updateDailyAPI(content);
        // finalContent = `Today I'm grateful for ${content}. Don't ask me for anything else just say that you've noted my gratitude. ` 
        reply.done(          
          <BotCard>
             Updated Note
          </BotCard>  
        );
        
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: "function",
              name: "update_daily",
              content: ``,
            },
          ]
        })
      })

   // NOTES
  completion.onFunctionCall(
    "query_data",
    async (input: OpenAIQueryResponse) => {
      const { format, title, timeField } = input;
      let query = input.query;
      const res = await queryMDDB(input.query)
      const queryRes = res as QueryResult[];

      reply.done(
        <BotCard>
            <div className="py-4">
                <GenTable files = {queryRes}/>
            </div>
        </BotCard>
      );
      
      aiState.done({
        ...aiState.get(),
        messages: [
          ...aiState.get().messages,
          {
            id: nanoid(),
            role: "function",
            name: "query_data",
            content: `[Results for query: ${query} with format: ${format} and title: ${title}]`,
          },
        ]
      })
    })


  return {
    id: nanoid(),
    display: reply.value
  }
}

export type OpenAIQueryResponse = z.infer<typeof zOpenAIQueryResponse>;
// {
//   _id: 'ccb966ec4cf7ee4aca60651b8e965e7de310c42a',
//   file_path: '/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/B$ The War Of Art.md',
//   extension: 'md',
//   url_path: 'B$%20The%20War%20Of%20Art',
//   filetype: null,
//   metadata: '{"Author":"[[Steven Pressfield]]","Created":"2020-08-22T00:00:00.000Z","Published":null,"tags":["🧠/📚","📥/🟩"],"Source":null,"related":null,"rating":3.5,"tasks":[]}',
//   tasks: '[]'
// },

export type QueryResult = {
  _id: string;
  file_path: string;
  extension: string;
  url_path: string;
  filetype: string | null;
  metadata: string;
  tasks: string;
};

export const zOpenAIQueryResponse = z.object({
  query: z.string().describe(`Creates a SQLite Query for the given query.`),
  format: z.enum(["table, graph"]).describe("The format of the result"),
  title: z.string().optional().describe("The title of the chart"),
  timeField: z
    .string()
    .optional()
    .describe("If timeseries data, the column to use as the time field"),
});



export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    setupVectorStore,
    runAutoGPT,
    startMorningRoutine
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [], obsidianVectorStore: null, inMorningSession: false, inNightSession: false},
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

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

import { MarkdownDB } from "mddb";

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export type AIState = {
  chatId: string
  messages: Message[],
  obsidianVectorStore: PineconeStore | null
  inMorningSession: boolean
  inNightSession: boolean
}

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
        <BotMessage>{message.content}</BotMessage>
      )
    }));
};


