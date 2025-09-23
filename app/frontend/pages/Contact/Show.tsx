import { Head } from '@inertiajs/react';
import { Layaout } from '../../components/layouts/layout';
import { Contact } from '../../features/contact/components/Contact';

export default function ContactShow() {
  return (
    <Layaout>
      <Head title="AIクイズ | 問い合わせ" />
      <Contact />
    </Layaout>
  )
}