import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import { request } from 'http';
import { execSync } from 'child_process';

interface RequestData {
    filePath: string;
    searchString: string;
    newContent: string;
  }
export default async function POST(req: Request) {
    let requestBody: RequestData | null = null;
    if (req.body instanceof ReadableStream) {
        const rawData = await req.body.getReader().read();
        const jsonString = new TextDecoder().decode(rawData.value);
        requestBody = JSON.parse(jsonString);
      } else if (typeof req.body === 'object') {

        requestBody = req.body;
        console.log("request body")
      } else {
        // Handle unexpected body type
        // res.status(400).json({ message: 'Invalid request body' });
        console.log("dummy")
        return;
      }
    
      if (requestBody !== null) {
       const { filePath, searchString, newContent } =  requestBody;
   
  try {
    console.log("in the middle of the night")
    try {
        // Read the markdown file
        const decodedFilePath = decodeURIComponent(filePath);
        // const fs = require('fs');
        // const path = require('path');
        console.log(process.cwd(), "***********************")
        const fileContent = fs.readFileSync(`/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/${decodedFilePath}.md`, 'utf-8');
        const lines = fileContent.split('\n');
        console.log(fileContent, "itaewon class");
        var updatedString =  searchString.replace(/\s+/g, '');
        // Find the line that contains the search string
        const lineIndex = lines.findIndex(line => line.replace(/\s+/g, '').includes(updatedString));
    
        // Check if the search string is found in any line
        if (lineIndex === -1) {
          console.log(`No line found containing the string: "${updatedString}"`);
          return;
        } 
    
        // Update the content of the line containing the search string
        lines[lineIndex] = newContent;
    
        // Join the lines back into a single string
        const updatedContent = lines.join('\n');
    
        // Write the updated content back to the markdown file
        
        fs.writeFileSync(`/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles/${decodedFilePath}.md`, updatedContent, 'utf-8');
    
        console.log(`Line containing "${searchString}" updated successfully.`);
          // Run the npx command using child_process.exec
          
          try {
            // Resolve the directory path relative to the project root
      
            // Run the npx command using child_process.execSync with the specified directory
            const stdout = execSync(`npx mddb /Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles`, {
              encoding: 'utf8',
              cwd: "/Users/dantekim/Documents/Projects/athena-beta/src/markdownFiles",
            });
      
            // Send the command output as the response
            console.log(stdout, "we won boys")
          } catch (error) {
            console.error(`Error executing command: npx mddb`);
          }
  
      } catch (error) {
        console.error('Error editing markdown file:', error);
      }
    return NextResponse.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'An error occurred while updating the task' }, { status: 500 });
  }
} else {
    return NextResponse.json({ error: 'An error occurred while updating the task' }, { status: 500 });

}
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}