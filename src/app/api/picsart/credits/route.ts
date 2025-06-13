
import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebaseAdmin'; // For token verification
import { getUserApiKeys } from '@/actions/baserowApiKeyActions'; // To fetch user's Picsart key

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
      if (!firebaseAdmin.apps.length) { // Ensure admin app is initialized
        return NextResponse.json({ error: 'Server error: Firebase Admin not initialized.' }, { status: 500 });
      }
      decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token.' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Could not identify user.' }, { status: 401 });
    }

    const userKeysResult = await getUserApiKeys(userId);
    if (!userKeysResult.success || !userKeysResult.data?.picsartApiKey) {
      return NextResponse.json(
        { error: 'Picsart API key not configured by user. Please set it in Account Settings.' },
        { status: 403 } // 403 Forbidden as user is authenticated but lacks permission/config
      );
    }
    const userPicsartApiKey = userKeysResult.data.picsartApiKey;

    console.log(`Attempting to fetch Picsart credits for user ${userId} using their key...`);

    interface PicsartCreditDetails {
      credits?: number;
      limit?: number;
      error?: string;
    }
    const response: {
      video?: PicsartCreditDetails;
      image?: PicsartCreditDetails;
      partial_errors?: string[];
      // Add other potential credit types here if needed
    } = {};
    const errors: string[] = [];

    // Fetch video credits balance
    try {
      const videoResponse = await fetch('https://video-api.picsart.io/v1/balance', {
        method: 'GET',
        headers: {
          'X-Picsart-API-Key': userPicsartApiKey,
          'Accept': 'application/json',
        },
      });

      console.log('Video API response status:', videoResponse.status);

      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        if (!response.video) response.video = {};
        response.video.credits = videoData.credits || 0;
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
          'X-Picsart-API-Key': userPicsartApiKey,
          'Accept': 'application/json',
        },
      });

      console.log('GenAI API response status:', genaiResponse.status);

      if (genaiResponse.ok) {
        const genaiData = await genaiResponse.json();
        if (!response.image) response.image = {}; // Assuming genai_credits map to image credits
        response.image.credits = genaiData.credits || 0;
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

    if (Object.keys(response).length > 0) {
      if (errors.length > 0) {
        response.partial_errors = errors;
      }
      return NextResponse.json(response);
    }

    return NextResponse.json(
      { 
        error: 'Unable to fetch credits from any Picsart API using your key.', 
        details: errors,
        hint: 'Check your Picsart API key permissions for Video and GenAI APIs.'
      },
      { status: 401 } // Use 401 if the key itself was invalid for Picsart
    );

  } catch (error) {
    console.error('Error fetching Picsart credits (outer try-catch):', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching credits' },
      { status: 500 }
    );
  }
}

    