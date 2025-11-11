const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const jwt = require('jsonwebtoken');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'projects';
const JWT_SECRET = process.env.JWT_SECRET;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    console.log('Auth header:', authHeader);
    
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized - No token' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('Decoded token:', decoded);
    } catch (err) {
      console.error('JWT verify error:', err);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const userId = String(decoded.userId);
    console.log('User ID:', userId);

    const body = JSON.parse(event.body);
    const { projectName, location, area, rooms, bathrooms } = body;

    if (!projectName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Project name is required' })
      };
    }

    const projectId = 'PROJ-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const now = Date.now();

    const project = {
      projectId: projectId,
      userId: userId,
      projectName: projectName,
      location: location || '',
      area: area || '',
      rooms: rooms || '',
      bathrooms: bathrooms || '',
      status: 'active',
      currentStep: 1,
      beforePhotos: {},
      afterPhotos: {},
      stylingPhotos: {},
      editingContent: {
        blog: '',
        instagram: '',
        hashtags: ''
      },
      createdAt: now,
      updatedAt: now
    };

    console.log('Creating project:', project);

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: project
    }));

    console.log('Project created successfully');

    return {
      statusCode: 201,
      headers: headers,
      body: JSON.stringify({
        message: 'Project created successfully',
        project: project
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};