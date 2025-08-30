import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";

type Props = {
  children: ReactNode;
}

export const Layaout: React.FC<Props> = ({ children }) => {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}