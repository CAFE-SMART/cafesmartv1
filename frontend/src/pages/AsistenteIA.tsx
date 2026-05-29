import { AiAssistantScreen } from '../components/ai/AiAssistantScreen';

const suggestedQuestions = [
  '¿Cómo va mi negocio?',
  'Resume mi inventario.',
  '¿Qué gastos afectaron más este mes?',
  '¿Qué café debería revisar primero?',
  '¿Tengo operaciones pendientes por sincronizar?',
];

export default function AsistenteIA() {
  return (
    <AiAssistantScreen
      type="general"
      title="Asistente CaféSmart"
      subtitle="Consulta información de tu negocio cafetero"
      suggestions={suggestedQuestions}
      placeholder="Pregunta sobre inventario, ventas, compras o sincronización..."
      keepBottomNav
    />
  );
}
