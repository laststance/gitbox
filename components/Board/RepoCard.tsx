"use client";

import React, { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  GripVertical,
  MessageCircle,
  Paperclip,
} from "lucide-react";
import { OverflowMenu } from "./OverflowMenu";

// Types
interface RepoCardData {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  assignee?: {
    name: string;
    avatar: string;
  };
  tags?: string[];
  dueDate?: string;
  attachments?: number;
  comments?: number;
  statusId: string;
  /** GitHub repository owner */
  repoOwner?: string;
  /** GitHub repository name */
  repoName?: string;
}

interface RepoCardProps {
  card: RepoCardData;
  onEdit?: (id: string) => void;
  onMaintenance?: (id: string) => void;
}

export const RepoCard = memo<RepoCardProps>(
  ({ card, onEdit, onMaintenance }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: card.id });

    const [menuOpen, setMenuOpen] = useState(false);

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    /**
     * キーボードナビゲーションハンドラー
     * Constitution要件: Principle IV - キーボードナビゲーション完全サポート
     *
     * @param e - KeyboardEvent
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Enter: デフォルトアクション (Project Infoモーダルを開く)
      if (e.key === "Enter" && onEdit) {
        e.preventDefault();
        onEdit(card.id);
      }

      // . (ピリオド): Overflow menuを開閉
      if (e.key === "." || e.key === "Period") {
        e.preventDefault();
        setMenuOpen((prev) => !prev);
      }

      // Escape: Overflow menuを閉じる
      if (e.key === "Escape" && menuOpen) {
        e.preventDefault();
        setMenuOpen(false);
      }
    };

    return (
      <div ref={setNodeRef} style={style} data-testid="repo-card">
        <Card
          className="cursor-move transition-all duration-200 border bg-card hover:shadow-md dark:hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h4
                  className="font-semibold text-foreground leading-tight flex-1"
                  data-testid="repo-name"
                >
                  {card.title}
                </h4>
                <div className="flex items-center gap-1">
                  <OverflowMenu
                    cardId={card.id}
                    repoOwner={card.repoOwner}
                    repoName={card.repoName}
                    onEdit={onEdit}
                    onMoveToMaintenance={onMaintenance}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    context="board"
                  />
                  <div {...attributes} {...listeners}>
                    <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  </div>
                </div>
              </div>

              {card.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {card.description}
                </p>
              )}

              {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-3 text-muted-foreground">
                  {card.dueDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {new Date(card.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {card.comments && (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {card.comments}
                      </span>
                    </div>
                  )}
                  {card.attachments && (
                    <div className="flex items-center gap-1">
                      <Paperclip className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {card.attachments}
                      </span>
                    </div>
                  )}
                </div>

                {card.assignee && (
                  <Avatar className="w-7 h-7 ring-2 ring-background">
                    <AvatarImage src={card.assignee.avatar} />
                    <AvatarFallback className="text-xs" data-testid="repo-owner">
                      {card.assignee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

RepoCard.displayName = "RepoCard";

export default RepoCard;
