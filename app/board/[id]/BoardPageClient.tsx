/**
 * Board Page Client Component
 *
 * Constitution要件:
 * - Principle V: セキュリティファースト
 * - Principle VI: TDD - テストファースト
 *
 * User Story 4:
 * - Project Info modalの統合
 * - Optimistic UI updates
 */

'use client';

import { useState, useCallback } from 'react';
import { KanbanBoard } from '@/components/Board/KanbanBoard';
import { ProjectInfoModal, ProjectInfo } from '@/components/Modals/ProjectInfoModal';
import { getProjectInfo, upsertProjectInfo, ProjectInfoData } from '@/lib/actions/project-info';
import { useAppDispatch } from '@/lib/redux/store';

interface BoardPageClientProps {
  boardId: string;
  boardName: string;
}

export function BoardPageClient({ boardId, boardName }: BoardPageClientProps) {
  const dispatch = useAppDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Project Info モーダルを開く
   * Constitution要件: Principle VI - TDD
   */
  const handleEditProjectInfo = useCallback(async (cardId: string) => {
    setSelectedCardId(cardId);
    setIsLoading(true);

    try {
      // Project Info取得
      const data = await getProjectInfo(cardId);
      setProjectInfo({
        id: cardId,
        quickNote: data?.quickNote || '',
        links: data?.links || [],
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to load project info:', error);
      // エラーの場合も空の状態でモーダルを開く
      setProjectInfo({
        id: cardId,
        quickNote: '',
        links: [],
      });
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Project Info保存（Optimistic Update）
   * Constitution要件: Principle V - セキュリティファースト
   * T069: Optimistic updates実装
   */
  const handleSaveProjectInfo = useCallback(
    async (data: ProjectInfoData) => {
      if (!selectedCardId) return;

      // Optimistic Update: UIを即座に更新
      setProjectInfo((prev) =>
        prev
          ? {
              ...prev,
              quickNote: data.quickNote,
              links: data.links,
            }
          : null
      );

      try {
        // バックエンド保存（非同期）
        await upsertProjectInfo(selectedCardId, data);

        // TODO: Redux stateも更新（Phase 6で実装）
        // dispatch(updateProjectInfo({ cardId: selectedCardId, data }));
      } catch (error) {
        console.error('Failed to save project info:', error);

        // エラー時はロールバック
        try {
          const rollbackData = await getProjectInfo(selectedCardId);
          setProjectInfo({
            id: selectedCardId,
            quickNote: rollbackData?.quickNote || '',
            links: rollbackData?.links || [],
          });
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }

        // ユーザーにエラー通知
        // TODO: Toast notification (Phase 6で実装)
        alert('Failed to save project information. Please try again.');
      }
    },
    [selectedCardId]
  );

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCardId(null);
    setProjectInfo(null);
  }, []);

  /**
   * Maintenance Modeへ移動
   * User Story 6で実装予定
   */
  const handleMoveToMaintenance = useCallback((cardId: string) => {
    // TODO: Maintenance Modeへ移動 (User Story 6で実装)
    console.log('Move to Maintenance:', cardId);
  }, []);

  return (
    <>
      <main className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {boardName}
            </h1>

            {/* ボード設定ボタン (将来的に実装) */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Board Settings
              </button>
            </div>
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          <KanbanBoard
            boardId={boardId}
            onEditProjectInfo={handleEditProjectInfo}
            onMoveToMaintenance={handleMoveToMaintenance}
          />
        </div>
      </main>

      {/* Project Info Modal */}
      {projectInfo && (
        <ProjectInfoModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveProjectInfo}
          projectInfo={projectInfo}
        />
      )}
    </>
  );
}
