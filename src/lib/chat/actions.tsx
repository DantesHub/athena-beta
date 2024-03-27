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
import {
  spinner
} from '@/components/genUI/spinner'
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
let mddbClient: MarkdownDB | null = null;
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { ReadFileTool, WriteFileTool } from "langchain/tools";
import {MemoryVectorStore} from "langchain/vectorstores/memory";
import {
  runAsyncFnWithoutBlocking,
  sleep,
  formatNumber,
  runOpenAICompletion,
} from'@/lib/utils'

import  GenTable  from "@/components/genUI/table"
import  {GenTasks,Task}  from "@/components/genUI/tasks"



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

async function queryMDDB(query: String) {
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


 async function startMorningRoutine() {
  'use server'
   await queryMDDB("SELECT files.*");
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
      model: 'gpt-4',
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
          textNode = <BotMessage>{content}</BotMessage>
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

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''  
  })

  const reply = createStreamableUI(
    <BotMessage className="items-center">{spinner}</BotMessage>
  );

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  });

    const prompt = `\
    You are a bot that helps the user make sense of their notes and data. You generate graphs/tables or answers questions from a vector store that has embeddings about the users notes
    
    Messages inside [] means that it's a UI element or a user event. For example:
    - "[Results for query: query with format: format and title: title and description: description. with data" means that a chart/table/number card is shown to that user.

    The user has a markdown folder filled with all of their journals, book, video, podcast, movie, show notes. 
          
    You help users query their data.

    There are two databases files, and tasks. 

    Files:
    url_path == title of the note. 

    There is no table called notes, if user asks for something make sure to query from the files table
    All notes have a property called metadata that contains properties: 
    Author, 
    Created,
    tags, 
    Source,
    related 
    rating (Decimal between 0-5)  

    Tasks:
    due,
    created,
    start,
    checked (1 means done),
    description

    Example querys:
    give me all books written by dan koe:
    SELECT * FROM files WHERE metadata LIKE '%dan%koe%' COLLATE NOCASE;

    open note War of Art:
    SELECT * FROM files WHERE url_path LIKE '%war%of%art%' COLLATE NOCASE;
    
    or give me
    The current time is ${new Date().toISOString()}.

    Feel free to be creative with suggesting queries and follow ups based on what you think. Keep responses short and to the point.
    `;


  const completion = runOpenAICompletion(openai, {
    model: "gpt-4-0125-preview",
    stream: true,
    messages: [
      {
        role: "system",
        content: prompt,
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
    ],
    temperature: 0,
  });

  completion.onTextContent(async (content: string, isFinal: boolean) => {   
    reply.update(
      <BotMessage>
        {content}
      </BotMessage>
    );
    if (isFinal) {
      reply.done();
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
    }
  });

  // TASKS
  completion.onFunctionCall(
    "query_tasks",
    async (input: OpenAIQueryResponse) => {
      const { format, title, timeField } = input;
      let query = input.query;
      console.log("fetching tasks")
      // // replace $sent_at with timestamp
      // query = query.replace("$sent_at", "timestamp");

      // // replace `properties."timestamp"` with `timestamp`
      // query = query.replace(/properties\."timestamp"/g, "timestamp");
      const res = await queryMDDB(input.query)
      const queryRes = res as Task[];
      
      // need to search for files and update url

      reply.done(
        <BotCard>
            <div className="py-4">
                <GenTasks tasks = {queryRes}/>
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

   // NOTES
  completion.onFunctionCall(
    "query_data",
    async (input: OpenAIQueryResponse) => {
      const { format, title, timeField } = input;
      let query = input.query;
      
      // // replace $sent_at with timestamp
      // query = query.replace("$sent_at", "timestamp");

      // // replace `properties."timestamp"` with `timestamp`
      // query = query.replace(/properties\."timestamp"/g, "timestamp");
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

type OpenAIQueryResponse = z.infer<typeof zOpenAIQueryResponse>;
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

const zOpenAIQueryResponse = z.object({
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


// initializeObsidianIndex()

// Move the logic from unstable_onInit to a separate function


// Call the initializeObsidianIndex function separately




