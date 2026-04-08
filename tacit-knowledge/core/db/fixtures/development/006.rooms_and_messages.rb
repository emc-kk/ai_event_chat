company = Company.find_by(name: "株式会社サンプル")
topic = Topic.find_by(name: "受注処理の手順", company_id: company&.id)
request = topic&.requests&.find_by(name: "受注処理ヒアリング")

unless topic && request
  puts "006: Skip - Required records not found"
  return
end

# ヒアリングRoom（完了済み）
hearing_room = Room.find_or_initialize_by(request_id: request.id, chat_type: "hearing")
hearing_room.assign_attributes(
  topic_id: topic.id,
  is_finished: true,
  is_deleted: false
)

if hearing_room.save
  puts "Hearing Room created (ID: #{hearing_room.id}, finished: true)"
else
  puts "Failed to create Hearing Room:"
  hearing_room.errors.full_messages.each { |msg| puts "  - #{msg}" }
end

# トピックRoom（チャット用、未完了）
topic_room = Room.find_or_initialize_by(topic_id: topic.id, chat_type: "topic")
topic_room.assign_attributes(
  is_finished: false,
  is_deleted: false
)

if topic_room.save
  puts "Topic Room created (ID: #{topic_room.id})"
else
  puts "Failed to create Topic Room:"
  topic_room.errors.full_messages.each { |msg| puts "  - #{msg}" }
end

# ヒアリングメッセージ（冪等性: 既にメッセージがあればスキップ）
if hearing_room.persisted? && Message.where(room_id: hearing_room.id).count == 0
  conversations = [
    { message_type: :assistant, content: "受注処理の全体的な流れを教えていただけますか？まず、注文が入ってから最初に行う作業は何ですか？" },
    { message_type: :user, content: "まず注文書が届いたら、在庫確認をします。在庫があれば受注登録、なければ仕入先に発注をかけます。急ぎの案件の場合は営業担当に納期を確認してから対応します。" },
    { message_type: :assistant, content: "在庫確認の際、特に注意すべきポイントはありますか？判断が難しいケースがあれば教えてください。" },
    { message_type: :user, content: "引当済みの在庫と実在庫の差に注意が必要です。月末は特にずれやすいので、必ず実棚と突合します。また、ロット管理品は先入先出を徹底しないとクレームにつながります。" },
    { message_type: :assistant, content: "受注登録後の出荷指示までの流れで、判断が必要な場面はありますか？" },
    { message_type: :user, content: "出荷先が初めての場合は与信チェックが必要です。既存顧客でも50万円以上は上長承認を取ります。分割出荷の場合は顧客と出荷スケジュールを事前に合意してから進めます。" }
  ]

  prev_assistant_msg = nil
  conversations.each do |conv|
    msg = Message.new(
      room_id: hearing_room.id,
      topic_id: topic.id,
      request_id: request.id,
      message_type: conv[:message_type],
      chat_type: :hearing,
      content: conv[:content],
      question_id: conv[:message_type] == :user ? prev_assistant_msg&.id : nil
    )

    if msg.save
      prev_assistant_msg = msg if conv[:message_type] == :assistant
    else
      puts "Failed to create message:"
      msg.errors.full_messages.each { |m| puts "  - #{m}" }
    end
  end

  puts "Hearing messages created: #{Message.where(room_id: hearing_room.id).count} messages"
else
  puts "Hearing messages: already exist (#{Message.where(room_id: hearing_room.id).count} messages)"
end
