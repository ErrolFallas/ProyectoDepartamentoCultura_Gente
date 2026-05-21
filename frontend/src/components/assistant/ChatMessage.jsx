import { ToolCallDetails } from './ToolCallDetails.jsx';
import { AvatarUsuario, AvatarIA } from './Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function ChatMessage({ message }) {
  const esUsuario = message.role === 'user';
  const { user } = useAuth();

  return (
    <div className={`flex items-end gap-2 ${esUsuario ? 'flex-row-reverse' : 'flex-row'}`}>
      {esUsuario ? <AvatarUsuario nombre={user?.nombre} /> : <AvatarIA />}

      <div className="flex flex-col gap-1 max-w-2xl">
        <div className={`text-[10px] uppercase tracking-wider font-semibold ${
          esUsuario ? 'text-ink-500 text-right' : 'text-brand-700'
        }`}>
          {esUsuario ? (user?.nombre?.split(' ')[0] ?? 'Usted') : 'Asistente IA'}
        </div>

        <div className={`rounded-2xl px-4 py-3 ${
          esUsuario
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white border border-ink-200 text-ink-900 rounded-bl-sm shadow-sm'
        }`}>
          {message.content && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
          )}
          {!esUsuario && message.desdeCache && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
              <span>⚡</span>
              <span>
                Acelerada por aprendizaje
                {message.hitCount ? ` · respondida ${message.hitCount} ${message.hitCount === 1 ? 'vez' : 'veces'}` : ''}
              </span>
            </div>
          )}
          {!esUsuario && message.toolCalls?.length > 0 && (
            <ToolCallDetails toolCalls={message.toolCalls} />
          )}
          {!esUsuario && message.latenciaMs != null && (
            <div className="mt-2 text-[10px] text-ink-400">
              {message.desdeCache
                ? 'Respondida desde la memoria del asistente · sin descontar cuota'
                : `Respondida en ${Math.round(message.latenciaMs / 100) / 10} s`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
