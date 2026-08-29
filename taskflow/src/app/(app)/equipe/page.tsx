import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getTeamOverview } from "@/lib/team";
import { NewEmployeeButton } from "@/components/new-employee-modal";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PENDING: "Convite pendente",
  INACTIVE: "Inativo",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-500",
};

export default async function EquipePage() {
  await requireAdmin();
  const team = await getTeamOverview();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Equipe</h1>
          <p className="text-sm text-slate-500">
            Gerencie os funcionarios e acompanhe a carga de tarefas de cada
            um.
          </p>
        </div>
        <NewEmployeeButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">A fazer</th>
              <th className="px-4 py-3">Atrasadas</th>
              <th className="px-4 py-3">Concluidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {team.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/equipe/${member.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {member.name}
                  </Link>
                  {member.role === "ADMIN" && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                      Admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {member.jobTitle ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">{member.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[member.status]}`}
                  >
                    {STATUS_LABEL[member.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{member.todo}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      member.overdue > 0
                        ? "font-medium text-red-600"
                        : "text-slate-600"
                    }
                  >
                    {member.overdue}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{member.done}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-slate-100 md:hidden">
          {team.map((member) => (
            <li key={member.id}>
              <Link href={`/equipe/${member.id}`} className="block px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[member.status]}`}
                  >
                    {STATUS_LABEL[member.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {member.jobTitle ?? member.email}
                </p>
                <div className="mt-2 flex gap-4 text-xs text-slate-500">
                  <span>A fazer: {member.todo}</span>
                  <span
                    className={member.overdue > 0 ? "font-medium text-red-600" : ""}
                  >
                    Atrasadas: {member.overdue}
                  </span>
                  <span>Concluidas: {member.done}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
