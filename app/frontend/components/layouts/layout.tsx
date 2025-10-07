import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";
import { MisterAiBanner } from "../ui/MisterAiBanner";
import styled from "@emotion/styled";

type Props = {
  children: ReactNode;
}

const LayoutContainer = styled.div`
  background-color: #35556C;
`;

const LayoutInner = styled.div`
  max-width: 980px;
  margin: 0 auto;
  position: relative;
`;

export const Layaout: React.FC<Props> = ({ children }) => {
  return (
    <LayoutContainer>
      <LayoutInner>
        {children}
        <MisterAiBanner />
        <ToastContainer />
      </LayoutInner>
    </LayoutContainer>
  )
}