/**
 * Debug API - Test AWS Connection
 */

import { NextResponse } from 'next/server';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      AWS_REGION: process.env.AWS_REGION ?
        `SET (length: ${process.env.AWS_REGION.length}, value: "${process.env.AWS_REGION}")` :
        'NOT SET',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?
        `SET (length: ${process.env.AWS_ACCESS_KEY_ID.length}, starts with: ${process.env.AWS_ACCESS_KEY_ID.substring(0, 4)}...)` :
        'NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?
        `SET (length: ${process.env.AWS_SECRET_ACCESS_KEY.length})` :
        'NOT SET',
    },
    tests: {}
  };

  // Test 1: Check for newlines in AWS_REGION
  if (process.env.AWS_REGION) {
    const region = process.env.AWS_REGION;
    debug.tests.regionHasNewline = region.includes('\n');
    debug.tests.regionBytes = Array.from(region).map(c => c.charCodeAt(0));
  }

  // Test 2: Try to create DynamoDB client
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION?.trim(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
      },
    });

    debug.tests.clientCreated = true;

    // Test 3: Try to list tables
    try {
      const result = await client.send(new ListTablesCommand({}));
      debug.tests.dynamoDBConnection = 'SUCCESS';
      debug.tests.tables = result.TableNames;
    } catch (err: any) {
      debug.tests.dynamoDBConnection = 'FAILED';
      debug.tests.dynamoDBError = err.message;
    }
  } catch (err: any) {
    debug.tests.clientCreated = false;
    debug.tests.clientError = err.message;
  }

  return NextResponse.json(debug);
}
