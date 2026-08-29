type HistoryEntry = {
  action: string;
  oldValue: string | null;
  newValue: string | null;
  user: { name: string };
};

export function formatHistoryEntry(entry: HistoryEntry): string {
  const actor = entry.user.name;
  switch (entry.action) {
    case "CREATED":
      return `${actor} criou a tarefa.`;
    case "TITLE_CHANGED":
      return `${actor} alterou o titulo de "${entry.oldValue}" para "${entry.newValue}".`;
    case "DESCRIPTION_CHANGED":
      return `${actor} atualizou a descricao da tarefa.`;
    case "NOTES_CHANGED":
      return `${actor} atualizou as observacoes.`;
    case "PRIORITY_CHANGED":
      return `${actor} alterou a prioridade de ${entry.oldValue} para ${entry.newValue}.`;
    case "DUE_DATE_CHANGED":
      return `${actor} alterou o prazo de ${entry.oldValue} para ${entry.newValue}.`;
    case "ASSIGNEE_CHANGED":
      return `${actor} reatribuiu a tarefa de ${entry.oldValue} para ${entry.newValue}.`;
    case "COMPLETED":
      return `${actor} marcou a tarefa como concluida (${entry.newValue}).`;
    case "REOPENED":
      return `${actor} reabriu a tarefa.`;
    case "ATTACHMENT_ADDED":
      return `${actor} anexou o arquivo "${entry.newValue}".`;
    default:
      return `${actor} atualizou a tarefa.`;
  }
}
