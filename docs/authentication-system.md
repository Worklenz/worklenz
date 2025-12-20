# Sistema de Autenticação e Branding

Este documento descreve o funcionamento do sistema de autenticação, o fluxo de aprovação de contas e a integração de branding configurável no projeto.

## 1. Visão Geral

O sistema de autenticação é baseado em **Passport.js** no backend e **Redux Toolkit** no frontend. Recentemente, foi implementado um fluxo de aprovação obrigatória para novos cadastros e um sistema de branding que permite renomear a aplicação via variáveis de ambiente.

## 2. Fluxo de Aprovação de Contas

Para garantir a segurança e o controle de acesso, novos usuários não têm acesso imediato ao sistema após o cadastro.

### Estados da Conta (`account_status`):
- **`pending`**: Estado inicial após o cadastro via e-mail ou Google. O usuário não consegue logar.
- **`approved`**: Definido por um administrador no Centro de Administração. Permite o acesso total.
- **`rejected`**: O acesso é negado. O administrador pode fornecer um motivo para a rejeição.

### Processo:
1. **Cadastro**: O usuário se registra na `SignupPage`.
2. **Aguardando**: O sistema exibe uma mensagem informando que a conta está em análise.
3. **Aprovação**: Um administrador acessa o **Centro de Administração > Usuários** e aprova ou rejeita a conta.
4. **Login**: Somente após a aprovação, o usuário consegue completar o login.

## 3. Branding Configurável

O nome da aplicação (ex: "Worklenz", "Projetos", etc.) é dinâmico e centralizado.

### Como configurar:
- **Frontend**: Defina `VITE_APP_BRAND_NAME` no arquivo `.env`.
- **Backend**: Defina `APP_BRAND_NAME` no arquivo `.env`.

### Implementação Técnica:
- **Frontend**: Utilize a função `getBrandName()` importada de `@/utils/branding`.
- **Backend**: Utilize a função `getBrandName()` importada de `../shared/utils`.
- **HTML**: O título da página e as meta tags são substituídos automaticamente durante o build através de um plugin customizado no `vite.config.mts`.

## 4. Variáveis de Ambiente

### Frontend (`worklenz-frontend/.env`)
| Variável | Descrição | Padrão |
| :--- | :--- | :--- |
| `VITE_APP_BRAND_NAME` | Nome da marca exibido na UI e títulos. | `Projetos` |
| `VITE_ENABLE_GOOGLE_LOGIN` | Habilita/Desabilita o botão de login do Google. | `false` |

### Backend (`worklenz-backend/.env`)
| Variável | Descrição | Padrão |
| :--- | :--- | :--- |
| `APP_BRAND_NAME` | Nome da marca usado em mensagens de erro e e-mails. | `Projetos` |
| `ADMIN_EMAIL` | E-mail do Super Admin (acesso total sem banco de dados). | - |
| `ADMIN_PASSWORD` | Senha do Super Admin. | - |

## 5. Super Admin (Acesso de Emergência)

Para facilitar a aprovação inicial de usuários ou recuperação de acesso, é possível configurar um **Super Admin** via variáveis de ambiente.

- **Configuração**: Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` do backend.
- **Comportamento**:
    - Este usuário não precisa existir no banco de dados.
    - Possui permissões de `admin` e `owner`.
    - Pode acessar o Centro de Administração para aprovar/rejeitar outros usuários.
    - **ID Fixo**: `00000000-0000-0000-0000-000000000000`

## 6. Componentes Principais

### Frontend:
- **`authSlice.ts`**: Gerencia o estado global de autenticação, tokens e informações do usuário.
- **`LoginPage.tsx`**: Lida com o login e exibe mensagens específicas de erro (ex: conta pendente).
- **`SignupPage.tsx`**: Lida com o novo cadastro e informa sobre o fluxo de aprovação.
- **`AuthenticatingPage.tsx`**: Página intermediária para validação de tokens e redirecionamento pós-login.

### Backend:
- **`AuthController.ts`**: Contém a lógica de login, registro e verificação de status da conta.
- **`rbac.ts`**: Define as permissões baseadas em funções (Role-Based Access Control).

## 6. Mensagens de Erro Comuns

- **"Sua conta [Marca] está aguardando aprovação."**: Ocorre quando um usuário aprovado tenta logar antes de um admin liberar o acesso.
- **"Nenhuma conta [Marca] encontrada para este e-mail."**: Ocorre quando o e-mail não está cadastrado ou foi excluído.
- **"Sua solicitação de acesso foi rejeitada."**: Exibido quando o admin define o status como `rejected`.

---
*Última atualização: Dezembro de 2025*
