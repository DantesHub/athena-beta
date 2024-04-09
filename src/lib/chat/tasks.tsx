import { getTodayFormattedDate, getTime } from '@/lib/utils/data-helper'

export async function updateDailyAPI(content: string ) {
  const formattedDate = getTodayFormattedDate();
  const time = getTime();
  console.log(formattedDate, "formatted date");
  
  try {
    const response = await fetch('http://localhost:3000/api/updateDaily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: `/Daily/${formattedDate}`,
        newContent: `${time} ${content}`,
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
}