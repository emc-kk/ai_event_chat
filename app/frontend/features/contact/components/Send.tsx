import styled from "@emotion/styled";
import { Main } from "../../../components/ui/Main";
import { Title } from "../../../components/ui/Title";
import { useRef, useState } from "react";
import { postContactSubmission } from "../api/contact_submission";
import { toast } from "react-toastify";

type Props = {
  serviceNames: string[];
  serviceIds: string[];
}

const MainC = styled(Main)`
  background-color: #fff;
  padding: 20px;
  justify-content: flex-start;
`;

const TitleC = styled(Title)`
  color: #35556c;
  background-color: transparent;
  border-radius: 0;
  font-size: 56px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 16px;
`;

const ChatRow = styled.div`
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  width: 100%;
`;

const ChatLogo = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: #35556c;
  margin-right: 8px;
`;

const ChatBubble = styled.div`
  background: #dbe7fa;
  color: #222;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 15px;
  margin-bottom: 6px;
  width: 100%;
  word-break: break-word;
`;

const UserChatRow = styled(ChatRow)`
  flex-direction: row-reverse;
`;

const UserChatBubble = styled(ChatBubble)`
  background: #c0e6a8;
  width: auto;
`;

const Input = styled.input`
  width: 100%;
  max-width: 360px;
  font-size: 16px;
  padding: 10px 12px;
  border: 2px solid #222;
  border-radius: 6px;
  margin-bottom: 18px;
  box-sizing: border-box;
`;

const Button = styled.button`
  display: block;
  margin: 0 auto;
  background: #23234a;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  padding: 8px 32px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  &:hover {
    background: #35556c;
  }
`;

export const Send = ({ serviceNames, serviceIds }: Props) => {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"step1" | "step2" | "done">("step1");
  const companyRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleCompanyNext = () => {
    const value = companyRef.current?.value || "";
    if (value.trim()) {
      setCompany(value);
      setStep("step2");
      // inputをクリア
      if (companyRef.current) {
        companyRef.current.value = "";
      }
    }
  };

  const handleEmailNext = () => {
    const value = emailRef.current?.value || "";
    if (value.trim()) {
      setEmail(value);
      setStep("done");
      // inputをクリア
      if (emailRef.current) {
        emailRef.current.value = "";
      }
    }
  };

  const handleSend = async () => {
    try {
      await postContactSubmission({
        companyName: company,
        email,
        interestedServices: serviceNames,
        serviceIds
      })
      // メール送信処理
      const toAddress = `service+${serviceIds.join('+')}@taiziii.com`;
      const subject = `【展示会お問い合わせ】資料希望：${serviceNames.join('、')}`;
      const body = `以下の内容でお問い合わせを受け付けました。
  内容をご確認のうえ、お客様へのご対応をお願いいたします。

  ーーーーーーー
  ■ 会社名
  ${company}

  ■ メールアドレス
  ${email}

  ■ 関心のある製品
  ${serviceNames.map(name => `- ${name}`).join('\n')}
  ーーーーーーー`;

      // メールリンクを作成
      const mailtoLink = `mailto:${toAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // デフォルトメーラーを開く
      window.location.href = mailtoLink;
    } catch (error) {
      console.error(error);
      toast.error('Soorry, something went wrong. Please try again later.');
    }
  };

  const renderChatHistory = () => {
    const chatElements = [];

    // Step 1のチャット履歴
    if (step !== "step1") {
      chatElements.push(
        <ChatRow key="company-question">
          <ChatLogo style={{opacity: 0}}>taiziii</ChatLogo>
          <ChatBubble>御社名を教えてください。</ChatBubble>
        </ChatRow>
      );
      chatElements.push(
        <UserChatRow key="company-answer">
          <UserChatBubble>{company}</UserChatBubble>
        </UserChatRow>
      );
    }

    // Step 2のチャット履歴
    if (step === "done") {
      chatElements.push(
        <ChatRow key="email-question">
          <ChatLogo>taiziii</ChatLogo>
          <ChatBubble>
            ありがとうございます。
            続いて、ご返信先のメールアドレスをお願いします。
            資料や詳細情報をこちらにお送り致します。
          </ChatBubble>
        </ChatRow>
      );
      chatElements.push(
        <UserChatRow key="email-answer">
          <UserChatBubble>{email}</UserChatBubble>
        </UserChatRow>
      );
    }

    return chatElements;
  };

  const renderCurrentStep = () => {
    switch (step) {
      case "step1":
        return (
          <>
            <ChatRow>
              <ChatLogo style={{opacity: 0}}>taiziii</ChatLogo>
              <ChatBubble>御社名を教えてください。</ChatBubble>
            </ChatRow>
            <Input type="text" placeholder="御社名" ref={companyRef} />
            <Button onClick={handleCompanyNext}>OK</Button>
          </>
        );
      case "step2":
        return (
          <>
            <ChatRow>
              <ChatLogo>taiziii</ChatLogo>
              <ChatBubble>
                ありがとうございます。
                続いて、ご返信先のメールアドレスをお願いします。
                資料や詳細情報をこちらにお送り致します。
              </ChatBubble>
            </ChatRow>
            <Input type="text" placeholder="メールアドレス" ref={emailRef} />
            <Button onClick={handleEmailNext}>OK</Button>
          </>
        );
      case "done":
        return (
          <>
            <ChatRow>
              <ChatLogo>taiziii</ChatLogo>
              <ChatBubble>
                入力はこれで完了です。送信ボタンを押してください。
              </ChatBubble>
            </ChatRow>
            <Button onClick={handleSend}>送信</Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <MainC>
      <TitleC>taiziii</TitleC>
      <ChatRow>
        <ChatLogo>taiziii</ChatLogo>
        <ChatBubble>
          {serviceNames.join("・")}にご興味をお持ちいただきありがとうございます。
        </ChatBubble>
      </ChatRow>
      <ChatRow>
        <ChatLogo style={{opacity: 0}}>taiziii</ChatLogo>
        <ChatBubble>
          資料や詳細のご案内のために、会社名とメールアドレスの入力をお願いします。
          <br />
          30秒ほどで完了しますのでご安心ください。
        </ChatBubble>
      </ChatRow>
      {renderChatHistory()}
      {renderCurrentStep()}
    </MainC>
  );
};
