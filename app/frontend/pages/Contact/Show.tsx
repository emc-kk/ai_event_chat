import { Head } from '@inertiajs/react';
import { Layaout } from '../../components/layouts/layout';
import { Contact } from '../../features/contact/components/Contact';

export default function ContactShow() {
  return (
    <Layaout>
      <Head>
        <title>taiziii製品 – お問い合わせページ</title>
        <meta name="description" content="taiziiiが提供する製品の中から興味のある製品を選択し、まとめてメールでお問い合わせいただけるページです。" />
      </Head>
      <Contact />
    </Layaout>
  )
}