class ConfirmationMailer < ApplicationMailer
  def confirmation_instructions(record)
    @record = record
    @user_type = record.class.name.downcase
    @confirmation_url = confirmation_url(
      token: record.confirmation_token,
      type: @user_type
    )

    mail(
      to: record.email,
      subject: "[SkillRelay] メールアドレスの確認"
    )
  end
end
