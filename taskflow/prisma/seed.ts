import { PrismaClient, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("Limpando dados existentes...");
  await prisma.notification.deleteMany();
  await prisma.taskHistory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.user.deleteMany();

  console.log("Criando usuarios de demonstracao...");
  const adminPassword = await hash("admin123");
  const employeePassword = await hash("senha123");

  const admin = await prisma.user.create({
    data: {
      name: "Ana Ferreira",
      email: "ana.admin@taskflow.local",
      passwordHash: adminPassword,
      role: "ADMIN",
      jobTitle: "Gerente de Operacoes",
      status: "ACTIVE",
    },
  });

  const [bruno, carla, diego, elisa, fabio] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Bruno Santos",
        email: "bruno.santos@taskflow.local",
        passwordHash: employeePassword,
        role: "EMPLOYEE",
        jobTitle: "Analista Financeiro",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Carla Souza",
        email: "carla.souza@taskflow.local",
        passwordHash: employeePassword,
        role: "EMPLOYEE",
        jobTitle: "Designer",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Diego Lima",
        email: "diego.lima@taskflow.local",
        passwordHash: employeePassword,
        role: "EMPLOYEE",
        jobTitle: "Desenvolvedor",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Elisa Rocha",
        email: "elisa.rocha@taskflow.local",
        passwordHash: employeePassword,
        role: "EMPLOYEE",
        jobTitle: "Analista de Marketing",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Fabio Alves",
        email: "fabio.alves@taskflow.local",
        passwordHash: null,
        role: "EMPLOYEE",
        jobTitle: "Consultor de Vendas",
        status: "PENDING",
      },
    }),
  ]);

  // Fabio ainda nao aceitou o convite: cria um token de convite valido.
  await prisma.inviteToken.create({
    data: {
      token: "demo-invite-fabio-token",
      userId: fabio.id,
      expiresAt: daysFromNow(7),
    },
  });

  console.log("Criando tarefas de demonstracao...");

  type TaskSeed = {
    title: string;
    description: string;
    requesterId: string;
    assigneeId: string;
    priority: Priority;
    dueDateOffset: number;
    notes?: string;
    complete?: { atOffset: number };
  };

  const seeds: TaskSeed[] = [
    {
      title: "Revisar relatorio financeiro de outubro",
      description: "Conferir os numeros consolidados antes do envio a diretoria.",
      requesterId: admin.id,
      assigneeId: bruno.id,
      priority: "HIGH",
      dueDateOffset: -3,
      notes: "Priorizar a conciliacao bancaria.",
    },
    {
      title: "Atualizar identidade visual do site",
      description: "Aplicar a nova paleta de cores aprovada pela diretoria.",
      requesterId: admin.id,
      assigneeId: carla.id,
      priority: "MEDIUM",
      dueDateOffset: -1,
    },
    {
      title: "Corrigir bug no modulo de login",
      description: "Usuarios relatam erro intermitente ao autenticar.",
      requesterId: admin.id,
      assigneeId: diego.id,
      priority: "URGENT",
      dueDateOffset: 0,
    },
    {
      title: "Preparar apresentacao para o cliente Alfa",
      description: "Slides com os resultados da campanha do ultimo trimestre.",
      requesterId: elisa.id,
      assigneeId: carla.id,
      priority: "HIGH",
      dueDateOffset: 1,
    },
    {
      title: "Planejar campanha de fim de ano",
      description: "Definir tema, canais e orcamento estimado.",
      requesterId: admin.id,
      assigneeId: elisa.id,
      priority: "MEDIUM",
      dueDateOffset: 4,
    },
    {
      title: "Configurar backup automatico do banco de dados",
      description: "Garantir rotina diaria com retencao de 30 dias.",
      requesterId: admin.id,
      assigneeId: diego.id,
      priority: "HIGH",
      dueDateOffset: 6,
    },
    {
      title: "Enviar proposta comercial para novo lead",
      description: "Cliente pediu orcamento para o plano anual.",
      requesterId: bruno.id,
      assigneeId: fabio.id,
      priority: "LOW",
      dueDateOffset: 5,
    },
    {
      title: "Revisar contrato de fornecedor",
      description: "Validar clausulas de reajuste antes de assinar.",
      requesterId: admin.id,
      assigneeId: bruno.id,
      priority: "MEDIUM",
      dueDateOffset: -6,
      complete: { atOffset: -7 },
    },
    {
      title: "Publicar posts da semana nas redes sociais",
      description: "Feed e stories conforme calendario editorial.",
      requesterId: elisa.id,
      assigneeId: carla.id,
      priority: "LOW",
      dueDateOffset: -2,
      complete: { atOffset: -3 },
    },
    {
      title: "Corrigir layout quebrado no mobile",
      description: "Pagina de checkout desalinhada em telas pequenas.",
      requesterId: elisa.id,
      assigneeId: diego.id,
      priority: "URGENT",
      dueDateOffset: -4,
      complete: { atOffset: -1 },
    },
    {
      title: "Organizar treinamento de novos processos",
      description: "Agendar sala e convidar a equipe comercial.",
      requesterId: admin.id,
      assigneeId: bruno.id,
      priority: "LOW",
      dueDateOffset: 10,
    },
    {
      title: "Auditar despesas de viagem do trimestre",
      description: "Conferir notas fiscais e reembolsos pendentes.",
      requesterId: admin.id,
      assigneeId: bruno.id,
      priority: "MEDIUM",
      dueDateOffset: 2,
    },
  ];

  for (const seed of seeds) {
    const dueDate = daysFromNow(seed.dueDateOffset);
    const task = await prisma.task.create({
      data: {
        title: seed.title,
        description: seed.description,
        requesterId: seed.requesterId,
        assigneeId: seed.assigneeId,
        priority: seed.priority,
        notes: seed.notes,
        dueDate,
        status: seed.complete ? "DONE" : "TODO",
        completedAt: seed.complete ? daysFromNow(seed.complete.atOffset) : null,
        createdAt: daysFromNow(Math.min(seed.dueDateOffset - 5, -8)),
      },
    });

    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        userId: seed.requesterId,
        action: "CREATED",
        newValue: `Solicitada para prazo ${dueDate.toLocaleDateString("pt-BR")}.`,
        createdAt: task.createdAt,
      },
    });

    await prisma.notification.create({
      data: {
        userId: seed.assigneeId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `Voce recebeu a tarefa "${task.title}".`,
        read: true,
        createdAt: task.createdAt,
      },
    });

    if (seed.complete) {
      const onTime = task.completedAt! <= task.dueDate;
      await prisma.taskHistory.create({
        data: {
          taskId: task.id,
          userId: seed.assigneeId,
          action: "COMPLETED",
          newValue: onTime ? "Concluida no prazo" : "Concluida com atraso",
          createdAt: task.completedAt!,
        },
      });
      await prisma.notification.create({
        data: {
          userId: seed.requesterId,
          taskId: task.id,
          type: "TASK_COMPLETED",
          message: `A tarefa "${task.title}" foi concluida (${
            onTime ? "no prazo" : "com atraso"
          }).`,
          read: false,
          createdAt: task.completedAt!,
        },
      });
    } else if (dueDate < new Date()) {
      await prisma.notification.create({
        data: {
          userId: seed.requesterId,
          taskId: task.id,
          type: "TASK_OVERDUE",
          message: `A tarefa "${task.title}" atribuida a ${
            (await prisma.user.findUnique({ where: { id: seed.assigneeId } }))
              ?.name
          } esta atrasada.`,
          read: false,
        },
      });
    }
  }

  console.log("Seed concluido.");
  console.log("---");
  console.log("Login admin:      ana.admin@taskflow.local / admin123");
  console.log("Login funcionario: bruno.santos@taskflow.local / senha123");
  console.log("(demais funcionarios com senha123, exceto Fabio Alves, que esta com convite pendente)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
