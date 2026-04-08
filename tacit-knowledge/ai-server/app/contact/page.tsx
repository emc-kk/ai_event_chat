"use client";

import { useMemo, useState } from "react";

const services = [
  { id: "ai-teacher", name: "AI Teacher", image: "/images/ai_teacher.png" },
  { id: "skillrelay", name: "スキルリレー", image: "/images/skillrelay.png" },
];

function SendForm({
  serviceNames,
  serviceIds,
}: {
  serviceNames: string[];
  serviceIds: string[];
}) {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"step1" | "step2" | "done">("step1");
  const [companyInput, setCompanyInput] = useState("");
  const [emailInput, setEmailInput] = useState("");

  const handleCompanyNext = () => {
    if (companyInput.trim()) {
      setCompany(companyInput);
      setStep("step2");
      setCompanyInput("");
    }
  };

  const handleEmailNext = () => {
    if (emailInput.trim()) {
      setEmail(emailInput);
      setStep("done");
      setEmailInput("");
    }
  };

  const handleSend = async () => {
    try {
      // DB保存
      await fetch("/api/contact_submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company,
          email,
          interested_services: serviceNames,
          service_ids: serviceIds,
        }),
      });

      // メール送信
      const toAddress = `service+${serviceIds.join("+")}@taiziii.com`;
      const subject = `【展示会お問い合わせ】資料希望：${serviceNames.join("、")}`;
      const body = `以下の内容でお問い合わせを受け付けました。
内容をご確認のうえ、お客様へのご対応をお願いいたします。

ーーーーーーー
■ 会社名
${company}

■ メールアドレス
${email}

■ 関心のある製品
${serviceNames.map((name) => `- ${name}`).join("\n")}
ーーーーーーー`;

      window.location.href = `mailto:${toAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
      console.error(error);
      alert("送信に失敗しました。もう一度お試しください。");
    }
  };

  const renderChatHistory = () => {
    const elements = [];
    if (step !== "step1") {
      elements.push(
        <div key="cq" className="flex items-start mb-2 w-full">
          <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#35556c] mr-2 opacity-0">t</div>
          <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">御社名を教えてください。</div>
        </div>
      );
      elements.push(
        <div key="ca" className="flex items-start mb-2 w-full flex-row-reverse">
          <div className="bg-[#c0e6a8] text-gray-900 rounded-xl px-4 py-3 text-sm w-auto">{company}</div>
        </div>
      );
    }
    if (step === "done") {
      elements.push(
        <div key="eq" className="flex items-start mb-2 w-full">
          <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#35556c] mr-2">taiziii</div>
          <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">ありがとうございます。続いて、ご返信先のメールアドレスをお願いします。資料や詳細情報をこちらにお送り致します。</div>
        </div>
      );
      elements.push(
        <div key="ea" className="flex items-start mb-2 w-full flex-row-reverse">
          <div className="bg-[#c0e6a8] text-gray-900 rounded-xl px-4 py-3 text-sm w-auto">{email}</div>
        </div>
      );
    }
    return elements;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-5">
      <h1 className="text-[#35556c] text-5xl font-bold text-center mb-4">taiziii</h1>

      <div className="flex items-start mb-2 w-full max-w-md">
        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#35556c] mr-2">taiziii</div>
        <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">
          {serviceNames.join("・")}にご興味をお持ちいただきありがとうございます。
        </div>
      </div>
      <div className="flex items-start mb-2 w-full max-w-md">
        <div className="w-10 h-10 rounded-full opacity-0 mr-2">t</div>
        <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">
          資料や詳細のご案内のために、会社名とメールアドレスの入力をお願いします。<br />30秒ほどで完了しますのでご安心ください。
        </div>
      </div>

      <div className="w-full max-w-md">
        {renderChatHistory()}

        {step === "step1" && (
          <>
            <div className="flex items-start mb-2 w-full">
              <div className="w-10 h-10 rounded-full opacity-0 mr-2">t</div>
              <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">御社名を教えてください。</div>
            </div>
            <input
              type="text"
              placeholder="御社名"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              className="w-full max-w-[360px] text-base px-3 py-2.5 border-2 border-gray-900 rounded-md mb-4 mx-auto block"
            />
            <button onClick={handleCompanyNext} className="block mx-auto bg-[#23234a] text-white text-lg font-bold border-none rounded-lg px-8 py-2 cursor-pointer hover:bg-[#35556c]">OK</button>
          </>
        )}

        {step === "step2" && (
          <>
            <div className="flex items-start mb-2 w-full">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#35556c] mr-2">taiziii</div>
              <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">ありがとうございます。続いて、ご返信先のメールアドレスをお願いします。資料や詳細情報をこちらにお送り致します。</div>
            </div>
            <input
              type="text"
              placeholder="メールアドレス"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full max-w-[360px] text-base px-3 py-2.5 border-2 border-gray-900 rounded-md mb-4 mx-auto block"
            />
            <button onClick={handleEmailNext} className="block mx-auto bg-[#23234a] text-white text-lg font-bold border-none rounded-lg px-8 py-2 cursor-pointer hover:bg-[#35556c]">OK</button>
          </>
        )}

        {step === "done" && (
          <>
            <div className="flex items-start mb-2 w-full">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#35556c] mr-2">taiziii</div>
              <div className="bg-[#dbe7fa] text-gray-900 rounded-xl px-4 py-3 text-sm w-full">入力はこれで完了です。送信ボタンを押してください。</div>
            </div>
            <button onClick={handleSend} className="block mx-auto bg-[#23234a] text-white text-lg font-bold border-none rounded-lg px-8 py-2 cursor-pointer hover:bg-[#35556c]">送信</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContactPage() {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [isSending, setSending] = useState(false);

  const serviceNames = useMemo(() => {
    return services.filter((s) => selectedServices.has(s.id)).map((s) => s.name);
  }, [selectedServices]);

  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleContact = () => {
    if (selectedServices.size === 0) {
      alert("サービスを選択してください。");
      return;
    }
    setSending(true);
  };

  if (isSending) {
    return (
      <SendForm
        serviceNames={serviceNames}
        serviceIds={Array.from(selectedServices)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-5">
      <h1 className="text-[#35556c] text-5xl font-bold text-center mb-4">taiziii</h1>
      <p className="text-center text-base text-gray-500 mb-2">ボタンを選んでください</p>
      <p className="text-center text-xs text-gray-400 mb-8">複数選択可能です</p>

      <div className="flex flex-col gap-4 mb-10 max-w-[400px] mx-auto">
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => toggleService(service.id)}
            className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02] border-2 ${
              selectedServices.has(service.id) ? "border-[#3270DE]" : "border-transparent"
            }`}
          >
            <img src={service.image} alt={service.name} className="w-full h-auto block" />
            {selectedServices.has(service.id) && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-lg font-bold">選択済み</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-500 mb-8">{selectedServices.size}個の製品を選択中</p>

      <button
        onClick={handleContact}
        disabled={selectedServices.size === 0}
        className="w-full max-w-[400px] mx-auto block bg-[#35556c] text-white py-4 px-6 border-none rounded-lg text-base font-bold cursor-pointer transition-colors hover:bg-[#2d4757] disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        メールする
      </button>
    </div>
  );
}
