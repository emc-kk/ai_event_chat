import styled from '@emotion/styled';
import { useMemo, useState } from 'react';
import { Main } from "../../../components/ui/Main";
import { Title } from "../../../components/ui/Title";
import bunner1 from "../../../assets/bunner_1.png";
import bunner2 from "../../../assets/bunner_2.png";
import bunner3 from "../../../assets/bunner_3.png";
import { Send } from './Send';

const MainC = styled(Main)`
  background-color: #fff;
  padding: 20px;
  justify-content: flex-start;
`

const TitleC = styled(Title)`
  color: #35556C;
  background-color: transparent;
  border-radius: 0;
  font-size: 56px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 16px;
`

const Subtitle = styled.div`
  text-align: center;
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
`

const Description = styled.div`
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 30px;
`

const ServiceGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 40px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
`

const ServiceItem = styled.div<{ isSelected: boolean }>`
  position: relative;
  cursor: pointer;
  border: 2px solid ${props => props.isSelected ? '#3270DE' : 'transparent'};
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.02);
  }
`

const ServiceImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
`

const SelectionOverlay = styled.div<{ isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${props => props.isVisible ? 1 : 0};
  transition: opacity 0.2s ease;
  pointer-events: none;
`

const SelectionText = styled.div`
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
`

const StatusText = styled.div`
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 30px;
`

const ContactButton = styled.button`
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  display: block;
  background-color: #35556C;
  color: #fff;
  padding: 16px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #2d4757;
  }
  
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

const services = [
  { id: 'mister-ai', name: 'ミスターAI', image: bunner1 },
  { id: 'skill-relay', name: 'スキルリレー', image: bunner2 },
  { id: 'ai-training', name: 'AI研修', image: bunner3 },
];

export const Contact = () => {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [isSending, setSending] = useState(false);

  const serviceNames = useMemo(() => {
    return services.filter(s => selectedServices.has(s.id)).map(s => s.name);
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
      alert('サービスを選択してください。');
      return;
    }
    setSending(true);
  };

  if (isSending) {
    return <Send serviceNames={serviceNames} />
  }

  return (
    <MainC>
      <TitleC>taiziii</TitleC>
      <Subtitle>ボタンを選んでください</Subtitle>
      <Description>複数選択可能です</Description>
      
      <ServiceGrid>
        {services.map((service) => (
          <ServiceItem
            key={service.id}
            isSelected={selectedServices.has(service.id)}
            onClick={() => toggleService(service.id)}
          >
            <ServiceImage src={service.image} alt={service.name} />
            <SelectionOverlay isVisible={selectedServices.has(service.id)}>
              <SelectionText>選択済み</SelectionText>
            </SelectionOverlay>
          </ServiceItem>
        ))}
      </ServiceGrid>
      
      <StatusText>
        {selectedServices.size}個の製品を選択中
      </StatusText>
      
      <ContactButton 
        onClick={handleContact}
        disabled={selectedServices.size === 0}
      >
        メールする
      </ContactButton>
    </MainC>
  )
}