/**
 * Schedule Messages API Routes
 *
 * GET /api/schedules/[scheduleId]/messages - 메시지 목록 조회
 * POST /api/schedules/[scheduleId]/messages - 메시지 전송
 *
 * 별도의 mokoji-messages 테이블 사용 (DynamoDB 400KB 제한 해결)
 */

import { NextResponse } from 'next/server';
import { schedulesDB, messagesDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: {
    scheduleId: string;
  };
}

/**
 * GET /api/schedules/[scheduleId]/messages
 * 메시지 목록 조회
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[GET /api/schedules/messages] Authenticated user:', user.sub);

    const { scheduleId } = await params;
    console.log('[GET /api/schedules/messages] Fetching messages for schedule:', scheduleId);

    // Fetch messages from separate messages table
    const messages = await messagesDB.getBySchedule(scheduleId);

    // Filter out deleted messages
    const activeMessages = messages.filter((msg: any) => !msg.isDeleted);

    console.log('[GET /api/schedules/messages] Returning', activeMessages.length, 'messages');
    return successResponse({ messages: activeMessages });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[GET /api/schedules/messages] Error:', error);
    return serverErrorResponse('Failed to fetch messages', error);
  }
}

/**
 * POST /api/schedules/[scheduleId]/messages
 * 메시지 전송
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[POST /api/schedules/messages] Authenticated user:', user.sub);

    const { scheduleId } = await params;
    console.log('[POST /api/schedules/messages] Adding message to schedule:', scheduleId);

    // Parse request body
    const body = await request.json();
    const {
      content,
      type = 'text',
      senderName,
      senderAvatar,
      attachments,
    } = body;

    // Validate required fields
    if (!content && type === 'text') {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!senderName) {
      return NextResponse.json(
        { error: 'Sender name is required' },
        { status: 400 }
      );
    }

    // Check if schedule exists
    const schedule = await schedulesDB.get(scheduleId);
    if (!schedule) {
      console.log('[POST /api/schedules/messages] Schedule not found:', scheduleId);
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Generate message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Create new message in separate messages table
    const newMessage = {
      messageId,
      scheduleId,
      senderId: user.sub,
      senderName,
      senderAvatar: senderAvatar || null,
      content: content?.trim() || '',
      type,
      attachments: attachments || null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      readBy: [user.sub],
    };

    // Save to messages table
    await messagesDB.create(newMessage);

    // Update schedule with last message info (optional, for preview)
    try {
      await schedulesDB.update(scheduleId, {
        lastMessage: {
          content: (content || '').substring(0, 100),
          senderName,
          sentAt: now,
        },
      });
    } catch (updateError) {
      // 일정 업데이트 실패해도 메시지는 저장됨
      console.warn('[POST /api/schedules/messages] Failed to update lastMessage:', updateError);
    }

    console.log('[POST /api/schedules/messages] Message created successfully:', messageId);
    return successResponse({ message: { ...newMessage, id: messageId } }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[POST /api/schedules/messages] Error:', error);
    return serverErrorResponse('Failed to send message', error);
  }
}

/**
 * PATCH /api/schedules/[scheduleId]/messages
 * 메시지 읽음 처리
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[PATCH /api/schedules/messages] Authenticated user:', user.sub);

    const { scheduleId } = await params;
    const body = await request.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'messageIds array is required' },
        { status: 400 }
      );
    }

    console.log('[PATCH /api/schedules/messages] Marking', messageIds.length, 'messages as read');

    // 여러 메시지를 읽음 처리
    await messagesDB.markManyAsRead(messageIds, user.sub);

    console.log('[PATCH /api/schedules/messages] Messages marked as read');
    return successResponse({ success: true, markedCount: messageIds.length });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[PATCH /api/schedules/messages] Error:', error);
    return serverErrorResponse('Failed to mark messages as read', error);
  }
}

/**
 * DELETE /api/schedules/[scheduleId]/messages
 * 메시지 삭제
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[DELETE /api/schedules/messages] Authenticated user:', user.sub);

    const { scheduleId } = await params;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // Get message to verify ownership
    const message = await messagesDB.get(messageId);
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Only sender can delete their message
    if (message.senderId !== user.sub) {
      return NextResponse.json(
        { error: 'Not authorized to delete this message' },
        { status: 403 }
      );
    }

    // Soft delete the message
    await messagesDB.softDelete(messageId);

    console.log('[DELETE /api/schedules/messages] Message deleted:', messageId);
    return successResponse({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[DELETE /api/schedules/messages] Error:', error);
    return serverErrorResponse('Failed to delete message', error);
  }
}
