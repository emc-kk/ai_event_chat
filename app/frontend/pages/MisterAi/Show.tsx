import { Head } from '@inertiajs/react';
import { Layaout } from '../../components/layouts/layout';
import { MisterAi } from '../../features/mister_ai/components/MisterAi';

export default function MisterAiShow() {
  return (
    <Layaout>
      <Head>
        <title>ミスターAI – 業務改善フローAI診断</title>
        <meta name="description" content="AI技術を活用した業務時間削減を予測・診断するサービスです。あなたの業界・課題・役割を入力して、どのくらい業務効率化が可能かを診断します。" />
      </Head>
      <MisterAi />
    </Layaout>
  )
}