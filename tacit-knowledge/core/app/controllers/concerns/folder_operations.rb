# フォルダ操作の共通ロジック
# TopicFoldersController、DataSourceFoldersController で使用
module FolderOperations
  extend ActiveSupport::Concern

  private

  # フォルダの子孫IDを全て取得（循環参照防止チェック用）
  def descendant_ids(folder)
    ids = []
    queue = folder.children.pluck(:id)
    while queue.any?
      current_id = queue.shift
      ids << current_id
      queue.concat(folder.class.where(parent_id: current_id).pluck(:id))
    end
    ids
  end

  # フォルダ移動のバリデーション
  def validate_folder_move(folder, new_parent_id, folder_scope)
    if new_parent_id.present? && !folder_scope.exists?(id: new_parent_id)
      return "移動先フォルダが見つかりません"
    end

    if new_parent_id.present? && (new_parent_id == folder.id || descendant_ids(folder).include?(new_parent_id))
      return "移動先が不正です"
    end

    nil
  end
end
