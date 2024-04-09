import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import { request } from 'http';
import { execSync } from 'child_process';

interface RequestData {
    filePath: string;
    searchString: string;
    newContent: string;
}
   
export default async function POST(req: NextApiRequest, res: NextApiResponse) {
    let requestBody: RequestData | null = null;
    if (req.body instanceof ReadableStream) {
        const rawData = await req.body.getReader().read();
        const jsonString = new TextDecoder().decode(rawData.value);
        requestBody = JSON.parse(jsonString);
      } else if (typeof req.body === 'object') {
        requestBody = req.body;
      } else {        
        // Handle unexpected body type
        // res.status(400).json({ message: 'Invalid request body' })
        return;
      }
    
      if (requestBody !== null) {
       const { filePath, searchString, newContent } =  requestBody;
      
        try {
          try {
            // Read the markdown file
            const decodedFilePath = decodeURIComponent(filePath);
            const fileContent = fs.readFileSync(`/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/${decodedFilePath}.md`, 'utf-8');
            const lines = fileContent.split('\n');
            // console.log(searchString, "much colder")
            // var updatedString = searchString.replace(/\s+/g, '');
      
            // Find the index of the dashed line
            const dashedLineIndex = lines.findIndex(line => line.trim() === '--------------------');
      
            if (dashedLineIndex === -1) {
              console.log('Dashed line not found in the file.');
              return;
            }
      
            // Insert the new content right above the dashed line
            lines.splice(dashedLineIndex, 0, newContent);
      
            // Join the lines back into a single string
            const updatedContent = lines.join('\n');
      
            // Write the updated content back to the markdown file
            fs.writeFileSync(`/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/${decodedFilePath}.md`, updatedContent, 'utf-8');
      
            console.log('New content inserted above the dashed line successfully.', newContent);
      
            // ...
      
          } catch (error) {
            console.error('Error editing markdown file:', error);
          }
          return res.json({ message: 'Task updated successfully' });
        } catch (error) {
          console.error('Error updating task:', error);
          return res.status(500).json({ error: 'An error occurred while updating the task' });
        }
      } else {
        return res.status(500).json({ error: 'An error occurred while updating the task' });
      }
}

export async function GET(request: NextApiRequest, response: NextApiResponse) {
  return response.status(400).json({ error: 'Method not allowed' });
}