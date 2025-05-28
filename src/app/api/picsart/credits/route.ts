import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.PICSART_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Picsart API key not configured. Please add PICSART_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    console.log('Attempting to fetch Picsart credits...');

    const response: any = {};
    const errors: string[] = [];

    // Fetch video credits balance
    try {
      const videoResponse = await fetch('https://video-api.picsart.io/v1/balance', {
        method: 'GET',
        headers: {
          'X-Picsart-API-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      console.log('Video API response status:', videoResponse.status);

      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        response.video_credits = videoData.credits || 0;
        console.log('Video credits fetched successfully:', videoData.credits);
      } else {
        const errorText = await videoResponse.text();
        console.error('Video API error:', errorText);
        errors.push(`Video API: ${videoResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Video API fetch error:', error);
      errors.push(`Video API: Network error - ${error}`);
    }

    // Fetch GenAI credits balance  
    try {
      const genaiResponse = await fetch('https://genai-api.picsart.io/v1/balance', {
        method: 'GET',
        headers: {
          'X-Picsart-API-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      console.log('GenAI API response status:', genaiResponse.status);

      if (genaiResponse.ok) {
        const genaiData = await genaiResponse.json();
        response.genai_credits = genaiData.credits || 0;
        console.log('GenAI credits fetched successfully:', genaiData.credits);
      } else {
        const errorText = await genaiResponse.text();
        console.error('GenAI API error:', errorText);
        errors.push(`GenAI API: ${genaiResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('GenAI API fetch error:', error);
      errors.push(`GenAI API: Network error - ${error}`);
    }

    // If we got at least one successful response, return the data with any errors
    if (Object.keys(response).length > 0) {
      if (errors.length > 0) {
        response.partial_errors = errors;
      }
      return NextResponse.json(response);
    }

    // If no APIs worked, return an error
    return NextResponse.json(
      { 
        error: 'Unable to fetch credits from any Picsart API', 
        details: errors,
        hint: 'Check your API key permissions for Video and GenAI APIs in your Picsart account.'
      },
      { status: 401 }
    );

  } catch (error) {
    console.error('Error fetching Picsart credits:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching credits' },
      { status: 500 }
    );
  }
}
