import { IsString, IsOptional, IsArray } from "class-validator";

export class CreateConversationDto {
  @IsString()
  participantId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class SendMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class MarkAsReadDto {
  @IsString()
  conversationId: string;
}
