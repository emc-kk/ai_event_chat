import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";
import { MisterAiBanner } from "../ui/MisterAiBanner";

type Props = {
  children: ReactNode;
}

export const Layaout: React.FC<Props> = ({ children }) => {
  return (
    <>
      {children}
      <MisterAiBanner />
      <ToastContainer />
    </>
  )
}