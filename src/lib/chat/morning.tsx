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
  import { nanoid } from 'ai';
  import { spinner } from '@/components/genUI/spinner'
import OpenAI from 'openai'
import { MorningPanel } from '@/components/chat/morning-panel';
import { queryMDDB, OpenAIQueryResponse, zOpenAIQueryResponse, AI} from './actions';
import { mainPrompt } from '@/lib/utils/prompts'
import  {GenTasks,Task}  from "@/components/genUI/tasks"
import { runOpenAICompletion } from'@/lib/utils'
// *************************************************************************************
// MORNING ROUTINE
export async function startMorningRoutine() {
    'use server'
    // get weekly goal if exists
    const aiState = getMutableAIState<typeof AI>()
    // let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
    // let textNode: undefined | React.ReactNode
  
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
          content: "Start Morning Routine"
        },
      ],
      inMorningSession: true
    });
  
    
    var updatedPrompt = mainPrompt
    updatedPrompt += "if user says start morning routine get all weekly goals and return the one with the latest date closest to today. If no weekly goals exist return null"
  
    const completion = runOpenAICompletion(openai, {
      model: "gpt-3.5-turbo-1106",
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
      ],
      temperature: 0,
    });
    // get yesterdays daily goal if it hasnt been completed, what's todays goal? 
    
    // create summary from yesterday (mistakes, successes, etc, on going experiments, biggest learning) (3 sentences max)
    
    // show 4 buttons what do you want to do? (show checkmark if done)
    // write a gratitude
    // spaced repetition
    // show affirmations 
    // brain dump (if you're feeling negative emotions) 
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
          
          for (const task in queryRes) {
            const records = await queryMDDB(`SELECT * FROM files WHERE _id = '${queryRes[task].file}';`)
            if (!records[0].isEmpty) {
              const path = records[0].url_path
              queryRes[task].url = path
            }
          }
          // need to search for files and update url
    
          reply.done(
            <div>
            <p className="flex-1 space-y-2 text-2xl"  style={{ fontSize: '28px', margin: "4px" }}>Your Weekly Goals</p>
            <hr className="my-3" style={{ opacity: 0.3, margin: "12px 0" }} />
            <BotCard>
              <GenTasks tasks = {queryRes}/>
            </BotCard>
            <MorningPanel/>
            </div>
          );
          
          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "query_tasks",
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