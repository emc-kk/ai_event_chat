import { Head } from '@inertiajs/react'
import styled from '@emotion/styled';

const Title = styled.h1`
  font-size: 2rem;
  color: red;
`

export default function InertiaExample({ name }: { name: string }) {

  return (
    <>
      <Head title="Inertia + Vite Ruby + React Example" />
      <div>
        <Title>Hello! {name}</Title>
      </div>
    </>
  )
}
