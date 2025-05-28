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

    // Fetch video credits balance
    const videoResponse = await fetch('https://video-api.picsart.io/v1/balance', {
      method: 'GET',
      headers: {
        'X-Picsart-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    console.log('Response status:', videoResponse.status);
    console.log('Response headers:', Object.fromEntries(videoResponse.headers.entries()));

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error('Picsart API error response:', errorText);
      console.error('Request headers sent:', {
        'X-Picsart-API-Key': apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined',
        'Accept': 'application/json'
      });
      
      let errorMessage = 'Failed to fetch video credits from Picsart API';
      
      if (videoResponse.status === 401) {
        errorMessage = 'Invalid API key or insufficient permissions. Your API key may not have access to the Video API.';
      } else if (videoResponse.status === 403) {
        errorMessage = 'API key does not have permission to access video credits. Contact Picsart support to enable Video API access.';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: errorText,
          status: videoResponse.status,
          hint: 'Make sure your API key has Video API permissions enabled in your Picsart account.'
        },
        { status: videoResponse.status }
      );
    }

    const videoData = await videoResponse.json();
    console.log('Picsart API response:', videoData);
    
    // The API returns { "credits": number } according to the YAML spec
    const response = {
      video_credits: videoData.credits || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching Picsart credits:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching credits' },
      { status: 500 }
    );
  }
}
