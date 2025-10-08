import React from 'react';
import styled from '@emotion/styled';
import { Link } from '@inertiajs/react';

const BannerContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #5c8edc, #ff8e8e);
  color: white;
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
  overflow: visible;
  width: 100%;
  box-sizing: border-box;
  line-height: 1;
  border-top: 1px solid white;
  border-bottom: 1px solid white;
  animation: gentle-pulse 3s ease-in-out infinite;
  opacity: 0.9;
  
  @keyframes gentle-pulse {
    0%, 100% { 
      transform: scale(1);
      box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
    }
    50% { 
      transform: scale(1.02);
      box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6);
    }
  }
  
  @media (max-width: 768px) {
    bottom: 0;
    left: 0;
  }
  
  @media (max-width: 480px) {
    bottom: 0;
    left: 0;
    font-size: 11px;
  }
`;

const BannerLink = styled(Link)`
  display: block;
  text-decoration: none;
  color: white;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: translateY(-1px);
  }
`;

interface Props {
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

export const MisterAiBanner: React.FC<Props> = ({ 
  className 
}) => {
  if (['/mister_ai', '/contact', '/ai_words'].includes(window.location.pathname)) {
    return null;
  }

  return (
    <BannerContainer className={className}>
      <BannerLink href="/mister_ai">
        🚀AI業務診断はこちら!
      </BannerLink>
    </BannerContainer>
  );
};