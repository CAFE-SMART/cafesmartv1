import React from 'react';
import { CafeSmartProcessingScreen } from '../../../components/CafeSmartProcessingScreen';

interface LoadingCardProps {
  text: string;
}

export function LoadingCard({ text }: LoadingCardProps) {
  return <CafeSmartProcessingScreen message={text} />;
}
