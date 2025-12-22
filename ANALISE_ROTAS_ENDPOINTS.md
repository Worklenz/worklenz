# Análise Completa de Rotas e Endpoints - Worklenz

**Data da Análise:** 2025-12-22
**Branch:** claude/analyze-project-routes-FxkRB

---

## Sumário Executivo

O Worklenz é uma aplicação full-stack de gerenciamento de projetos construída com:
- **Backend:** Node.js/Express.js + TypeScript + PostgreSQL
- **Frontend:** React 18 + TypeScript + Vite + Redux
- **Arquitetura:** Monorepo com separação clara entre frontend e backend
- **Autenticação:** Passport.js + JWT + CSRF Protection
- **Real-time:** Socket.io para atualizações em tempo real

Todas as rotas da API estão sob o prefixo `/api/v1` e requerem autenticação JWT com rate limiting de 1500 requisições a cada 15 minutos.

---

## 1. CLIENTES (Clients)

### 1.1 Estrutura da Tabela

**Tabela:** `clients`
**Localização:** `/worklenz-backend/database/sql/1_tables.sql:83-97`

```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT CHECK (char_length(name) <= 60),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Rotas e Endpoints

**Base URL:** `/api/v1/clients`
**Router:** `/worklenz-backend/src/routes/apis/clients-api-router.ts`
**Controller:** `/worklenz-backend/src/controllers/clients-controller.ts`

| Método | Endpoint | Autenticação | Validadores | Descrição |
|--------|----------|--------------|-------------|-----------|
| POST | `/` | JWT | `projectManagerValidator`<br>`clientsBodyValidator` | Cria um novo cliente |
| GET | `/` | JWT | - | Lista todos os clientes com paginação |
| GET | `/:id` | JWT | `teamOwnerOrAdminValidator`<br>`idParamValidator` | Obtém cliente por ID |
| PUT | `/:id` | JWT | `teamOwnerOrAdminValidator`<br>`clientsBodyValidator`<br>`idParamValidator` | Atualiza um cliente |
| DELETE | `/:id` | JWT | `teamOwnerOrAdminValidator`<br>`idParamValidator` | Remove um cliente |

### 1.3 Detalhamento dos Endpoints

#### POST `/api/v1/clients`
**Permissão:** Gerente de Projeto ou superior
**Validação:**
```typescript
{
  name: string (required, trimmed)
}
```

**Lógica de Negócio:**
- Insere novo cliente associado ao `team_id` do usuário autenticado
- Retorna `id` e `name` do cliente criado

**SQL:** `/worklenz-backend/src/controllers/clients-controller.ts:15`
```sql
INSERT INTO clients (name, team_id)
VALUES ($1, $2)
RETURNING id, name;
```

---

#### GET `/api/v1/clients`
**Permissão:** Qualquer membro autenticado
**Parâmetros de Query:**
- `search` - Busca por nome
- `sortField` - Campo para ordenação (padrão: "name")
- `sortOrder` - ASC ou DESC
- `size` - Tamanho da página
- `offset` - Posição inicial

**Resposta:**
```typescript
{
  total: number,
  data: [
    {
      id: string,
      name: string,
      projects_count: number
    }
  ]
}
```

**Lógica de Negócio:**
- Filtra por `team_id` do usuário
- Inclui contagem de projetos associados a cada cliente
- Suporta paginação e ordenação

**SQL:** `/worklenz-backend/src/controllers/clients-controller.ts:25-38`

---

#### GET `/api/v1/clients/:id`
**Permissão:** Proprietário do Time ou Admin
**Resposta:**
```typescript
{
  id: string,
  name: string
}
```

**SQL:** `/worklenz-backend/src/controllers/clients-controller.ts:47`
```sql
SELECT id, name
FROM clients
WHERE id = $1 AND team_id = $2
```

---

#### PUT `/api/v1/clients/:id`
**Permissão:** Proprietário do Time ou Admin
**Validação:**
```typescript
{
  name: string (required, trimmed)
}
```

**SQL:** `/worklenz-backend/src/controllers/clients-controller.ts:55`
```sql
UPDATE clients
SET name = $3
WHERE id = $1 AND team_id = $2;
```

---

#### DELETE `/api/v1/clients/:id`
**Permissão:** Proprietário do Time ou Admin
**Comportamento:**
- Remove o cliente do banco
- Devido ao `ON DELETE SET NULL` na FK de `projects.client_id`, os projetos associados terão `client_id = NULL`

**SQL:** `/worklenz-backend/src/controllers/clients-controller.ts:62`
```sql
DELETE FROM clients
WHERE id = $1 AND team_id = $2;
```

---

## 2. CATEGORIAS DE PROJETO (Project Categories)

### 2.1 Estrutura da Tabela

**Tabela:** `project_categories`
**Localização:** `/worklenz-backend/database/sql/1_tables.sql:614-626`

```sql
CREATE TABLE project_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    color_code WL_HEX_COLOR DEFAULT '#70a6f3',
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tipo Customizado:** `WL_HEX_COLOR` - Valida códigos de cor hexadecimal

### 2.2 Rotas e Endpoints

**Base URL:** `/api/v1/project-categories`
**Router:** `/worklenz-backend/src/routes/apis/project-categories-api-router.ts`
**Controller:** `/worklenz-backend/src/controllers/project-categories-controller.ts`

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|--------------|-----------|
| POST | `/` | JWT | Cria uma nova categoria |
| GET | `/` | JWT | Lista todas as categorias |
| GET | `/org-categories` | JWT | Lista categorias de múltiplos times da organização |
| GET | `/:id` | JWT | Obtém categoria por ID |
| PUT | `/:id` | JWT | Atualiza cor da categoria |
| DELETE | `/:id` | JWT | Remove uma categoria |

### 2.3 Detalhamento dos Endpoints

#### POST `/api/v1/project-categories`
**Validação:**
```typescript
{
  name: string (required, trimmed)
}
```

**Lógica de Negócio:**
- Gera automaticamente um `color_code` baseado no nome usando a função `getColor(name)`
- Associa ao `team_id` e `created_by` do usuário autenticado

**SQL:** `/worklenz-backend/src/controllers/project-categories-controller.ts:19-23`
```sql
INSERT INTO project_categories (name, team_id, created_by, color_code)
VALUES ($1, $2, $3, $4)
RETURNING id, name, color_code;
```

**Utilidade:** `getColor(name)` - Função que gera um código de cor consistente baseado no hash do nome

---

#### GET `/api/v1/project-categories`
**Resposta:**
```typescript
[
  {
    id: string,
    name: string,
    color_code: string,
    usage: number  // Quantidade de projetos usando esta categoria
  }
]
```

**SQL:** `/worklenz-backend/src/controllers/project-categories-controller.ts:32-36`
```sql
SELECT id, name, color_code,
       (SELECT COUNT(*) FROM projects WHERE category_id = project_categories.id) AS usage
FROM project_categories
WHERE team_id = $1;
```

---

#### GET `/api/v1/project-categories/org-categories`
**Descrição:** Retorna categorias de todos os times da organização
**Lógica de Negócio:**
1. Busca todos os times da organização usando função `in_organization(id, $1)`
2. Retorna categorias de todos esses times

**SQL:** `/worklenz-backend/src/controllers/project-categories-controller.ts:58-66`

---

#### PUT `/api/v1/project-categories/:id`
**Validação:**
```typescript
{
  color: string (required, must be in WorklenzColorCodes)
}
```

**Lógica de Negócio:**
- Apenas atualiza a cor da categoria
- Valida se a cor está na lista de cores permitidas (`WorklenzColorCodes`)

**SQL:** `/worklenz-backend/src/controllers/project-categories-controller.ts:72-77`
```sql
UPDATE project_categories
SET color_code = $2
WHERE id = $1 AND team_id = $3;
```

---

#### DELETE `/api/v1/project-categories/:id`
**Comportamento:**
- Remove a categoria
- Devido ao `ON DELETE CASCADE` na FK de `projects.category_id`, todos os projetos com esta categoria serão afetados

**SQL:** `/worklenz-backend/src/controllers/project-categories-controller.ts:88-93`
```sql
DELETE FROM project_categories
WHERE id = $1 AND team_id = $2;
```

---

## 3. PROJETOS (Projects)

### 3.1 Estrutura da Tabela

**Tabela:** `projects`
**Localização:** `/worklenz-backend/database/sql/1_tables.sql:763-883`

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT CHECK (char_length(name) <= 100),
    key TEXT CHECK (char_length(key) <= 5),
    color_code WL_HEX_COLOR,
    notes TEXT CHECK (char_length(notes) <= 500),
    tasks_counter BIGINT DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status_id UUID REFERENCES sys_project_statuses(id),
    category_id UUID REFERENCES project_categories(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
    phase_label TEXT,
    estimated_man_days INTEGER,
    hours_per_day INTEGER,
    estimated_working_days INTEGER,
    health_id UUID REFERENCES sys_project_healths(id),
    use_manual_progress BOOLEAN DEFAULT FALSE,
    use_weighted_progress BOOLEAN DEFAULT FALSE,
    use_time_progress BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Rotas e Endpoints

**Base URL:** `/api/v1/projects`
**Router:** `/worklenz-backend/src/routes/apis/projects-api-router.ts`
**Controller:** `/worklenz-backend/src/controllers/projects-controller.ts` (48KB - arquivo complexo)

| Método | Endpoint | Autenticação | Validadores | Descrição |
|--------|----------|--------------|-------------|-----------|
| POST | `/` | JWT | `teamOwnerOrAdminValidator`<br>`projectsBodyValidator` | Cria um novo projeto |
| GET | `/` | JWT | - | Lista todos os projetos com filtros |
| GET | `/grouped` | JWT | - | Lista projetos agrupados por categoria/cliente |
| GET | `/my-task-projects` | JWT | - | Projetos onde usuário tem tarefas |
| GET | `/my-projects` | JWT | - | Projetos do usuário |
| GET | `/all` | JWT | - | Todos os projetos |
| GET | `/tasks` | JWT | - | Todas as tarefas |
| GET | `/members/:id` | JWT | - | Membros de um projeto |
| GET | `/overview/:id` | JWT | `idParamValidator` | Estatísticas do projeto |
| GET | `/overview-members/:id` | JWT | `idParamValidator` | Estatísticas dos membros |
| GET | `/favorite/:id` | JWT | `idParamValidator` | Toggle favorito |
| GET | `/archive/:id` | JWT | `idParamValidator` | Toggle arquivo |
| GET | `/:id` | JWT | `idParamValidator` | Obtém projeto por ID |
| PUT | `/update-pinned-view` | JWT | `projectMemberValidator` | Atualiza visualização fixada |
| PUT | `/:id` | JWT | `projectManagerValidator`<br>`idParamValidator`<br>`projectsBodyValidator` | Atualiza um projeto |
| DELETE | `/:id` | JWT | `teamOwnerOrAdminValidator`<br>`idParamValidator` | Remove um projeto |
| GET | `/archive-all/:id` | JWT | `teamOwnerOrAdminValidator`<br>`idParamValidator` | Arquiva todos os projetos |

### 3.3 Detalhamento dos Endpoints Principais

#### POST `/api/v1/projects`
**Permissão:** Proprietário do Time ou Admin
**Validação:** `/worklenz-backend/src/middlewares/validators/projects-body-validator.ts`

```typescript
{
  name: string (required, max 100 chars),
  color_code: string (required),
  status_id: string (required),
  notes?: string (max 200 chars),
  category_id?: string,
  client_name?: string,
  folder_id?: string,
  start_date?: Date,
  end_date?: Date,
  project_manager?: { id: string },
  working_days?: number (integer),
  man_days?: number (integer),
  hours_per_day?: number (integer)
}
```

**Lógica de Negócio Complexa:**

1. **Validação de Plano Free:**
   - Verifica se usuário está no plano free
   - Obtém limite de projetos do plano
   - Bloqueia criação se limite atingido
   - Código: `/worklenz-backend/src/controllers/projects-controller.ts:65-73`

2. **Geração Automática de Key:**
   - Obtém todas as keys existentes do time
   - Gera uma key única baseada no nome do projeto (até 5 caracteres)
   - Usa função `generateProjectKey(name, existingKeys)`
   - Código: `/worklenz-backend/src/controllers/projects-controller.ts:87-88`

3. **Criação via Stored Procedure:**
   - Usa função `create_project($1)` com JSON serializado
   - A função gerencia toda a lógica de criação incluindo:
     - Inserção do projeto
     - Associação do gerente de projeto
     - Criação de log de atividade
     - Notificações
   - Código: `/worklenz-backend/src/controllers/projects-controller.ts:75-93`

**Campos Preparados:**
```typescript
req.body.team_id = req.user?.team_id
req.body.user_id = req.user?.id
req.body.folder_id = req.body.folder_id || null
req.body.category_id = req.body.category_id?.trim() || null
req.body.client_name = req.body.client_name?.trim() || null
req.body.project_created_log = "Project created"
req.body.project_member_added_log = "Project member added"
req.body.project_manager_id = req.body.project_manager?.id || null
req.body.key = generateProjectKey(req.body.name, keys) || null
```

---

#### GET `/api/v1/projects`
**Parâmetros de Query:**
- `search` - Busca por nome
- `sortField` - Campo para ordenação (padrão: "name")
- `sortOrder` - ASC ou DESC
- `size` - Tamanho da página
- `offset` - Posição inicial
- `filter` - "1" (favoritos), "2" (arquivados), ou vazio (ativos)
- `categories` - IDs de categorias separados por espaço
- `statuses` - IDs de status separados por espaço

**Lógica de Negócio:**
- **Filtro de Membros:** Se usuário não é owner/admin, mostra apenas projetos onde é membro
- **Favoritos:** Verifica tabela `favorite_projects`
- **Arquivados:** Verifica tabela `archived_projects`
- **Categorias e Status:** Filtra por IN clause

**Resposta Complexa:**
```typescript
{
  total: number,
  data: [
    {
      id: string,
      name: string,
      color_code: string,
      status: string,
      status_color: string,
      status_icon: string,
      favorite: boolean,
      archived: boolean,
      start_date: Date,
      end_date: Date,
      category_id: string,
      category_name: string,
      category_color: string,
      client_name: string,
      project_owner: string,
      project_manager: { id: string },
      team_member_default_view: string,
      all_tasks_count: number,
      completed_tasks_count: number,
      progress: number,  // Calculado: (completed/total) * 100
      members_count: number,
      names: Array<{name: string, color_code: string}>,
      updated_at: Date,
      updated_at_string: string  // "2 hours ago" format
    }
  ]
}
```

**SQL:** `/worklenz-backend/src/controllers/projects-controller.ts:221-293`

**Pós-Processamento:**
- Calcula `progress` para cada projeto
- Converte `updated_at` para formato relativo (usando moment.js)
- Gera lista de tags de membros com cores
- Extrai informações do gerente de projeto

---

#### GET `/api/v1/projects/:id`
**Descrição:** Retorna detalhes completos de um projeto específico

**Resposta:**
```typescript
{
  id: string,
  name: string,
  key: string,
  color_code: string,
  notes: string,
  start_date: Date,
  end_date: Date,
  status_id: string,
  status: string,
  status_color: string,
  status_icon: string,
  health_id: string,
  category_id: string,
  category_name: string,
  category_color: string,
  client_name: string,
  project_owner: string,
  folder_id: string,
  phase_label: string,
  man_days: number,
  working_days: number,
  hours_per_day: number,
  use_manual_progress: boolean,
  use_weighted_progress: boolean,
  use_time_progress: boolean,
  subscribed: boolean,  // Se usuário está inscrito para notificações
  project_manager: {
    id: string,
    name: string,
    email: string,
    avatar_url: string,
    color_code: string,
    pending_invitation: boolean,
    active: boolean
  },
  created_at: Date,
  updated_at: Date
}
```

**SQL:** `/worklenz-backend/src/controllers/projects-controller.ts:376-432`

**Pós-Processamento:**
- Extrai informações do gerente de projeto do JSON aninhado
- Gera `color_code` para o nome do gerente

---

#### PUT `/api/v1/projects/:id`
**Permissão:** Gerente de Projeto ou superior
**Validação:** Mesma do POST, mais validações adicionais:

```typescript
// Validações adicionais:
if (!key) return "The project key cannot be empty."
if (key.length > 5) return "The project key length cannot exceed 5 characters."
```

**Lógica de Negócio:**
- Usa stored procedure `update_project($1)`
- Notifica gerente de projeto sobre mudanças via Socket.io
- Emite evento `PROJECT_DATA_CHANGE` para todos os membros do projeto
- Cria notificação se gerente de projeto foi alterado

**Código de Notificação:** `/worklenz-backend/src/controllers/projects-controller.ts:29-56`
```typescript
private static async notifyProjecManagertUpdates(
  projectId: string,
  user: IPassportSession,
  projectManagerTeamMemberId: string | null
) {
  // Cria notificação para o novo gerente
  // Emite evento Socket.io para o projeto
}
```

---

#### DELETE `/api/v1/projects/:id`
**Permissão:** Proprietário do Time ou Admin
**Comportamento:**
- Remove o projeto do banco
- Devido aos relacionamentos CASCADE, remove:
  - Todas as tarefas do projeto
  - Todos os membros do projeto
  - Todos os status customizados
  - Todos os comentários
  - Todos os anexos
  - Todas as fases
  - E outros dados relacionados

**SQL:** `/worklenz-backend/src/controllers/projects-controller.ts:482-486`
```sql
DELETE FROM projects
WHERE id = $1 AND team_id = $2
```

---

#### GET `/api/v1/projects/overview/:id`
**Descrição:** Retorna estatísticas resumidas do projeto

**Resposta:**
```typescript
{
  done_task_count: number,      // Tarefas concluídas
  pending_task_count: number    // Tarefas pendentes (TODO + DOING)
}
```

**SQL:** `/worklenz-backend/src/controllers/projects-controller.ts:492-523`

---

#### GET `/api/v1/projects/overview-members/:id`
**Descrição:** Retorna estatísticas dos membros do projeto

**Parâmetros:**
- `archived` - Incluir tarefas arquivadas (boolean)

**Resposta:**
```typescript
[
  {
    id: string,  // team_member_id
    active: boolean,
    project_task_count: number,
    task_count: number,
    completed_task_count: number,
    // Outras métricas por membro
  }
]
```

---

#### GET `/api/v1/projects/members/:id`
**Descrição:** Lista membros do projeto com paginação

**Parâmetros de Query:**
- `search` - Busca por nome ou email
- `sortField` - Campo para ordenação
- `sortOrder` - ASC ou DESC
- `size` - Tamanho da página
- `offset` - Posição inicial

**Resposta:**
```typescript
{
  total: number,
  data: [
    {
      id: string,
      team_member_id: string,
      name: string,
      email: string,
      avatar_url: string,
      all_tasks_count: number,
      completed_tasks_count: number,
      progress: number,  // Calculado
      pending_invitation: boolean,
      access: string,  // Nível de acesso
      job_title: string
    }
  ]
}
```

**SQL:** `/worklenz-backend/src/controllers/projects-controller.ts:318-372`

---

#### GET `/api/v1/projects/favorite/:id`
**Descrição:** Toggle de favorito para o projeto

**Lógica de Negócio:**
- Se já existe em `favorite_projects`, remove
- Se não existe, adiciona
- Retorna novo estado

---

#### GET `/api/v1/projects/archive/:id`
**Descrição:** Toggle de arquivo para o projeto

**Lógica de Negócio:**
- Se já existe em `archived_projects`, remove
- Se não existe, adiciona
- Retorna novo estado

---

## 4. MÓDULOS RELACIONADOS

O projeto possui 53 módulos de rotas adicionais que se relacionam com as entidades principais:

### 4.1 Gerenciamento de Projetos
- `/project-members` - Gerenciamento de membros
- `/project-managers` - Gerentes de projeto
- `/project-statuses` - Status customizados
- `/project-comments` - Comentários
- `/project-folders` - Pastas organizacionais
- `/project-healths` - Saúde do projeto
- `/project-insights` - Analytics e insights
- `/project-templates` - Templates de projeto

### 4.2 Tarefas
- `/tasks` - CRUD de tarefas
- `/sub-tasks` - Sub-tarefas
- `/task-comments` - Comentários de tarefas
- `/task-dependencies` - Dependências entre tarefas
- `/task-phases` - Fases de tarefas
- `/task-templates` - Templates de tarefas
- `/task-work-log` - Registro de trabalho
- `/task-recurring` - Tarefas recorrentes

### 4.3 Time e Usuários
- `/teams` - Gerenciamento de times
- `/team-members` - Membros do time
- `/job-titles` - Cargos
- `/notifications` - Notificações
- `/user-activity-logs` - Logs de atividade

### 4.4 Visualizações e Relatórios
- `/gantt-api` - Gráfico de Gantt
- `/reporting` - Relatórios
- `/reporting-export` - Exportação de relatórios
- `/insights` - Insights e analytics
- `/resource-allocation` - Alocação de recursos
- `/workload` - Carga de trabalho
- `/roadmap` - Roadmap
- `/schedule` - Agendamento

### 4.5 Configurações e Customização
- `/settings` - Configurações gerais
- `/statuses` - Status do sistema
- `/priorities` - Prioridades
- `/labels` - Etiquetas
- `/custom-columns` - Colunas customizadas
- `/attachments` - Anexos

### 4.6 Administrativo
- `/admin-center` - Centro administrativo
- `/billing` - Faturamento
- `/account` - Conta do usuário
- `/support` - Suporte

---

## 5. SEGURANÇA E AUTENTICAÇÃO

### 5.1 Middlewares de Segurança

**Aplicados Globalmente:**
- **CSRF Protection:** csrf-sync com tokens de sessão
- **Rate Limiting:** 1500 requisições / 15 minutos por IP
- **Helmet:** Headers de segurança HTTP
- **CORS:** Configuração de origens permitidas
- **HPP:** Proteção contra poluição de parâmetros HTTP
- **Compression:** Compressão de respostas

**Localização:** `/worklenz-backend/src/app.ts`

### 5.2 Middlewares de Autorização

**Validadores Customizados:**

| Middleware | Descrição | Uso |
|------------|-----------|-----|
| `teamOwnerOrAdminValidator` | Verifica se é proprietário ou admin do time | Operações críticas (criar/deletar projetos) |
| `projectManagerValidator` | Verifica se é gerente do projeto | Editar projetos |
| `projectMemberValidator` | Verifica se é membro do projeto | Operações em projetos |
| `idParamValidator` | Valida UUID no parâmetro | Todos os endpoints com `:id` |
| `clientsBodyValidator` | Valida corpo da requisição de clientes | POST/PUT clientes |
| `projectsBodyValidator` | Valida corpo da requisição de projetos | POST/PUT projetos |

**Localização:** `/worklenz-backend/src/middlewares/validators/`

### 5.3 Isolamento por Time (Team)

**Todos os endpoints implementam isolamento por `team_id`:**
- Clientes: `WHERE team_id = $1`
- Categorias: `WHERE team_id = $1`
- Projetos: `WHERE team_id = $1`

**Garantia:** Usuários de um time nunca acessam dados de outro time.

---

## 6. REAL-TIME E NOTIFICAÇÕES

### 6.1 Socket.io

**Eventos Principais:**
- `PROJECT_DATA_CHANGE` - Mudanças em dados do projeto
- `PROJECT_STATUS_CHANGE` - Mudança de status
- `PROJECT_CATEGORY_CHANGE` - Mudança de categoria
- `PROJECT_HEALTH_CHANGE` - Mudança de saúde
- `PROJECT_MEMBER_CHANGE` - Mudança de membros

**Localização:** `/worklenz-backend/src/socket.io/`

### 6.2 Sistema de Notificações

**Service:** `NotificationsService`
**Localização:** `/worklenz-backend/src/services/notifications/`

**Exemplo de Notificação:**
```typescript
NotificationsService.createNotification({
  userId: data.user_id,
  teamId: user?.team_id as string,
  socketId: data.socket_id,
  message: `You're assigned as the <b> Project Manager </b> of the <b> ${data.project_name} </b>.`,
  taskId: null,
  projectId: projectId as string
});
```

**Código:** `/worklenz-backend/src/controllers/projects-controller.ts:42-49`

---

## 7. BANCO DE DADOS

### 7.1 Estrutura

**Esquema Principal:** `/worklenz-backend/database/sql/1_tables.sql`
**Funções:** `/worklenz-backend/database/sql/4_functions.sql`
**Migrações:** `/worklenz-backend/database/migrations/`

### 7.2 Funções Importantes

#### `create_project($1 JSON)`
**Descrição:** Stored procedure complexa para criar projeto
**Parâmetros:** JSON com todos os dados do projeto
**Retorna:** Objeto do projeto criado
**Localização:** Função SQL no banco

#### `update_project($1 JSON)`
**Descrição:** Stored procedure para atualizar projeto
**Parâmetros:** JSON com dados atualizados
**Retorna:** Objeto do projeto atualizado

#### `is_member_of_project(project_id, user_id, team_id)`
**Descrição:** Verifica se usuário é membro do projeto
**Retorna:** BOOLEAN

#### `in_organization(team_id, org_team_id)`
**Descrição:** Verifica se time pertence à organização
**Retorna:** BOOLEAN

#### `get_project_members(project_id)`
**Descrição:** Retorna nomes dos membros do projeto
**Retorna:** Array de nomes

#### `generateProjectKey(name, existingKeys)`
**Descrição:** Gera key única de 2-5 caracteres
**Lógica:**
1. Remove espaços e caracteres especiais
2. Pega iniciais de cada palavra
3. Se conflito, adiciona números
4. Máximo 5 caracteres

**Localização:** `/worklenz-backend/src/utils/generate-project-key.ts`

---

## 8. FRONTEND

### 8.1 Estrutura de Serviços API

**Clientes:**
- `/worklenz-frontend/src/api/clients/clients.api.service.ts`
- Métodos: getClients, getClientById, createClient, updateClient, deleteClient

**Categorias:**
- Gerenciado através dos serviços de projetos
- Redux slice: `projectsSlice`

**Projetos:**
- `/worklenz-frontend/src/api/projects/projects.api.service.ts`
- `/worklenz-frontend/src/api/projects/projects.v1.api.service.ts`
- Métodos: getProjects, getProjectById, createProject, updateProject, deleteProject, toggleFavorite, toggleArchive, e muitos outros

### 8.2 Gerenciamento de Estado (Redux)

**Slices Principais:**
- `projectsSlice` - Lista de projetos e categorias
- `project.slice` - Projeto individual
- `project-drawer.slice` - Drawer de projeto
- `clients.slice` (se existir)

**Localização:** `/worklenz-frontend/src/features/`

### 8.3 Componentes Principais

**Projetos:**
- `/worklenz-frontend/src/features/projects/` - Feature de projetos
- `/worklenz-frontend/src/features/project/` - Projeto individual
- `/worklenz-frontend/src/pages/projects/` - Páginas

**Clientes:**
- `/worklenz-frontend/src/features/settings/client/` - Gerenciamento

**Categorias:**
- `/worklenz-frontend/src/features/projects/lookups/projectCategories/` - Lookup de categorias

### 8.4 Types TypeScript

**Clientes:**
```typescript
// /worklenz-frontend/src/types/client.types.ts
interface IClient {
  id: string;
  name: string;
  projects_count?: number;
}
```

**Categorias:**
```typescript
// /worklenz-frontend/src/types/project/projectCategory.types.ts
interface IProjectCategory {
  id: string;
  name: string;
  color_code: string;
  usage?: number;
}
```

**Projetos:**
```typescript
// /worklenz-frontend/src/types/project/project.types.ts
interface IProject {
  id: string;
  name: string;
  key: string;
  color_code: string;
  notes?: string;
  start_date?: Date;
  end_date?: Date;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  client_name?: string;
  status_id: string;
  status?: string;
  status_color?: string;
  status_icon?: string;
  health_id?: string;
  project_manager?: IProjectManager;
  favorite?: boolean;
  archived?: boolean;
  all_tasks_count?: number;
  completed_tasks_count?: number;
  progress?: number;
  members_count?: number;
  // ... mais campos
}
```

---

## 9. FLUXO DE DADOS

### 9.1 Exemplo: Criar Projeto

```
1. FRONTEND
   └─> projects.api.service.ts
       └─> POST /api/v1/projects
           └─> Body: { name, color_code, status_id, ... }

2. BACKEND - Middlewares
   ├─> JWT Authentication
   ├─> teamOwnerOrAdminValidator (verifica permissão)
   ├─> projectsBodyValidator (valida dados)
   └─> Rate Limiting (1500 req/15min)

3. BACKEND - Controller
   └─> ProjectsController.create()
       ├─> Valida plano free (limite de projetos)
       ├─> Obtém keys existentes do time
       ├─> Gera key única (generateProjectKey)
       ├─> Prepara dados (team_id, user_id, etc)
       └─> Chama stored procedure create_project($1)

4. BANCO DE DADOS
   └─> create_project(JSON)
       ├─> INSERT INTO projects
       ├─> INSERT INTO project_members (gerente)
       ├─> INSERT INTO activity_logs
       └─> RETURN projeto criado

5. BACKEND - Pós-Processamento
   ├─> NotificationsService.createNotification()
   └─> Socket.io emit PROJECT_DATA_CHANGE

6. FRONTEND - Atualização
   ├─> Recebe resposta
   ├─> Redux: projectsSlice.addProject()
   ├─> Socket.io: recebe evento
   └─> UI atualiza automaticamente
```

### 9.2 Exemplo: Listar Clientes com Projetos

```
1. FRONTEND
   └─> clients.api.service.ts
       └─> GET /api/v1/clients?size=10&offset=0&search=acme

2. BACKEND
   └─> ClientsController.get()
       ├─> Extrai parâmetros de paginação
       ├─> Constrói query com subquery de contagem
       └─> Executa query complexa

3. BANCO DE DADOS
   └─> Query com ROW_TO_JSON
       ├─> Conta total de clientes
       ├─> Para cada cliente:
       │   ├─> Busca id, name
       │   └─> Subquery: COUNT(*) FROM projects WHERE client_id = clients.id
       └─> RETURN JSON com { total, data }

4. BACKEND - Resposta
   └─> new ServerResponse(true, data.clients)

5. FRONTEND
   ├─> Recebe { total: 50, data: [...] }
   └─> Renderiza lista com contagem de projetos
```

---

## 10. CONSIDERAÇÕES DE PERFORMANCE

### 10.1 Otimizações Implementadas

**Backend:**
- Rate limiting para prevenir abuso
- Paginação em todos os endpoints de listagem
- Queries otimizadas com índices (presumido)
- Uso de stored procedures para operações complexas
- Compression de respostas

**Banco de Dados:**
- Índices em foreign keys (padrão PostgreSQL)
- Funções SQL para queries complexas
- JSON aggregation para reduzir round-trips

**Frontend:**
- Redux para cache de estado
- Memoização de componentes React
- Socket.io para atualizações em tempo real (evita polling)

### 10.2 Potenciais Gargalos

**Identificados:**
1. **Queries Complexas em Projetos:**
   - `/api/v1/projects` e `/api/v1/projects/my-projects` têm queries muito complexas
   - Múltiplas subqueries para cada projeto
   - Pode ser lento com muitos projetos

2. **N+1 em Loops:**
   - Pós-processamento em loops: `for (const project of data?.projects.data || [])`
   - Não é N+1 de banco, mas processa muitos dados

3. **String Interpolation em SQL:**
   - Alguns filtros usam interpolação: `` `${searchQuery}` ``
   - Pode ser vulnerável a SQL injection se não tratado corretamente

**Recomendações:**
- Adicionar índices em campos de busca frequente
- Considerar materializar views para queries complexas
- Implementar cache Redis para listagens frequentes
- Revisar queries com EXPLAIN ANALYZE

---

## 11. SEGURANÇA

### 11.1 Vulnerabilidades Potenciais

**Baixo Risco:**
1. **String Interpolation em Queries:**
   - Localização: `/worklenz-backend/src/controllers/projects-controller.ts:123-127`
   - Código: `` `${req.user?.id}' `` interpolado diretamente
   - **Mitigação:** Vem de `req.user` (passport), já autenticado
   - **Ação:** Considerar usar parâmetros para melhor prática

2. **flatString() Method:**
   - Localização: `/worklenz-backend/src/controllers/project-categories-controller.ts:13-14`
   - Código: `text.split(",").map(s => \`'${s}'\`)`
   - **Mitigação:** Usado para IDs (UUIDs)
   - **Ação:** Validar formato UUID antes de usar

**Protegido:**
- Todas as queries principais usam parâmetros (`$1, $2, etc`)
- CSRF tokens implementados
- Rate limiting ativo
- Isolamento por team_id em todas as queries
- Validação de inputs com middlewares

### 11.2 Melhores Práticas Implementadas

- Autenticação JWT + Session
- Autorização granular (owner, admin, manager, member)
- Validação de dados de entrada
- Headers de segurança (Helmet)
- Proteção CSRF
- Rate limiting
- Isolamento multi-tenant por team_id

---

## 12. ESTRUTURA DE ARQUIVOS RELEVANTES

```
worklenz/
├── worklenz-backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── apis/
│   │   │       ├── clients-api-router.ts
│   │   │       ├── project-categories-api-router.ts
│   │   │       └── projects-api-router.ts
│   │   ├── controllers/
│   │   │   ├── clients-controller.ts
│   │   │   ├── project-categories-controller.ts
│   │   │   └── projects-controller.ts (48KB)
│   │   ├── middlewares/
│   │   │   └── validators/
│   │   │       ├── clients-body-validator.ts
│   │   │       ├── projects-body-validator.ts
│   │   │       ├── team-owner-or-admin-validator.ts
│   │   │       └── project-manager-validator.ts
│   │   ├── services/
│   │   │   └── notifications/
│   │   ├── socket.io/
│   │   ├── utils/
│   │   │   └── generate-project-key.ts
│   │   ├── shared/
│   │   └── app.ts
│   └── database/
│       ├── sql/
│       │   ├── 1_tables.sql
│       │   └── 4_functions.sql
│       └── migrations/
└── worklenz-frontend/
    ├── src/
    │   ├── api/
    │   │   ├── clients/
    │   │   │   └── clients.api.service.ts
    │   │   └── projects/
    │   │       ├── projects.api.service.ts
    │   │       └── projects.v1.api.service.ts
    │   ├── features/
    │   │   ├── projects/
    │   │   │   ├── projectsSlice.ts
    │   │   │   └── lookups/
    │   │   │       └── projectCategories/
    │   │   ├── project/
    │   │   │   ├── project.slice.ts
    │   │   │   └── project-drawer.slice.ts
    │   │   └── settings/
    │   │       └── client/
    │   ├── types/
    │   │   ├── client.types.ts
    │   │   └── project/
    │   │       ├── project.types.ts
    │   │       └── projectCategory.types.ts
    │   └── pages/
    │       └── projects/
    └── package.json
```

---

## 13. RESUMO E INSIGHTS

### 13.1 Arquitetura

O Worklenz implementa uma arquitetura robusta e escalável:
- **Separação clara** entre frontend e backend
- **API RESTful** bem estruturada com versionamento
- **Autenticação e autorização** multi-camadas
- **Real-time** via Socket.io para colaboração
- **Multi-tenant** com isolamento por team_id

### 13.2 Padrões Identificados

**Backend:**
- Uso extensivo de **Stored Procedures** para lógica complexa
- **Validators modulares** para cada tipo de operação
- **Controllers com decorador** `@HandleExceptions()` para tratamento de erros
- **Safe controller functions** para envolver handlers
- **JSON aggregation** no PostgreSQL para reduzir queries

**Frontend:**
- **Redux** para gerenciamento de estado global
- **API Services** separados por módulo
- **TypeScript** para type safety
- **React Hooks** customizados
- **Ant Design** para componentes UI

### 13.3 Complexidade

**Projetos** é o módulo mais complexo:
- 48KB de código no controller
- 20+ endpoints diferentes
- Múltiplas funções auxiliares
- Integração com notificações e Socket.io
- Validações de plano e limites

**Clientes** é o mais simples:
- CRUD básico
- Paginação padrão
- Integração leve com projetos

**Categorias** é intermediário:
- CRUD com geração automática de cores
- Suporte para multi-organização
- Tracking de uso

### 13.4 Pontos Fortes

1. **Isolamento de Times:** Garantia de segurança multi-tenant
2. **Validações Robustas:** Middlewares em camadas
3. **Real-time:** Socket.io para colaboração
4. **Notificações:** Sistema completo de notificações
5. **Paginação:** Implementada em todas as listagens
6. **Type Safety:** TypeScript em todo o stack
7. **Stored Procedures:** Lógica complexa no banco

### 13.5 Áreas de Melhoria

1. **Performance de Queries:** Otimizar queries complexas de projetos
2. **Caching:** Implementar cache Redis para listagens
3. **SQL Injection:** Eliminar interpolação de strings em SQL
4. **Testes:** Adicionar testes unitários e de integração
5. **Documentação:** Documentar stored procedures
6. **Monitoramento:** Adicionar APM e logging estruturado
7. **Rate Limiting:** Considerar limites por usuário além de IP

---

## 14. ENDPOINTS COMPLEMENTARES

Além dos três módulos principais, o sistema possui endpoints para:

- **Tarefas e Sub-tarefas:** Gerenciamento completo de tarefas
- **Gantt e Visualizações:** Múltiplas formas de visualizar projetos
- **Relatórios:** Sistema de reporting completo
- **Alocação de Recursos:** Gerenciamento de recursos e workload
- **Templates:** Templates de projetos e tarefas
- **Attachments:** Sistema de anexos
- **Billing:** Integração com sistema de pagamento

**Total de módulos:** 53 routers identificados

---

## CONCLUSÃO

O Worklenz é uma aplicação de gerenciamento de projetos bem arquitetada com:
- ✅ Segurança robusta multi-tenant
- ✅ API RESTful completa e versionada
- ✅ Real-time para colaboração
- ✅ Frontend moderno com React + Redux
- ✅ Backend escalável com Node.js + PostgreSQL
- ⚠️ Oportunidades de otimização de performance
- ⚠️ Necessidade de testes automatizados

O sistema está pronto para produção mas beneficiaria de melhorias em performance, caching e testes.

---

**Documentado por:** Claude (Anthropic)
**Branch de Análise:** claude/analyze-project-routes-FxkRB
**Data:** 2025-12-22
