
import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebaseAdmin'; // Adjust path if your firebaseAdmin is elsewhere

export async function GET() {
  console.log('[API Route test-admin] Testing Firebase Admin SDK initialization...');
  if (dbAdmin) {
    console.log('[API Route test-admin] dbAdmin IS DEFINED. Firebase Admin SDK likely initialized successfully.');
    return NextResponse.json({ status: 'SUCCESS', message: 'Firebase Admin SDK (dbAdmin) is defined.' });
  } else {
    console.error('[API Route test-admin] dbAdmin IS UNDEFINED. Firebase Admin SDK initialization failed.');
    return NextResponse.json({ status: 'ERROR', message: 'Firebase Admin SDK (dbAdmin) is undefined.' }, { status: 500 });
  }
}
