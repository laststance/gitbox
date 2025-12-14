"use client";

import React, { useState, useEffect, memo, useCallback } from "react";
import { motion } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/lib/redux/store";
import {
  setStatusLists,
  setRepoCards,
  setLoading,
  setError,
  selectStatusLists,
  selectRepoCards,
  selectBoardLoading,
  selectBoardError,
} from "@/lib/redux/slices/boardSlice";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { StatusColumn } from "./StatusColumn";
import type { RepoCard as RepoCardType } from "./RepoCard";
import type { StatusListDomain, RepoCardDomain, RepoCardForRedux } from "@/lib/models/domain";

// Types: Using Domain types for type-safe state management

interface KanbanBoardProps {
  boardId?: string;
  onEditProjectInfo?: (cardId: string) => void;
  onMoveToMaintenance?: (cardId: string) => void;
}

// Loading Skeleton Component
const KanbanSkeleton = memo(() => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, colIndex) => (
        <div
          key={colIndex}
          className="bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, cardIndex) => (
              <motion.div
                key={cardIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cardIndex * 0.1 }}
              >
                <Skeleton className="h-32 w-full rounded-lg" />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
KanbanSkeleton.displayName = "KanbanSkeleton";

// Error State Component
const ErrorState = memo(({ message }: { message: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertCircle className="w-16 h-16 text-destructive mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h3>
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
});
ErrorState.displayName = "ErrorState";


// Main Kanban Board Component
export const KanbanBoard = memo<KanbanBoardProps>(
  ({ boardId = "default-board", onEditProjectInfo, onMoveToMaintenance }) => {
    // Redux state (LocalStorage に自動同期)
    const dispatch = useAppDispatch();
    const statuses = useAppSelector(selectStatusLists);
    const cards = useAppSelector(selectRepoCards);
    const loading = useAppSelector(selectBoardLoading);
    const error = useAppSelector(selectBoardError);

    // ローカル state (Redux に移行しない一時的な状態)
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    // Undo機能用の履歴スタック (最大10件)
    const [history, setHistory] = useState<RepoCardForRedux[][]>([]);
    const [undoMessage, setUndoMessage] = useState<string | null>(null);

    const sensors = useSensors(
      useSensor(MouseSensor, {
        activationConstraint: {
          distance: 8,
        },
      }),
      useSensor(TouchSensor, {
        activationConstraint: {
          delay: 200,
          tolerance: 6,
        },
      }),
      useSensor(KeyboardSensor)
    );

    // TODO: Replace with Supabase integration
    useEffect(() => {
      const fetchData = async () => {
        try {
          dispatch(setLoading(true));
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const now = new Date().toISOString();

          const mockStatuses: StatusListDomain[] = [
            {
              id: "00000000-0000-0000-0000-000000000201",
              title: "Backlog",
              wipLimit: 10,
              color: "#8B7355",
              order: 0,
              boardId: boardId || "default",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "00000000-0000-0000-0000-000000000202",
              title: "Todo",
              wipLimit: 5,
              color: "#6B8E23",
              order: 1,
              boardId: boardId || "default",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "00000000-0000-0000-0000-000000000203",
              title: "In Progress",
              wipLimit: 3,
              color: "#CD853F",
              order: 2,
              boardId: boardId || "default",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "00000000-0000-0000-0000-000000000204",
              title: "Review",
              wipLimit: 4,
              color: "#4682B4",
              order: 3,
              boardId: boardId || "default",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "00000000-0000-0000-0000-000000000205",
              title: "Done",
              wipLimit: 20,
              color: "#556B2F",
              order: 4,
              boardId: boardId || "default",
              createdAt: now,
              updatedAt: now,
            },
          ];

          const mockCards: RepoCardDomain[] = [
            {
              id: "00000000-0000-0000-0000-000000000301",
              title: "gitbox",
              description: "GitHub Repository Manager",
              priority: "high",
              assignee: {
                name: "Ryota Murakami",
                avatar: "/placeholder.svg",
              },
              tags: ["Next.js", "TypeScript"],
              dueDate: "2024-01-15",
              attachments: 3,
              comments: 7,
              statusId: "00000000-0000-0000-0000-000000000203",
              boardId: boardId || "default",
              repoOwner: "ryotamurakami",
              repoName: "gitbox",
              note: "GitHub Repository Manager",
              order: 0,
              meta: {},
              createdAt: now,
              updatedAt: now,
            },
          ];

          dispatch(setStatusLists(mockStatuses));
          dispatch(setRepoCards(mockCards));
          dispatch(setError(null));
        } catch (err) {
          dispatch(setError("Failed to load board data. Please try again later."));
        } finally {
          dispatch(setLoading(false));
        }
      };

      fetchData();
    }, [boardId, dispatch]);

    /**
     * Undo機能: 直前のドラッグ&ドロップ操作を元に戻す
     * Constitution要件: <200ms応答時間
     */
    const handleUndo = useCallback(() => {
      if (history.length === 0) return;

      const previousState = history[history.length - 1];
      dispatch(setRepoCards(previousState));
      setHistory((prev) => prev.slice(0, -1));

      // Undo実行のフィードバック表示 (2秒後に自動消去)
      setUndoMessage("操作を元に戻しました");
      setTimeout(() => setUndoMessage(null), 2000);
    }, [history, dispatch]);

    // キーボードショートカット: Z key でUndo実行
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Z key (大文字・小文字両対応、Cmd/Ctrl不要)
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          handleUndo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]); // handleUndo に依存

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeCard = cards.find((c) => c.id === active.id);
      if (!activeCard) return;

      const overStatusId = over.id as string;
      const overCard = cards.find((c) => c.id === over.id);
      const targetStatusId = overCard ? overCard.statusId : overStatusId;

      // 履歴に現在の状態を保存 (最大10件)
      setHistory((prev) => {
        const newHistory = [...prev, cards];
        return newHistory.slice(-10); // 最新10件のみ保持
      });

      if (activeCard.statusId === targetStatusId) {
        const columnCards = cards.filter((c) => c.statusId === targetStatusId);
        const oldIndex = columnCards.findIndex((c) => c.id === active.id);
        const newIndex = columnCards.findIndex((c) => c.id === over.id);

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnCards, oldIndex, newIndex);
          const otherCards = cards.filter((c) => c.statusId !== targetStatusId);
          dispatch(setRepoCards([...otherCards, ...reordered]));
        }
      } else {
        dispatch(setRepoCards(
          cards.map((c) =>
            c.id === activeCard.id ? { ...c, statusId: targetStatusId } : c
          )
        ));
      }
    };

    if (loading) {
      return (
        <div className="w-full p-6">
          <KanbanSkeleton />
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full p-6">
          <ErrorState message={error} />
        </div>
      );
    }

    const activeCard = cards.find((c) => c.id === activeId);

    return (
      <div className="w-full h-full p-6 relative">
        {/* Undoメッセージ表示 */}
        {undoMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg"
          >
            {undoMessage}
          </motion.div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToParentElement]}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...statuses]
              .sort((a, b) => a.order - b.order)
              .map((status) => (
                <StatusColumn
                  key={status.id}
                  status={status}
                  cards={cards.filter((c) => c.statusId === status.id)}
                  onEdit={onEditProjectInfo}
                  onMaintenance={onMoveToMaintenance}
                />
              ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <Card className="cursor-grabbing shadow-2xl rotate-3 opacity-90">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-foreground">
                    {activeCard.title}
                  </h4>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    );
  }
);
KanbanBoard.displayName = "KanbanBoard";

export default KanbanBoard;
