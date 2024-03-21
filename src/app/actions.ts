'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
// import { kv } from '@vercel/kv'
// import { auth } from '@/auth'
import { useAIState } from 'ai/rsc'
import { ObsidianLoader } from "langchain/document_loaders/fs/obsidian"; 
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

import { type Chat } from '@/lib/types'


export async function initializeObsidianIndex() {
  try {
    console.log('Before loading obsidian');
    const loader = new ObsidianLoader(
      '/Users/dantekim/Documents/Areas/PKM/JARVIS/🌎 Atlas/Sources 📥/athena'
    );
    
    console.log('Before loading docs');
    const docs = await loader.load();
    console.log('After loading docs', docs.length);

    const docsWithContent = docs.filter(doc => doc && doc.pageContent && doc.pageContent.trim() !== '');
    console.log('After filtering docs', docsWithContent.length);

    const embedder = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    const documentsToEmbed = docsWithContent
      .filter(doc => doc && doc.pageContent && doc.pageContent.trim() !== '')
      .map(doc => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));
    console.log('Documents to embed:', documentsToEmbed.length);

    const texts = documentsToEmbed.map(doc => doc.pageContent);
    console.log('Texts to embed:', texts.length);

    const embeddings = await embedder.embedDocuments(texts);
    console.log('Embeddings generated:', embeddings.length);

    if (embeddings.length !== documentsToEmbed.length) {
      throw new Error('Mismatch between the number of embeddings and documents');
    }

    const documents = documentsToEmbed.map((doc, index) => ({
      pageContent: doc.pageContent,
      embedding: embeddings[index],
      metadata: doc.metadata,
    }));

    const vectorStore = await Chroma.fromDocuments(documents, embedder, {
      collectionName: 'obsidian_docs',
    });

    const [aiState, setAIState] = useAIState();
    setAIState({ ...aiState, obsidianVectorStore: vectorStore });

    console.log('Obsidian index initialized successfully.');
  } catch (error) {
    console.error('Error initializing Obsidian index:', error);
    // Handle the error appropriately (e.g., show an error message to the user)
  }
}
// export async function getChats(userId?: string | null) {
//   if (!userId) {
//     return []
//   }

//   try {
//     const pipeline = kv.pipeline()
//     const chats: string[] = await kv.zrange(`user:chat:${userId}`, 0, -1, {
//       rev: true
//     })

//     for (const chat of chats) {
//       pipeline.hgetall(chat)
//     }

//     const results = await pipeline.exec()

//     return results as Chat[]
//   } catch (error) {
//     return []
//   }
// }

// export async function getChat(id: string, userId: string) {
//   const chat = await kv.hgetall<Chat>(`chat:${id}`)

//   if (!chat || (userId && chat.userId !== userId)) {
//     return null
//   }

//   return chat
// }

// export async function removeChat({ id, path }: { id: string; path: string }) {
//   const session = await auth()

//   if (!session) {
//     return {
//       error: 'Unauthorized'
//     }
//   }

//   //Convert uid to string for consistent comparison with session.user.id
//   const uid = String(await kv.hget(`chat:${id}`, 'userId'))

//   if (uid !== session?.user?.id) {
//     return {
//       error: 'Unauthorized'
//     }
//   }

//   await kv.del(`chat:${id}`)
//   await kv.zrem(`user:chat:${session.user.id}`, `chat:${id}`)

//   revalidatePath('/')
//   return revalidatePath(path)
// }

// export async function clearChats() {
//   const session = await auth()

//   if (!session?.user?.id) {
//     return {
//       error: 'Unauthorized'
//     }
//   }

//   const chats: string[] = await kv.zrange(`user:chat:${session.user.id}`, 0, -1)
//   if (!chats.length) {
//     return redirect('/')
//   }
//   const pipeline = kv.pipeline()

//   for (const chat of chats) {
//     pipeline.del(chat)
//     pipeline.zrem(`user:chat:${session.user.id}`, chat)
//   }

//   await pipeline.exec()

//   revalidatePath('/')
//   return redirect('/')
// }

// export async function getSharedChat(id: string) {
//   const chat = await kv.hgetall<Chat>(`chat:${id}`)

//   if (!chat || !chat.sharePath) {
//     return null
//   }

//   return chat
// }

// export async function shareChat(id: string) {
//   const session = await auth()

//   if (!session?.user?.id) {
//     return {
//       error: 'Unauthorized'
//     }
//   }

//   const chat = await kv.hgetall<Chat>(`chat:${id}`)

//   if (!chat || chat.userId !== session.user.id) {
//     return {
//       error: 'Something went wrong'
//     }
//   }

//   const payload = {
//     ...chat,
//     sharePath: `/share/${chat.id}`
//   }

//   await kv.hmset(`chat:${chat.id}`, payload)

//   return payload
// }

// export async function saveChat(chat: Chat) {
//   const session = await auth()

//   if (session && session.user) {
//     const pipeline = kv.pipeline()
//     pipeline.hmset(`chat:${chat.id}`, chat)
//     pipeline.zadd(`user:chat:${chat.userId}`, {
//       score: Date.now(),
//       member: `chat:${chat.id}`
//     })
//     await pipeline.exec()
//   } else {
//     return
//   }
// }

// export async function refreshHistory(path: string) {
//   redirect(path)
// }

// export async function getMissingKeys() {
//   const keysRequired = ['OPENAI_API_KEY']
//   return keysRequired
//     .map(key => (process.env[key] ? '' : key))
//     .filter(key => key !== '')
// }


