import { AiAssistantScreen } from '../components/ai/AiAssistantScreen';

const suggestedQuestions = [
  'Resume mi utilidad.',
  '¿Qué afectó más mis resultados?',
  '¿Cómo está mi merma?',
  '¿Qué movimientos debería revisar?',
  'Dame una recomendación financiera.',
];

export default function AnalisisInteligente() {
  return (
    <AiAssistantScreen
      type="financial"
      title="Análisis inteligente"
      subtitle="Revisión de tus resultados, inventario y movimientos recientes"
      suggestions={suggestedQuestions}
      placeholder="Pregunta sobre utilidad, merma, gastos o movimientos..."
      backTo="/resumen-financiero"
    />
  );
}
